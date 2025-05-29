import { canvasDeleteTab, canvasDeleteTabs, requestFetchTabsForContext, canvasInsertTab, canvasInsertTabArray, canvasRemoveTab, canvasRemoveTabs, canvasUpdateTab } from "./canvas";
import { browserCloseTabArray, browserIsValidTabUrl, browserOpenTabArray, getCurrentBrowser, onContextTabsUpdated, sendRuntimeMessage, stripTabProperties } from "./utils";
import config from "@/general/config";
import { fetchContextList, fetchContextDocuments, fetchContext, getSocket, enableAutoReconnect, disableAutoReconnect, forceReconnect, isAutoReconnectEnabled, setAutoReconnectForSetup } from "./socket";
import index from "./TabIndex";
import { RUNTIME_MESSAGES, SOCKET_EVENTS } from "@/general/constants";
import { browser, getPinnedTabs } from "@/general/utils";
import { updateSessionsList } from "./session";

console.log('background.js | Initializing Canvas Browser Extension background worker');

// Helper function to get the current context from storage
const getCurrentContext = async (): Promise<IContext | null> => {
  const selectedContext = await browser.storage.local.get(["CNVS_SELECTED_CONTEXT"]);
  if (selectedContext.CNVS_SELECTED_CONTEXT) {
    return selectedContext.CNVS_SELECTED_CONTEXT;
  }

  const contexts = await browser.storage.local.get(["contexts"]);
  return contexts.contexts?.[0] || null;
};



// Track the current context to detect changes
let currentContextId: string | null = null;

// Function to handle context changes
const handleContextChange = async (newContext: IContext | null) => {
  const newContextId = newContext ? `${newContext.userId}/${newContext.id}` : null;

  if (currentContextId === newContextId) {
    return; // No change
  }

  console.log(`background.js | Context changed from ${currentContextId} to ${newContextId}`);
  currentContextId = newContextId;

  if (!newContext) {
    console.log('background.js | No context selected, clearing canvas tabs');
    index.clearCanvasTabs();
    return;
  }

  try {
    console.log('background.js | Fetching tabs for new context...');
    const tabs = await requestFetchTabsForContext();

    if (tabs) {
      console.log(`background.js | Received ${tabs.length} tabs for context ${newContextId}`);
      // Use silent method first to update storage, then trigger UI update
      index.insertCanvasTabArraySilent(tabs, true);
      // Now update browser tabs to recalculate sync status and notify UI
      await index.updateBrowserTabs();
    } else {
      console.log('background.js | No tabs found for new context');
      // Clear canvas tabs if no data received
      index.clearCanvasTabs();
    }



    // Send success message to popup
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.success_message,
      payload: 'Context switched successfully'
    });

    console.log('background.js | Context switch completed successfully');
  } catch (error) {
    console.error('background.js | Error updating context:', error);
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.error_message,
      payload: 'Error updating context'
    });
  }
};

// Initialize current context tracking
const initializeContextTracking = async () => {
  const context = await getCurrentContext();
  currentContextId = context ? `${context.userId}/${context.id}` : null;
  console.log(`background.js | Initial context: ${currentContextId}`);
};

// Storage listener to monitor context changes
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.CNVS_SELECTED_CONTEXT) {
    const newContext = changes.CNVS_SELECTED_CONTEXT.newValue;
    console.log('background.js | Detected context change in storage:', newContext);
    handleContextChange(newContext);
  }
});

