import { canvasDeleteTab, canvasDeleteTabs, canvasFetchTabsForContext, canvasInsertTab, canvasInsertTabArray, canvasRemoveTab, canvasRemoveTabs, canvasUpdateTab } from "./canvas";
import { browserCloseTabArray, browserIsValidTabUrl, browserOpenTabArray, getCurrentBrowser, onContextTabsUpdated, sendRuntimeMessage, stripTabProperties } from "./utils";
import config from "@/general/config";
import { getSocket } from "./socket";
import index from "./TabIndex";
import { context } from "./context";
import { RUNTIME_MESSAGES } from "@/general/constants";
import { browser, getPinnedTabs } from "@/general/utils";
import { updateSessionsList } from "./session";

console.log('background.js | Initializing Canvas Browser Extension background worker');

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

    switch (message.action) {

      // socket.io
      case RUNTIME_MESSAGES.socket_status:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.socket_status, payload: socket && socket.isConnected() });
        break;

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
                resolve({ status: 'success' });
              }
            }, 100);

            // Timeout after 5 seconds
            setTimeout(() => {
              clearInterval(checkConnection);
              resolve({ status: 'error', message: 'Connection timeout' });
            }, 5000);
          });
        } catch (error: any) {
          console.error('background.js | Error retrying socket connection:', error);
          return Promise.resolve({ status: 'error', message: error?.message || 'Failed to retry connection' });
        }

      // Config
      case RUNTIME_MESSAGES.config_get:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get, payload: config });
        break;

      case RUNTIME_MESSAGES.config_get_item:
        if (!message.key) return console.error('background.js | No config key specified');
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get, payload: config });
        break;

      case RUNTIME_MESSAGES.config_set_item:
        if (!message.key || !message.value) return console.error('background.js | No config key or value specified');
        await config.set(message.key, message.value);
        config[message.key] = message.value;
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get, payload: config });
        break;

      case RUNTIME_MESSAGES.config_set:
        if (typeof message.value !== "object") return console.error('background.js | Invalid config', message.value);
        await config.setMultiple(message.value);
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.config_get, payload: config });
        break;

      // Context
      case RUNTIME_MESSAGES.context_get:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get, payload: context });
        break;

      case RUNTIME_MESSAGES.context_get_url:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_url, payload: context.url });
        break;

      case RUNTIME_MESSAGES.context_get_path:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_path, payload: context.path });
        break;

      case RUNTIME_MESSAGES.context_get_pathArray:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_pathArray, payload: context.pathArray });
        break;

      case RUNTIME_MESSAGES.context_get_color:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_color, payload: context.color });
        break;

      case RUNTIME_MESSAGES.context_get_tree:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_tree, payload: context.tree });
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
      case RUNTIME_MESSAGES.canvas_tabs_fetch:
        const res: any = await canvasFetchTabsForContext();
        if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error fetching tabs from Canvas' });
        console.log('background.js | Tabs fetched from Canvas: ', res.data);
        index.insertCanvasTabArray(res.data);
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.canvas_tabs_fetch, payload: res });
        break;

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
          console.log('background.js | No tabs specified, using current browser tabs');
          tabs = index.getBrowserTabArray();
        }

        canvasInsertTabArray(tabs).then((res: ICanvasInsertResponse) => {
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error inserting tabs to Canvas' });
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.success_message, payload: 'Tabs inserted to Canvas' });
          index.insertCanvasTabArray(tabs.map((tab: ICanvasTab) => ({ ...tab, docId: res.payload.find(p => p.meta.url === tab.url)?.id })), false);
          console.log('background.js | Tabs inserted to Canvas: ', res);
          onContextTabsUpdated({ browserTabs: { removedTabs: tabs } });
          // updateLocalCanvasTabsData();

          sendRuntimeMessage({ type: RUNTIME_MESSAGES.canvas_tabs_insert, payload: res });
          console.log('background.js | Index updated: ', index.counts());
        }).catch((error) => {
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.canvas_tabs_insert, payload: false });
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error updating browser tabs' });
          console.error('background.js | Error updating browser tabs:', error);
        })

        break;

      case RUNTIME_MESSAGES.canvas_tab_insert:
        canvasInsertTab(message.tab).then((res: ICanvasInsertOneResponse) => {
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error inserting the tab to Canvas' });
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.success_message, payload: 'The tab inserted to Canvas' });
          index.insertCanvasTab({ ...message.tab, docId: res.payload.id });
          console.log('background.js | Tab inserted to Canvas: ', res);
          onContextTabsUpdated({ browserTabs: { removedTabs: [message.tab] } });

          sendRuntimeMessage({ type: RUNTIME_MESSAGES.canvas_tab_insert, payload: res });
          console.log('background.js | Index updated: ', index.counts());
        }).catch((error) => {
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.canvas_tab_insert, payload: false });
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error updating browser tabs' });
          console.error('background.js | Error updating browser tabs:', error);
        })

        break;

      case RUNTIME_MESSAGES.canvas_tab_delete:
        if (!message.tab) return console.error('background.js | No tab specified');
        canvasDeleteTab(message.tab).then((res: any) => {
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error deleting tab from Canvas' });
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.success_message, payload: 'Tab deleted from Canvas' });
        });
        break;

      case RUNTIME_MESSAGES.canvas_tabs_delete:
        if (!message.tabs) return console.error('background.js | No tab specified');
        canvasDeleteTabs(message.tabs).then((res: any) => {
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error deleting tab from Canvas' });
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.success_message, payload: 'Tab deleted from Canvas' });
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
        updateSessionsList();
        break;

      default:
        console.error(`background.js | Unknown message action: ${message.action}`);
        break;

    }

  });
})();
