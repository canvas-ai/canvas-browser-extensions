import { canvasDeleteTab, canvasFetchTabsForContext, canvasInsertData, canvasInsertTab, canvasInsertTabArray, canvasRemoveTab, canvasUpdateTab, formatTabProperties } from "./canvas";
import { browserCloseTabArray, browserIsValidTabUrl, browserOpenTabArray, onContextTabsUpdated, stripTabProperties } from "./utils";
import config from "@/general/config";
import { getSocket } from "./socket";
import index from "./TabIndex";
import { context } from "./context";

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

  chrome.tabs.onCreated.addListener((tab) => {
    // noop, we need to wait for the onUpdated event to get the url
    console.log(`background.js | Tab created: ${tab.id}`);
  })

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    console.log('background.js | Tab updated: ', tabId, changeInfo, tab);

    // Check if the changed properties matters
    if (!Object.keys(changeInfo).some(cik => watchTabProperties.properties.some(wtpk => cik === wtpk)))
      return;

    // Trigger on url change if the tab url is valid
    if (changeInfo.url && browserIsValidTabUrl(changeInfo.url)) {

      // Update the current index
      index.updateBrowserTabs().then(() => {
        console.log('background.js | Index updated: ', index.counts());
      });

      // Update backend
      console.log(`background.js | Tab ID ${tabId} changed, sending update to backend`)

      const tabs = index.getCanvasTabArray();
      if(
          config.sync.autoSyncBrowserTabs === "Always" ||
          tabs.some(tab => tab.id === tabId) // update if its already synced
      ) {
        let tabDocument = formatTabProperties(tab);
        const res: any = await canvasInsertTab(tabDocument);
        if (res.status === "success") {
          console.log(`background.js | Tab ${tabId} inserted: `, res);
          index.insertCanvasTab(tab);
        } else {
          console.error(`background.js | Insert failed for tab ${tabId}:`)
          console.error(res);
        }  
      }
    }
  })

  chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
    console.log('background.js | Tab moved: ', tabId, moveInfo);

    // Update the current index
    index.updateBrowserTabs().then(() => {
      console.log('background.js | Index updated: ', index.counts());
    });

    // noop
    //console.log('background.js | TODO: Disabled as we currently do not track move changes');
    //return;

    chrome.tabs.get(tabId).then(async tab => {
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
  chrome.action.onClicked.addListener((tab: chrome.tabs.Tab) => {
    console.log('background.js | Browser action clicked: ', tab, socket.isConnected());

    // Ignore non-valid tabs(about:*, empty tabs etc)
    if (!tab.url || !browserIsValidTabUrl(tab.url)) return

    // Update the current index
    index.updateBrowserTabs().then(() => {
      console.log('background.js | Index updated: ', index.counts());
    });

    // Update our backend
    let tabDocument = TabDocumentSchema
    tabDocument.data = stripTabProperties(tab);

    canvasUpdateTab(tabDocument).then((res: any) => {
      if (res.status === "success") {
        console.log(`background.js | Tab ${tab.id} updated: `, res);
        index.insertCanvasTab(tab)
      } else {
        console.error(`background.js | Update failed for tab ${tab.id}:`)
        console.error(res);
      }
    });

  });

  chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    console.log('background.js | Tab removed: ', tabId, removeInfo);

    // Lets fetch the tab based on ID from our index
    // This is needed as the tab object is not available after removal
    let tab = index.getBrowserTabByID(tabId);
    if (!tab) return console.log(`background.js | Tab ${tabId} not found in index`);

    console.log('background.js | Tab object URL from index: ', tab.url);

    // Update the current index (remove tab), maybe we should move it in the callback?
    index.updateBrowserTabs().then(() => {
      console.log('background.js | Index updated: ', index.counts());
    });

    // TODO: Will be removed, as internal Index will have a stripTabProperties method
    let tabDocument = TabDocumentSchema
    tabDocument.data = stripTabProperties(tab)

    // Send update to backend
    if(config.sync.autoSyncBrowserTabs === "Always")
      await canvasDeleteTab(tab);
  });


  /**
   * UI Message Handlers
   */

  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log('background.js | UI Message received: ', message);

    switch (message.action) {

      // socket.io
      case 'socket:status':
        console.log({ socket });
        sendResponse(socket && socket.isConnected());
        break;

      // Config
      case 'config:get':
        sendResponse(config);
        break;

      case 'config:get:item':
        if (!message.key) return console.error('background.js | No config key specified');
        sendResponse(config[message.key]);
        break;

      case 'config:set:item':
        if (!message.key || !message.value) return console.error('background.js | No config key or value specified');
        await config.set(message.key, message.value);
        config[message.key] = message.value;
        sendResponse(config[message.key]);
        break;

      // Context
      case 'context:get':
        sendResponse(context);
        break;

      case 'context:get:url':
        sendResponse(context.url);
        break;

      case 'context:get:path':
        sendResponse(context.path);
        break;

      case 'context:get:pathArray':
        sendResponse(context.pathArray);
        break;

      case 'context:get:color':
        sendResponse(context.color);
        break;

      case 'context:get:tree':
        sendResponse(context.tree);
        break;

      case 'context:set:url':
        if (!message.url) return console.error('background.js | No context url specified');
        canvasInsertData('context:set:url', message.url).then((res: any) => {
          if (!res || res.status === 'error') return console.error('background.js | Error setting context url')
          console.log('background.js | Context url set: ', res.data)
          sendResponse(res);
        });
        break;

      case 'context:tab:remove':
        if (!message.tab) return console.error('background.js | No tab specified');
        canvasRemoveTab(message.tab).then((res: any) => {
          if (!res || res.status === 'error') return console.error('background.js | Error removing tab from Canvas')
          console.log('background.js | Tab removed from the current context in Canvas: ', res.data)
          sendResponse(res);
        });
        break;

      // Browser
      case 'browser:tabs:update':
        return Promise.resolve(index.updateBrowserTabs());
        break;

      case 'browser:tabs:open':
        if (message.tabs) {
          console.log('background.js | Tabs to sync: ' + message.tabs.length);
        } else {
          console.log('background.js | No tabs specified, using current browser tabs');
          message.tabs = index.getBrowserTabArray();
        }

        browserOpenTabArray(message.tabs);
        break;

      case 'browser:tabs:close':
        if (!message.tabs) return console.error('background.js | No tabs specified');
        browserCloseTabArray(message.tabs);
        break;

      // Canvas
      case 'canvas:tabs:fetch':
        const res: any = await canvasFetchTabsForContext();
        if (!res || res.status === 'error') return console.error('background.js | Error fetching tabs from Canvas')
        console.log('background.js | Tabs fetched from Canvas: ', res.data)
        index.insertCanvasTabArray(res.data);
        sendResponse(res);
        break;

      case 'canvas:tabs:openInBrowser':
        if (message.tabs) {
          console.log('background.js | Tabs to open: ' + message.tabs.length);
        } else {
          console.log('background.js | No tabs specified, using indexed canvas tabs');
          message.tabs = index.getCanvasTabArray();
        }

        browserOpenTabArray(message.tabs)
        index.updateBrowserTabs().then(() => {
          sendResponse(index.counts());
        }).catch((error) => {
          console.error('background.js | Error updating browser tabs:', error);
        });
        break;

      case 'canvas:tabs:insert':
        let tabs;
        if (message.tabs) {
          console.log('background.js | Tabs to sync: ' + message.tabs.length);
          tabs = message.tabs;
        } else {
          console.log('background.js | No tabs specified, using current browser tabs');
          tabs = index.getBrowserTabArray();
        }


        canvasInsertTabArray(tabs).then((res: any) => {
          if (!res || res.status === 'error') return console.error('background.js | Error inserting tabs to Canvas')
          console.log('background.js | Tabs inserted to Canvas: ', res);

          index.insertCanvasTabArray(tabs);
          onContextTabsUpdated({ browserTabs: { removedTabs: tabs } });
          sendResponse(res);
          console.log('background.js | Index updated: ', index.counts());
        }).catch((error) => {
          sendResponse(false);
          console.error('background.js | Error updating browser tabs:', error);
        })

        break;

      case 'canvas:tab:delete':
        if (!message.tab) return console.error('background.js | No tab specified');
        canvasDeleteTab(message.tab).then((res: any) => {
          if (!res || res.status === 'error') return console.error('background.js | Error deleting tab from Canvas');
          index.removeCanvasTab(message.tab.url);
          console.log('background.js | Tab deleted from Canvas: ', res.data)
          sendResponse(res);
        });
        break;

      // Index
      case 'index:get:counts':
        sendResponse(index.counts());
        break;

      case 'index:get:browserTabArray':
        sendResponse(index.getBrowserTabArray());
        break;

      case 'index:get:canvasTabArray':
        sendResponse(index.getCanvasTabArray());
        break;

      case 'index:get:deltaBrowserToCanvas':
        index.updateBrowserTabs().then(() => {
          console.log('background.js | Index updated: ', index.counts());
          sendResponse(index.counts());
        });
        sendResponse(index.deltaBrowserToCanvas());
        break;

      case 'index:get:deltaCanvasToBrowser':
        index.updateBrowserTabs().then(() => {
          console.log('background.js | Index updated: ', index.counts());
          sendResponse(index.counts());
        });
        sendResponse(index.deltaCanvasToBrowser());
        break;

      case 'index:updateBrowserTabs':

        break;

      case 'index:clear':
        sendResponse(index.clearIndex());
        break;

      case 'socket:retry':
        socket.initializeSocket();
        break;

      default:
        console.error(`background.js | Unknown message action: ${message.action}`);
        break;

    }

  });
})();