(async function () {
  const socket = await getSocket();

  // Runtime defaults
  let TabDocumentSchema: () => ITabDocumentSchema = () => {
    return {
      schema: 'data/abstraction/tab',
      data: {
      }
    }
  };

  let watchTabProperties = [
    "url",
    "hidden",
    "pinned",
    "mutedInfo"
  ];

  // Custom index module for easier delta comparison
  await index.initialize();
  console.log('background.js | Index initialized: ', index.counts());

  // Initialize context tracking
  await initializeContextTracking();


  /**
   * Browser event listeners
   */

  browser.tabs.onCreated.addListener((tab) => {
    // noop, we need to wait for the onUpdated event to get the url
    console.log(`background.js | Tab created: ${tab.id}`);
  })

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    console.log('background.js | Tab updated: ', tabId, changeInfo, tab);

    // Check if the changed properties matters
    if (!Object.keys(changeInfo).some(cik => watchTabProperties.some(wtpk => cik === wtpk)))
      return;

    // Trigger on url change if the tab url is valid
    if (changeInfo.url && browserIsValidTabUrl(changeInfo.url)) {
      await index.updateBrowserTabs();
    }
  })

  browser.tabs.onMoved.addListener(async (tabId, moveInfo) => {
    console.log('background.js | Tab moved: ', tabId, moveInfo);

    // Update the current index
    await index.updateBrowserTabs();

    // noop
    //console.log('background.js | TODO: Disabled as we currently do not track move changes');
    //return;

    browser.tabs.get(tabId).then(async tab => {
      let tabDocument = TabDocumentSchema();
      tabDocument.data = stripTabProperties(tab)

      // Send update to backend
      const res: any = await canvasUpdateTab(tabDocument)

      if (res.status === "success") {
        console.log(`background.js | Tab ${tabId} updated: `, res);
        index.insertCanvasTab(tab)
      } else {
        console.error(`background.js | Update failed for tab ${tabId}:`)
        console.error(res);
      }

    }).catch(error => {
      console.error('background.js | Error retrieving tab data:', error);
    });
  });

  // TODO: Eval if we need this event at all, as we already have onUpdated
  // (which may not trigger on url change, but we can check for that)
  const browserAction = browser.action || browser.browserAction;
  browserAction.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
    console.log('background.js | Browser action clicked: ', tab, socket.isConnected());

    // Ignore non-valid tabs(about:*, empty tabs etc)
    if (!tab.url || !browserIsValidTabUrl(tab.url)) return

    // Update the current index
    await index.updateBrowserTabs();

    // Update our backend
    let tabDocument = TabDocumentSchema();
    tabDocument.data = stripTabProperties(tab);

    canvasUpdateTab(tabDocument).then((res: ISocketResponse<any>) => {
      if (res.status === "success") {
        console.log(`background.js | Tab ${tab.id} updated: `, res);
        index.insertCanvasTab(tab)
      } else {
        console.error(`background.js | Update failed for tab ${tab.id}:`)
        console.error(res);
      }
    });

  });

  browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    console.log('background.js | Tab removed: ', tabId, removeInfo);
    await index.updateBrowserTabs();
  });


  /**
   * UI Message Handlers
   */

  browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log('background.js | UI Message received: ', message);
    const socket = await getSocket();

    switch (message.action) {
      // socket.io
      case RUNTIME_MESSAGES.socket_status:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.socket_status, payload: socket && socket.isConnected() });
        break;

      case RUNTIME_MESSAGES.socket_test: {
        let isResolved = false;

        // Temporarily disable auto-reconnect to prevent connection error logging during test
        await setAutoReconnectForSetup(false);

        try {
          const testConfig = message.config || config;

          const { io } = await import('socket.io-client');

          const testSocketOptions = {
            withCredentials: true,
            upgrade: false,
            secure: false,
            transports: ['websocket'],
            reconnection: false,
            timeout: 3000, // Reduced timeout for faster feedback
            auth: {
              token: testConfig.transport.token,
              isApiToken: testConfig.transport.isApiToken || false
            },
            // Suppress engine.io logs to prevent connection error spam
            forceNew: true,
            autoConnect: false
          };

          const testConnectionUri = `${testConfig.transport.protocol}://${testConfig.transport.host}:${testConfig.transport.port}`;

          // Suppress console warnings during connection test
          const originalWarn = console.warn;
          const originalError = console.error;

          // Filter out expected connection errors during test
          console.warn = (...args) => {
            const message = args.join(' ');
            if (!message.includes('WebSocket connection') &&
                !message.includes('ERR_CONNECTION_REFUSED') &&
                !message.includes('socket.io') &&
                !message.includes('transport error')) {
              originalWarn.apply(console, args);
            }
          };

          console.error = (...args) => {
            const message = args.join(' ');
            if (!message.includes('WebSocket connection') &&
                !message.includes('ERR_CONNECTION_REFUSED') &&
                !message.includes('socket.io') &&
                !message.includes('transport error')) {
              originalError.apply(console, args);
            }
          };

          const testSocket = io(testConnectionUri, testSocketOptions);

          const connectionResult: { success: boolean, message?: string } = await new Promise((resolve) => {

            const cleanup = () => {
              try {
                // Restore console methods
                console.warn = originalWarn;
                console.error = originalError;

                testSocket.removeAllListeners();
                testSocket.disconnect();
                testSocket.close();
              } catch (error) {
                // Silently handle cleanup errors during test
              }
            };

            const resolveOnce = (result: { success: boolean, message?: string }) => {
              if (isResolved) {
                return;
              }

              isResolved = true;
              cleanup();
              resolve(result);
            };

            // Set up timeout first
            const timeoutId = setTimeout(() => {
              resolveOnce({ success: false, message: 'Connection timeout' });
            }, 3500);

            testSocket.once('connect', () => {
              clearTimeout(timeoutId);
              resolveOnce({ success: true });
            });

            testSocket.once('connect_error', (error) => {
              clearTimeout(timeoutId);
              // Don't log connection errors during test - they're expected
              resolveOnce({ success: false, message: 'Connection failed' });
            });

            testSocket.once('connect_timeout', () => {
              clearTimeout(timeoutId);
              resolveOnce({ success: false, message: 'Connection timeout' });
            });

            testSocket.once('disconnect', (reason) => {
              clearTimeout(timeoutId);
              if (!isResolved) {
                resolveOnce({ success: false, message: 'Connection disconnected' });
              }
            });

            // Start the connection attempt
            try {
              testSocket.connect();
            } catch (error) {
              clearTimeout(timeoutId);
              resolveOnce({ success: false, message: 'Failed to initiate connection' });
            }
          });

          if (connectionResult.success) {
            sendRuntimeMessage({ type: RUNTIME_MESSAGES.socket_test_success, payload: 'Connection successful!' });
          } else {
            sendRuntimeMessage({ type: RUNTIME_MESSAGES.socket_test_error, payload: connectionResult.message || 'Connection failed. Please check your settings.' });
          }
        } catch (error: any) {
          // Only log unexpected errors, not connection failures
          if (!error.message?.includes('connection') && !error.message?.includes('refused')) {
            console.error('background.js | Unexpected error during connection test:', error);
          }
          if(!isResolved) {
            sendRuntimeMessage({ type: RUNTIME_MESSAGES.socket_test_error, payload: 'Connection failed. Please check your settings.' });
          }
        } finally {
          // Re-enable auto-reconnect after test
          await setAutoReconnectForSetup(true);
        }
        break;
      }

      case RUNTIME_MESSAGES.socket_retry:
        try {
          if (message.config) {
            await config.setMultiple(message.config);
          }
          const newSocket = await getSocket();
          newSocket.initializeSocket(true);

          // Wait for connection to be established
          return new Promise((resolve) => {
            const checkConnection = setInterval(() => {
              if (newSocket.isConnected()) {
                clearInterval(checkConnection);
                sendRuntimeMessage({ type: RUNTIME_MESSAGES.socket_status, payload: true });
                resolve();
              }
            }, 100);

            // Timeout after 5 seconds
            setTimeout(() => {
              clearInterval(checkConnection);
              resolve();
            }, 5000);
          });
        } catch (error: any) {
          console.error('background.js | Error retrying socket connection:', error);
          return Promise.resolve({ status: 'error', message: error?.message || 'Failed to retry connection' });
        }

      case RUNTIME_MESSAGES.socket_enable_auto_reconnect:
        try {
          await enableAutoReconnect();
          return Promise.resolve({ status: 'success', message: 'Auto reconnect enabled' });
        } catch (error: any) {
          console.error('background.js | Error enabling auto reconnect:', error);
          return Promise.resolve({ status: 'error', message: error?.message || 'Failed to enable auto reconnect' });
        }

      case RUNTIME_MESSAGES.socket_disable_auto_reconnect:
        try {
          await disableAutoReconnect();
          return Promise.resolve({ status: 'success', message: 'Auto reconnect disabled' });
        } catch (error: any) {
          console.error('background.js | Error disabling auto reconnect:', error);
          return Promise.resolve({ status: 'error', message: error?.message || 'Failed to disable auto reconnect' });
        }

      case RUNTIME_MESSAGES.socket_force_reconnect:
        try {
          await forceReconnect();
          return Promise.resolve({ status: 'success', message: 'Reconnection initiated' });
        } catch (error: any) {
          console.error('background.js | Error forcing reconnect:', error);
          return Promise.resolve({ status: 'error', message: error?.message || 'Failed to force reconnect' });
        }

      case RUNTIME_MESSAGES.socket_is_auto_reconnect_enabled:
        try {
          const enabled = await isAutoReconnectEnabled();
          return Promise.resolve({ status: 'success', payload: enabled });
        } catch (error: any) {
          console.error('background.js | Error checking auto reconnect status:', error);
          return Promise.resolve({ status: 'error', message: error?.message || 'Failed to check auto reconnect status' });
        }

      // Config
      case RUNTIME_MESSAGES.config_get:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get, payload: config });
        break;

      case RUNTIME_MESSAGES.config_get_item:
        if (!message.key) return console.error('background.js | No config key specified');
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get_item, payload: config[message.key] });
        break;

      case RUNTIME_MESSAGES.config_set_item:
        if (!message.key || !message.value) return console.error('background.js | No config key or value specified');
        await config.set(message.key, message.value);
        config[message.key] = message.value;
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get, payload: config });
        break;

      case RUNTIME_MESSAGES.config_set:
        if (typeof message.value !== "object") {
          console.error('background.js | Invalid config', message.value);
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Invalid configuration data' });
          break;
        }

        try {
          await config.setMultiple(message.value);
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get, payload: config });
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_set_success, payload: 'Settings saved successfully!' });
        } catch (error) {
          console.error('background.js | Error saving config:', error);
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Failed to save settings' });
        }
        break;

      // Context
      case RUNTIME_MESSAGES.context_list:
        fetchContextList().then(contexts => {
          if (!contexts || contexts.length === 0) return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'No contexts found' });
          browser.storage.local.set({ contexts });
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_list, payload: contexts });
          console.log('background.js | Context list fetched: ', contexts);
        }).catch(error => {
          console.error('background.js | Error fetching context list:', error);
        });
        break;

      case 'context:documents:list':
        if (!message.payload || !message.payload.contextId) {
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Context ID is required' });
          break;
        }

        fetchContextDocuments(
          message.payload.contextId,
          message.payload.featureArray || [],
          message.payload.filterArray || [],
          message.payload.options || {}
        ).then(documents => {
          sendRuntimeMessage({
            type: 'context:documents:list:result',
            payload: documents
          });
          console.log('background.js | Context documents fetched: ', documents);
        }).catch(error => {
          console.error('background.js | Error fetching context documents:', error);
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: `Error fetching documents: ${error.message}` });
        });
        break;

      case 'context:get':
        if (!message.payload || !message.payload.contextId) {
          // If no contextId provided, get current context
          const currentContext = await getCurrentContext();
          sendRuntimeMessage({ type: 'context:get:result', payload: currentContext });
          break;
        }

        fetchContext(message.payload.contextId).then(context => {
          sendRuntimeMessage({
            type: 'context:get:result',
            payload: context
          });
          console.log('background.js | Context fetched: ', context);
        }).catch(error => {
          console.error('background.js | Error fetching context:', error);
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: `Error fetching context: ${error.message}` });
        });
        break;

      case RUNTIME_MESSAGES.context_get:
        const currentContext = await getCurrentContext();
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get, payload: currentContext });
        break;

      case RUNTIME_MESSAGES.context_get_url:
        const contextForUrl = await getCurrentContext();
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_url, payload: contextForUrl?.url });
        break;

      case RUNTIME_MESSAGES.context_get_path:
        const contextForPath = await getCurrentContext();
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_path, payload: contextForPath?.path });
        break;

      case RUNTIME_MESSAGES.context_get_pathArray:
        const contextForPathArray = await getCurrentContext();
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_pathArray, payload: contextForPathArray?.pathArray });
        break;

      case RUNTIME_MESSAGES.context_get_color:
        const contextForColor = await getCurrentContext();
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_color, payload: contextForColor?.color });
        break;

      case RUNTIME_MESSAGES.context_get_tree:
        const contextForTree = await getCurrentContext();
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_tree, payload: contextForTree?.tree });
        break;



      case RUNTIME_MESSAGES.context_refresh_tabs:
        console.log('background.js | Refreshing tabs for current context...');
        try {
          const tabs = await requestFetchTabsForContext();
          console.log(`background.js | Refreshed ${tabs.length} tabs for current context`);
          index.insertCanvasTabArraySilent(tabs, true);
          await index.updateBrowserTabs();
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.success_message, payload: 'Context tabs refreshed successfully' });
        } catch (error) {
          console.error('background.js | Error refreshing context tabs:', error);
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error refreshing context tabs' });
        }
        break;

      case RUNTIME_MESSAGES.context_tab_remove:
        if (!message.tab) return console.error('background.js | No tab specified');
        canvasRemoveTab(message.tab).then((res: any) => {
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error removing tab from Canvas' });
          console.log('background.js | Tab removed from the current context in Canvas: ', res.data);
        });
        break;

      case RUNTIME_MESSAGES.context_tabs_remove:
        if (!message.tabs) return console.error('background.js | No tab specified');
        canvasRemoveTabs(message.tabs).then((res: any) => {
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error removing tabs from Canvas' });
          console.log('background.js | Tab removed from the current context in Canvas: ', res.data);
        });
        break;

      // Browser
      case RUNTIME_MESSAGES.browser_tabs_update:
        return index.updateBrowserTabs();

      case RUNTIME_MESSAGES.browser_tabs_open:
        if (message.tabs) {
          console.log('background.js | Tabs to sync: ' + message.tabs.length);
        } else {
          console.log('background.js | No tabs specified, using current browser tabs');
          message.tabs = index.getBrowserTabArray();
        }

        await browserOpenTabArray(message.tabs);
        break;

      case RUNTIME_MESSAGES.browser_tabs_close:
        if (!message.tabs) return console.error('background.js | No tabs specified');
        browserCloseTabArray(message.tabs);
        break;

      // Canvas
      case RUNTIME_MESSAGES.canvas_tabs_fetch: {
        const tabs = await requestFetchTabsForContext();
        // if (!tabs) return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error fetching tabs from Canvas' });
        console.log('background.js | Tabs fetched from Canvas: ', tabs);
        index.insertCanvasTabArraySilent(tabs, true);
        await index.updateBrowserTabs();
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.canvas_tabs_fetch, payload: tabs });
        break;
      }

      case RUNTIME_MESSAGES.canvas_tabs_refresh:
        {
          console.log('background.js | Refreshing canvas tabs from server...');
          try {
            const tabs = await requestFetchTabsForContext();
            console.log(`background.js | Refreshed ${tabs.length} canvas tabs from server`);
            index.insertCanvasTabArraySilent(tabs, true);
            await index.updateBrowserTabs();
            sendRuntimeMessage({ type: RUNTIME_MESSAGES.success_message, payload: 'Canvas tabs refreshed successfully' });
          } catch (error) {
            console.error('background.js | Error refreshing canvas tabs:', error);
            sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error refreshing canvas tabs' });
          }
          break;
        }

      case RUNTIME_MESSAGES.canvas_tabs_openInBrowser:
        if (message.tabs) {
          console.log('background.js | Tabs to open: ' + message.tabs.length);
        } else {
          console.log('background.js | No tabs specified, using indexed canvas tabs');
          message.tabs = index.getCanvasTabArray();
        }

        await browserOpenTabArray(message.tabs);
        index.updateBrowserTabs().then(() => {
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.canvas_tabs_openInBrowser, payload: index.counts() });
        }).catch((error) => {
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error updating browser tabs' });
          console.error('background.js | Error updating browser tabs:', error);
        });
        break;

      case RUNTIME_MESSAGES.canvas_tabs_insert:
        let tabs: ICanvasTab[];
        if (message.tabs) {
          console.log('background.js | Tabs to sync: ' + message.tabs.length);
          tabs = message.tabs;
        } else {
          console.log('background.js | No tabs specified, using syncable browser tabs');
          tabs = index.deltaBrowserToCanvas();
        }

        console.log('background.js | Inserting tabs to Canvas: ', tabs);
        canvasInsertTabArray(tabs).then((res: ICanvasInsertResponse) => {
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error inserting tabs to Canvas' });
          console.log('background.js | Tabs inserted to Canvas: ', res);
          console.log('background.js | Index updated: ', index.counts());
        }).catch((error) => {
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error inserting tabs to Canvas' });
          console.error('background.js | Error inserting tabs to Canvas:', error);
        })

        break;

      case RUNTIME_MESSAGES.canvas_tab_insert:
        canvasInsertTab(message.tab).then((res: ICanvasInsertOneResponse) => {
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error inserting the tab to Canvas' });
          console.log('background.js | Index updated: ', index.counts());
        }).catch((error) => {
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error inserting tab to Canvas' });
          console.error('background.js | Error inserting tab to Canvas:', error);
        })

        break;

      case RUNTIME_MESSAGES.canvas_tab_delete:
        if (!message.tab) return console.error('background.js | No tab specified');
        canvasDeleteTab(message.tab).then((res: any) => {
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error deleting tab from Canvas' });
        });
        break;

      case RUNTIME_MESSAGES.canvas_tabs_delete:
        if (!message.tabs) return console.error('background.js | No tab specified');
        canvasDeleteTabs(message.tabs).then((res: any) => {
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error deleting tab from Canvas' });
        });
        break;



      // Index
      case RUNTIME_MESSAGES.index_get_counts:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.index_get_counts, payload: index.counts() });
        break;

      case RUNTIME_MESSAGES.index_get_browserTabArray:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.index_get_browserTabArray, payload: index.getBrowserTabArray() });
        break;

      case RUNTIME_MESSAGES.index_get_canvasTabArray:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.index_get_canvasTabArray, payload: index.getCanvasTabArray() });
        break;

      case RUNTIME_MESSAGES.index_get_deltaBrowserToCanvas:
        index.updateBrowserTabs();
        break;

      case RUNTIME_MESSAGES.index_get_deltaCanvasToBrowser:
        index.updateBrowserTabs();
        break;

      case RUNTIME_MESSAGES.index_clear:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.index_clear, payload: index.clearIndex() });
        break;

      case RUNTIME_MESSAGES.update_sessions_list:
        // updateSessionsList();
        break;

      case RUNTIME_MESSAGES.user_info:
        socket.emit('user:info');
        break;

      default:
        console.error(`background.js | Unknown message action: ${message.action}`);
        break;

    }

  });
})();
