import { canvasDeleteTab, canvasFetchTabsForContext, canvasInsertData, canvasInsertTabArray, canvasRemoveTab, canvasUpdateTab, formatTabProperties } from "./canvas";
import { browser, browserCloseTabArray, browserIsValidTabUrl, browserOpenTabArray, onContextTabsUpdated, sendRuntimeMessage, stripTabProperties } from "./utils";
import config from "@/general/config";
import { getSocket, updateLocalCanvasTabsData } from "./socket";
import index from "./TabIndex";
import { context } from "./context";
import { RUNTIME_MESSAGES, SOCKET_MESSAGES } from "@/general/constants";

console.log('background.js | Initializing Canvas Browser Extension background worker');

(async function () {
  const socket = await getSocket();

  // Runtime defaults
  let TabDocumentSchema: ITabDocumentSchema = {
    type: 'data/abstraction/tab',
    meta: {},
    data: {}
  };

  let watchTabProperties = {
    properties: [
      "url",
      "hidden",
      "pinned",
      "mutedInfo"
    ]
  };

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
    if (!Object.keys(changeInfo).some(cik => watchTabProperties.properties.some(wtpk => cik === wtpk)))
      return;

    if(changeInfo.status === "complete" && config.sync.autoSyncBrowserTabs === "Always") {
      index.updateBrowserTabs();
      // Update backend
      console.log(`background.js | Tab ID ${tabId} changed, sending update to backend`);
      const res = await canvasInsertTabArray([tab]);
      if (res.status === "success") {
        console.log(`background.js | Tab ${tabId} inserted/updated: `, res);
        index.insertCanvasTab({ ...tab, docId: res.payload[0].id });
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.index_get_deltaCanvasToBrowser, payload: index.deltaCanvasToBrowser() });
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.index_get_deltaBrowserToCanvas, payload: index.deltaBrowserToCanvas() });
      } else {
        console.error(`background.js | Insert failed for tab ${tabId}:`)
        console.error(res);
      }
    }

    // Trigger on url change if the tab url is valid
    if (changeInfo.url && browserIsValidTabUrl(changeInfo.url)) {
      index.updateBrowserTabs();

      if(config.sync.autoSyncBrowserTabs === "Always") {
        const oldUrl = index.browserTabIdToUrl.get(tabId);
        const newUrl = changeInfo.url;
        if(oldUrl === newUrl) return;
        const canvasTab = index.canvasTabs.get(index.browserTabIdToUrl.get(tabId));
        canvasRemoveTab(canvasTab);
      }
    }
  })

  browser.tabs.onMoved.addListener((tabId, moveInfo) => {
    console.log('background.js | Tab moved: ', tabId, moveInfo);

    // Update the current index
    index.updateBrowserTabs();

    // noop
    //console.log('background.js | TODO: Disabled as we currently do not track move changes');
    //return;

    browser.tabs.get(tabId).then(async tab => {
      let tabDocument = TabDocumentSchema
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
  const browserAction = chrome.action || chrome.browserAction;
  browserAction.onClicked.addListener((tab: chrome.tabs.Tab) => {
    console.log('background.js | Browser action clicked: ', tab, socket.isConnected());

    // Ignore non-valid tabs(about:*, empty tabs etc)
    if (!tab.url || !browserIsValidTabUrl(tab.url)) return

    // Update the current index
    index.updateBrowserTabs();

    // Update our backend
    let tabDocument = TabDocumentSchema
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

    // Lets fetch the tab based on ID from our index
    // This is needed as the tab object is not available after removal
    let tab = index.getBrowserTabByID(tabId);
    if (!tab) return console.log(`background.js | Tab ${tabId} not found in index`);

    console.log('background.js | Tab object URL from index: ', tab.url);

    // Update the current index (remove tab), maybe we should move it in the callback?
    index.updateBrowserTabs();

    // TODO: Will be removed, as internal Index will have a stripTabProperties method
    let tabDocument = TabDocumentSchema
    tabDocument.data = stripTabProperties(tab)

    // Send update to backend
    if(config.sync.autoSyncBrowserTabs === "Always")
      await canvasRemoveTab(tab);
  });


  /**
   * UI Message Handlers
   */

  browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log('background.js | UI Message received: ', message);

    switch (message.action) {

      // socket.io
      case RUNTIME_MESSAGES.socket_status:
        console.log({ socket });
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.socket_status, payload: socket && socket.isConnected() });
        break;

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

      case RUNTIME_MESSAGES.context_set_url:
        if (!message.url) return console.error('background.js | No context url specified');
        canvasInsertData(SOCKET_MESSAGES.CONTEXT.SET_URL, message.url).then((res: any) => {
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error setting context url' });
          console.log('background.js | Context url set: ', res.data)
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_set_url, payload: res });
        });
        break;

      case RUNTIME_MESSAGES.context_tab_remove:
        if (!message.tab) return console.error('background.js | No tab specified');
        canvasRemoveTab(message.tab).then((res: any) => {
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error removing tab from Canvas' });
          console.log('background.js | Tab removed from the current context in Canvas: ', res.data);
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.index_get_deltaCanvasToBrowser, payload: index.deltaCanvasToBrowser() });
          // sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_tab_remove, payload: res });
        });
        break;

      // Browser
      case RUNTIME_MESSAGES.browser_tabs_update:
        return Promise.resolve(index.updateBrowserTabs());
        break;

      case RUNTIME_MESSAGES.browser_tabs_open:
        if (message.tabs) {
          console.log('background.js | Tabs to sync: ' + message.tabs.length);
        } else {
          console.log('background.js | No tabs specified, using current browser tabs');
          message.tabs = index.getBrowserTabArray();
        }

        browserOpenTabArray(message.tabs);
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

        browserOpenTabArray(message.tabs)
        index.updateBrowserTabs().then(() => {
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.canvas_tabs_openInBrowser, payload: index.counts() });
        }).catch((error) => {
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error updating browser tabs'});
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
          console.log(res, tabs);
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error inserting tabs to Canvas' });
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.success_message, payload: 'Tabs inserted to Canvas'});
          index.insertCanvasTabArray(tabs.map((tab: ICanvasTab) => ({ ...tab, docId: res.payload.find(p => p.meta.url === tab.url)?.id })), false);
          console.log('background.js | Tabs inserted to Canvas: ', res);
          onContextTabsUpdated({ browserTabs: { removedTabs: tabs } });
          // updateLocalCanvasTabsData();

          sendRuntimeMessage({ type: RUNTIME_MESSAGES.canvas_tabs_insert, payload: res });
          console.log('background.js | Index updated: ', index.counts());
        }).catch((error) => {
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.canvas_tabs_insert, payload: false });
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error updating browser tabs'});
          console.error('background.js | Error updating browser tabs:', error);
        })

        break;

      case RUNTIME_MESSAGES.canvas_tab_delete:
        if (!message.tab) return console.error('background.js | No tab specified');
        canvasDeleteTab(message.tab).then((res: any) => {
          if (!res || res.status === 'error') return sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error deleting tab from Canvas' });
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.success_message, payload: 'Tab deleted from Canvas'});
          // sendRuntimeMessage({ type: RUNTIME_MESSAGES.canvas_tab_delete, payload: res });
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

      case RUNTIME_MESSAGES.index_updateBrowserTabs:

        break;

      case RUNTIME_MESSAGES.index_clear:
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.index_clear, payload: index.clearIndex() });
        break;

      case RUNTIME_MESSAGES.socket_retry:
        socket.initializeSocket();
        break;

      default:
        console.error(`background.js | Unknown message action: ${message.action}`);
        break;

    }

  });
})();