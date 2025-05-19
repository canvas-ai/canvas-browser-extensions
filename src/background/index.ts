import { canvasDeleteTab, canvasDeleteTabs, canvasFetchTabsForContext, canvasInsertTab, canvasInsertTabArray, canvasRemoveTab, canvasRemoveTabs, canvasUpdateTab } from "./canvas";
import { browserCloseTabArray, browserIsValidTabUrl, browserOpenTabArray, getCurrentBrowser, onContextTabsUpdated, sendRuntimeMessage, stripTabProperties } from "./utils";
import configStore from "@/general/ConfigStore";
import { getSocket, resetConnectionAttempts } from "./socket";
import index from "./TabIndex";
import { context, setContextUrl } from "./context";
import { RUNTIME_MESSAGES } from "@/general/constants";
import { browser, getPinnedTabs } from "@/general/utils";

console.log('background.js | Initializing Canvas Browser Extension background worker');

// Initialize configuration system
(async function() {
  try {
    await configStore.init();
    console.log('background.js | Configuration initialized successfully');
  } catch (error) {
    console.error('background.js | Failed to initialize configuration:', error);
  }
})();

// Request throttling
const lastRequestTimes = new Map<string, number>();
const THROTTLE_MS = 2000; // 2 seconds

(async function () {
  const socket = await getSocket();

  // Runtime defaults
  let TabDocumentSchema: () => ITabDocumentSchema = () => {
    return {
      schema: 'data/abstraction/tab',
      data: {
        browser: getCurrentBrowser()
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
  console.log('background.js | Index initialized: ', index.counts());


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

    // Check if message is valid and has an action property
    if (!message || typeof message !== 'object') {
      console.error('background.js | Invalid message received:', message);
      sendResponse({ error: 'Invalid message format', message });
      return true;
    }

    // If message uses 'type' instead of 'action' (popup format vs background format),
    // handle it appropriately to prevent infinite loops
    if (message.type && !message.action) {
      // These are messages sent from background to UI that somehow looped back
      // Just acknowledge them without re-broadcasting to avoid loops
      console.log(`background.js | Received UI-bound message, preventing loop: ${message.type}`);
      sendResponse({ status: 'ignored', message: 'Prevented message loop' });
      return true;
    }

    console.log('background.js | Sender: ', sender);

    switch (message.action) {
      // Handle WebSocket message protocol
      case 'context:list':
        try {
          console.log('background.js | Handling context:list request');

          // Check if this is a one-time request (from ConnectionSettingsForm)
          const isOneTimeRequest = !!message.one_time;

          // To prevent loops, store state of requests by sender
          const senderId = sender?.id || 'unknown';
          const requestKey = `${senderId}:context:list`;

          // Check if we've seen this request from this sender recently
          const now = Date.now();
          const lastRequestTime = lastRequestTimes.get(requestKey) || 0;

          if (!isOneTimeRequest && now - lastRequestTime < THROTTLE_MS) {
            console.warn(`background.js | Throttling context:list request from ${senderId} - last request was ${now - lastRequestTime}ms ago`);
            sendResponse({ status: 'throttled', message: 'Request throttled, try again later' });
            return true;
          }

          // Update last request time for this sender
          lastRequestTimes.set(requestKey, now);

          // Continue with normal operation
          if (!socket || !socket.isConnected()) {
            console.warn('background.js | Socket not connected for context:list request');
            sendResponse({ status: 'error', message: 'Socket not connected' });
            return true;
          }

          console.log('background.js | Socket connected, fetching contexts with token:',
            configStore.getAll().transport.token ? `${configStore.getAll().transport.token.substring(0, 4)}...` : 'No token set');

          const contexts = await socket.listContexts();
          console.log('background.js | context:list result:', contexts);

          // Send direct response
          sendResponse({ status: 'success', payload: contexts });

          // Also broadcast to all UI components
          sendRuntimeMessage({
            type: RUNTIME_MESSAGES.user_contexts_list_updated,
            payload: contexts
          });
        } catch (error) {
          console.error('background.js | Error handling context:list:', error);
          sendResponse({ status: 'error', message: 'Failed to list contexts', error });
        }
        return true;

      // Handle connection reset
      case 'reset_connection_attempts':
        console.log('background.js | Resetting connection attempts counter');
        resetConnectionAttempts();
        sendResponse({ status: 'success', message: 'Connection attempts reset' });
        return true;

      // socket.io
      case RUNTIME_MESSAGES.socket_status:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.socket_status, payload: socket && socket.isConnected() });
        return true;

      // Config
      case RUNTIME_MESSAGES.config_get:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get, payload: configStore.getAll() });
        return true;

      case RUNTIME_MESSAGES.config_get_item:
        if (!message.key) return console.error('background.js | No config key specified');
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get, payload: configStore.getAll() });
        return true;

      case RUNTIME_MESSAGES.config_set_item:
        if (!message.key || !message.value) return console.error('background.js | No config key or value specified');
        await configStore.set(message.key, message.value);
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get, payload: configStore.getAll() });
        return true;

      case RUNTIME_MESSAGES.config_set:
        if (typeof message.value !== "object") return console.error('background.js | Invalid config', message.value);
        await configStore.update(message.value);
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get, payload: configStore.getAll() });
        return true;

      // Context
      case RUNTIME_MESSAGES.context_get:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get, payload: context });
        return true;

      case RUNTIME_MESSAGES.context_get_url:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_url, payload: context.url });
        return true;

      case RUNTIME_MESSAGES.context_get_path:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_path, payload: context.path });
        return true;

      case RUNTIME_MESSAGES.context_get_pathArray:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_pathArray, payload: context.pathArray });
        return true;

      case RUNTIME_MESSAGES.context_get_color:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_color, payload: context.color });
        return true;

      case RUNTIME_MESSAGES.context_get_tree:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_tree, payload: context.tree });
        return true;

      case RUNTIME_MESSAGES.context_set_url:
        if (message.payload && typeof message.payload.url === 'string' && context && context.id !== 'unknown') {
          const newUrl = message.payload.url;
          console.log(`background.js | UI requested context URL update to: ${newUrl} for context ${context.id}`);
          // The setContextUrl function from './context' handles server updates and local context changes.
          setContextUrl({ payload: newUrl })
            .then(() => {
              console.log(`background.js | Successfully initiated context URL update to: ${newUrl}`);
              sendResponse({ status: 'success', message: 'Context URL update initiated' });
            })
            .catch(err => {
              console.error(`background.js | Error setting context URL to ${newUrl}:`, err);
              sendResponse({ status: 'error', message: 'Failed to set context URL', error: err.message });
            });
        } else {
          console.error('background.js | Invalid payload for context_set_url:', message.payload, '. Expected { url: string } and valid context.');
          sendResponse({ status: 'error', message: 'Invalid payload for context_set_url. Expected { url: string } and active context.' });
        }
        return true; // Indicate async response

      // Additional handlers for popup messages
      case 'update:sessions:list':
        console.log('background.js | Acknowledging sessions list update request');
        sendResponse({ status: 'success', message: 'Sessions list update request received' });
        return true;

      case 'socket:event':
        console.log('background.js | Received socket:event from UI - ignoring to prevent message loops');
        // Critically important: do NOT forward socket events from UI back to the UI
        // This would create infinite message loops
        sendResponse({ status: 'success', message: 'Socket event acknowledged' });
        return true;

      case 'socket:retry':
        console.log('background.js | Socket retry request received');
        try {
          if (socket) {
            // Reset connection attempts before retrying
            resetConnectionAttempts();

            // Create a promise that will resolve with socket connection status
            const connectionPromise = new Promise((resolve) => {
              // Set up a success handler
              const connectHandler = () => {
                socket.socket.off('connect', connectHandler);
                socket.socket.off('connect_error', errorHandler);
                resolve({
                  status: 'success',
                  message: 'Socket connection successful'
                });
              };

              // Set up an error handler
              const errorHandler = (error: any) => {
                console.error('background.js | Socket reconnection error:', error);
                socket.socket.off('connect', connectHandler);
                socket.socket.off('connect_error', errorHandler);
                resolve({
                  status: 'error',
                  message: `Socket connection error: ${error?.message || 'Unknown error'}`
                });
              };

              // Listen for connection events
              socket.socket.once('connect', connectHandler);
              socket.socket.once('connect_error', errorHandler);

              // Set timeout to resolve the promise after 10 seconds
              setTimeout(() => {
                socket.socket.off('connect', connectHandler);
                socket.socket.off('connect_error', errorHandler);
                resolve({
                  status: 'pending',
                  message: 'Socket connection in progress (timeout reached)'
                });
              }, 10000);
            });

            // Initiate reconnection
            socket.reconnect();

            // Wait for the connection attempt to complete or timeout
            const result = await Promise.race([
              connectionPromise,
              new Promise(resolve => setTimeout(() => resolve({
                status: 'pending',
                message: 'Connection attempt in progress'
              }), 3000))
            ]);

            sendResponse(result);
          } else {
            sendResponse({
              status: 'error',
              message: 'Socket not initialized'
            });
          }
        } catch (error) {
          console.error('background.js | Error during socket retry:', error);
          sendResponse({
            status: 'error',
            message: `Socket retry error: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
        return true;

      // Rest of the cases remain unchanged
      case RUNTIME_MESSAGES.context_tab_remove:
        if (!message.tab) return console.error('background.js | No tab specified');
        canvasRemoveTab(message.tab).then((res: any) => {
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error removing tab from Canvas' });
          console.log('background.js | Tab removed from the current context in Canvas: ', res.data);
          sendResponse({status: 'success', data: res.data});
        }).catch(err => {
          sendResponse({status: 'error', error: err.message });
        });
        return true;

      case RUNTIME_MESSAGES.context_tabs_remove:
        if (!message.tabs) return console.error('background.js | No tab specified');
        canvasRemoveTabs(message.tabs).then((res: any) => {
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error removing tabs from Canvas' });
          console.log('background.js | Tab removed from the current context in Canvas: ', res.data);
          sendResponse({status: 'success', data: res.data});
        }).catch(err => {
          sendResponse({status: 'error', error: err.message });
        });
        return true;

      // Browser
      case RUNTIME_MESSAGES.browser_tabs_update:
        await index.updateBrowserTabs();
        sendResponse({status: 'success', counts: index.counts() });
        return true;

      case RUNTIME_MESSAGES.browser_tabs_open:
        if (message.tabs) {
          console.log('background.js | Tabs to sync: ' + message.tabs.length);
        } else {
          console.log('background.js | No tabs specified, using current browser tabs');
          message.tabs = index.getBrowserTabArray();
        }
        await browserOpenTabArray(message.tabs);
        sendResponse({status: 'success'});
        return true;

      case RUNTIME_MESSAGES.browser_tabs_close:
        if (!message.tabs) return console.error('background.js | No tabs specified');
        browserCloseTabArray(message.tabs);
        sendResponse({status: 'success'});
        break;

      // Canvas
      case RUNTIME_MESSAGES.canvas_tabs_fetch:
        if (!context || !context.id || context.id === 'unknown') {
          console.error('background.js | canvas_tabs_fetch: Cannot fetch tabs, context ID is unknown.');
          sendResponse({status: 'error', error: 'Cannot fetch tabs: Context ID is unknown'});
          return true;
        }
        canvasFetchTabsForContext(context.id).then((tabArray: any[]) => {
            if (!tabArray || !Array.isArray(tabArray)) {
                sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error fetching tabs from Canvas' });
                sendResponse({status: 'error', error: 'Error fetching tabs'});
                return;
            }
            console.log('background.js | Tabs fetched from Canvas: ', tabArray.length);

            // Process tab documents from server to ensure they have the format TabIndex expects
            if (tabArray.length) {
              // Transform the server-returned documents into the expected ICanvasTab format
              const processedTabs = tabArray.map(tab => {
                // The server returns tabs in a schema where tab properties are under 'data'
                const tabData = tab.data || {};

                return {
                  id: tabData.browserTabId || 0,
                  docId: tab.id || tab._id,
                  url: tabData.url,
                  title: tabData.title,
                  favIconUrl: tabData.favIconUrl,
                  pinned: tabData.pinned || false,
                  active: tabData.active || false,
                  highlighted: tabData.highlighted || false,
                  discarded: tabData.discarded !== false,
                  incognito: tabData.incognito || false,
                  audible: tabData.audible || false,
                  mutedInfo: tabData.mutedInfo,
                  index: tabData.browserTabIndex || 0,
                  windowId: tabData.windowId,
                  openerTabId: tabData.openerTabId,
                  width: tabData.width,
                  height: tabData.height,
                  // Add properties to satisfy ICanvasTab interface
                  selected: tabData.selected || false,
                  autoDiscardable: tabData.autoDiscardable !== false,
                  groupId: tabData.groupId || -1
                } as ICanvasTab;
              });

              console.log(`background.js | Processing ${processedTabs.length} tabs from server response`);
              index.insertCanvasTabArray(processedTabs);
            } else {
              console.log('background.js | No tabs found for context:', context.id);
            }

            sendResponse({status: 'success', payload: { data: tabArray }});
        }).catch(err => {
            console.error('background.js | Error fetching tabs:', err);
            sendResponse({status: 'error', error: err.message});
        });
        return true;

      case RUNTIME_MESSAGES.canvas_tabs_openInBrowser:
        if (message.tabs) {
          console.log('background.js | Tabs to open: ' + message.tabs.length);
        } else {
          console.log('background.js | No tabs specified, using indexed canvas tabs');
          message.tabs = index.getCanvasTabArray();
        }
        await browserOpenTabArray(message.tabs);
        index.updateBrowserTabs().then(() => {
          sendResponse({status: 'success', payload: index.counts()});
        }).catch((error) => {
          sendResponse({status: 'error', error: 'Error updating browser tabs', details: error.message });
          console.error('background.js | Error updating browser tabs:', error);
        });
        return true;

      case RUNTIME_MESSAGES.canvas_tabs_insert:
        let tabsToInsert: ICanvasTab[];
        if (message.tabs) {
          console.log('background.js | Tabs to sync: ' + message.tabs.length);
          tabsToInsert = message.tabs;
        } else {
          console.log('background.js | No tabs specified, using current browser tabs');
          tabsToInsert = index.getBrowserTabArray();
        }
        canvasInsertTabArray(tabsToInsert).then((res: ICanvasInsertResponse) => {
          if (!res || res.status === 'error') {
            sendResponse({status: 'error', error: 'Error inserting tabs to Canvas'});
            return;
          }

          // Match returned documents with sent tabs by URL
          const tabsWithDocIds = tabsToInsert.map(tab => {
            const matchingDoc = res.payload.find(p => p.meta?.url === tab.url);
            return {
              ...tab,
              docId: matchingDoc?.id
            };
          }).filter(tab => tab.docId); // Only keep tabs that got a valid docId

          console.log(`background.js | Mapped ${tabsWithDocIds.length} tabs with server-assigned docIds`);

          if (tabsWithDocIds.length) {
            index.insertCanvasTabArray(tabsWithDocIds, false);
            console.log('background.js | Tabs inserted to Canvas: ', res);
            onContextTabsUpdated({ browserTabs: { removedTabs: tabsToInsert } });
          } else {
            console.error('background.js | Failed to map any tabs with server docIds');
          }

          sendResponse({status: 'success', payload: res});
          console.log('background.js | Index updated: ', index.counts());
        }).catch((error) => {
          sendResponse({status: 'error', error: 'Error updating browser tabs', details: error.message });
          console.error('background.js | Error updating browser tabs:', error);
        });
        return true;

      case RUNTIME_MESSAGES.canvas_tab_insert:
        canvasInsertTab(message.tab).then((res: ICanvasInsertOneResponse) => {
          if (!res || res.status === 'error') {
            sendResponse({status: 'error', error: 'Error inserting the tab to Canvas'});
            return;
          }
          index.insertCanvasTab({ ...message.tab, docId: res.payload.id });
          console.log('background.js | Tab inserted to Canvas: ', res);
          onContextTabsUpdated({ browserTabs: { removedTabs: [message.tab] } });
          sendResponse({status: 'success', payload: res });
          console.log('background.js | Index updated: ', index.counts());
        }).catch((error) => {
          sendResponse({status: 'error', error: 'Error updating browser tabs', details: error.message });
          console.error('background.js | Error updating browser tabs:', error);
        });
        return true;

      case RUNTIME_MESSAGES.canvas_tab_delete:
        if (!message.tab) return console.error('background.js | No tab specified');
        canvasDeleteTab(message.tab).then((res: any) => {
          if (!res || res.status === 'error') {
            sendResponse({status: 'error', error: 'Error deleting tab from Canvas'});
            return;
          }
          sendResponse({status: 'success', payload: res });
        }).catch(err => {
          sendResponse({status: 'error', error: err.message});
        });
        return true;

      case RUNTIME_MESSAGES.canvas_tabs_delete:
        if (!message.tabs) return console.error('background.js | No tab specified');
        canvasDeleteTabs(message.tabs).then((res: any) => {
          if (!res || res.status === 'error') {
            sendResponse({status: 'error', error: 'Error deleting tab from Canvas'});
            return;
          }
          sendResponse({status: 'success', payload: res});
        }).catch(err => {
          sendResponse({status: 'error', error: err.message});
        });
        return true;

      // Index
      case RUNTIME_MESSAGES.index_get_counts:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.index_get_counts, payload: index.counts() });
        return true;

      case RUNTIME_MESSAGES.index_get_browserTabArray:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.index_get_browserTabArray, payload: index.getBrowserTabArray() });
        return true;

      case RUNTIME_MESSAGES.index_get_canvasTabArray:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.index_get_canvasTabArray, payload: index.getCanvasTabArray() });
        return true;

      case RUNTIME_MESSAGES.index_get_deltaBrowserToCanvas:
        await index.updateBrowserTabs();
        sendResponse({status: 'success', payload: index.deltaBrowserToCanvas() });
        return true;

      case RUNTIME_MESSAGES.index_get_deltaCanvasToBrowser:
        await index.updateBrowserTabs();
        sendResponse({status: 'success', payload: index.deltaCanvasToBrowser() });
        return true;

      case RUNTIME_MESSAGES.index_clear:
        sendResponse({status: 'success', payload: index.clearIndex() });
        return true;

      // Default case - handle unknown action
      default:
        console.warn(`background.js | Unknown message action: "${message.action}" from sender:`, sender);
        sendResponse({ status: 'unknown_action', message: `Unknown action: ${message.action}` });
        return true;
    }
  });

  // Initialize the socket connection and listeners
  // This will also trigger the initial fetch of contexts if authentication is successful
  // No need to call initializeSocketEventListeners() directly here, getSocket() handles it.
  // socket.initializeSocketEventListeners(); // Removed

  // Initial load of pinned tabs
})();
