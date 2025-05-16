import { canvasDeleteTab, canvasDeleteTabs, canvasFetchTabsForContext, canvasInsertTab, canvasInsertTabArray, canvasRemoveTab, canvasRemoveTabs, canvasUpdateTab } from "./canvas";
import { browserCloseTabArray, browserIsValidTabUrl, browserOpenTabArray, getCurrentBrowser, onContextTabsUpdated, sendRuntimeMessage, stripTabProperties } from "./utils";
import config from "@/general/config";
import { getSocket, resetConnectionAttempts } from "./socket";
import index from "./TabIndex";
import { context } from "./context";
import { RUNTIME_MESSAGES } from "@/general/constants";
import { browser, getPinnedTabs } from "@/general/utils";

console.log('background.js | Initializing Canvas Browser Extension background worker');

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
            config.transport.token ? `${config.transport.token.substring(0, 4)}...` : 'No token set');

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
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get, payload: config });
        return true;

      case RUNTIME_MESSAGES.config_get_item:
        if (!message.key) return console.error('background.js | No config key specified');
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get, payload: config });
        return true;

      case RUNTIME_MESSAGES.config_set_item:
        if (!message.key || !message.value) return console.error('background.js | No config key or value specified');
        await config.set(message.key, message.value);
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get, payload: config });
        return true;

      case RUNTIME_MESSAGES.config_set:
        if (typeof message.value !== "object") return console.error('background.js | Invalid config', message.value);
        await config.setMultiple(message.value);
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get, payload: config });
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
        if (socket) {
          // If a config object is provided, update the global config first
          if (message.config) {
            console.log('background.js | Updating config before socket retry:', message.config);

            // Update the token in config
            if (message.config.transport && message.config.transport.token) {
              console.log(`background.js | Using provided token for reconnection: ${message.config.transport.token.substring(0, 4)}...`);
              config.transport.token = message.config.transport.token;
              config.transport.isApiToken = !!message.config.transport.isApiToken;

              // Save the updated config
              await config.set('transport', config.transport);
            }
          }

          resetConnectionAttempts(); // Reset connection attempts before retrying
          socket.reconnect();
          sendResponse({ status: 'success', message: 'Socket reconnection attempt initiated' });
        } else {
          sendResponse({ status: 'error', message: 'Socket not initialized' });
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
        canvasFetchTabsForContext(context.id).then((res: any) => {
            if (!res || res.status === 'error') {
                sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error fetching tabs from Canvas' });
                sendResponse({status: 'error', error: 'Error fetching tabs'});
            } else {
                console.log('background.js | Tabs fetched from Canvas: ', res.data);
                index.insertCanvasTabArray(res.data);
                sendResponse({status: 'success', payload: res});
            }
        }).catch(err => {
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
          index.insertCanvasTabArray(tabsToInsert.map((tab: ICanvasTab) => ({ ...tab, docId: res.payload.find(p => p.meta.url === tab.url)?.id })), false);
          console.log('background.js | Tabs inserted to Canvas: ', res);
          onContextTabsUpdated({ browserTabs: { removedTabs: tabsToInsert } });
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
