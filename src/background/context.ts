import config from "@/general/config";
import index from "./TabIndex";
import { canvasFetchTabsForContext, canvasInsertTabArray } from "./canvas";
import { browserCloseNonContextTabs, browserOpenTabArray } from "./utils";
import { RUNTIME_MESSAGES } from "@/general/constants";
import { browser, getPinnedTabs } from "@/general/utils";

const DEFAULT_URL = 'universe:///';

export let context: IContext = {
  url: DEFAULT_URL,
  color: '#fff',
};

export const updateContext = (ctx: IContext | undefined) => {
  context.color = ctx?.color || "#fff";
  context.url = typeof ctx?.url === "string" ? ctx.url : DEFAULT_URL;
  if(ctx?.path) context.path = ctx.path;
  else delete context.path;
  if(ctx?.pathArray) context.pathArray = ctx.pathArray;
  else delete context.pathArray;
  if(ctx?.tree) context.tree = ctx.tree;
  else delete context.tree;
  contextUrlChanged();
};

export const setContextUrl = async (url) => {
  console.log('background.js | [socket.io] Received context URL update: ', url);
  context.url = url.payload;

  let res: any = await canvasFetchTabsForContext();
  await index.updateBrowserTabs();

  index.insertCanvasTabArray(res.data);
  const pinnedTabs = await getPinnedTabs();
  
  if (config.sync.autoBrowserTabsSync !== "Never") {
    const tabs = index.getBrowserTabArray();
    canvasInsertTabArray(tabs.filter(({ url }) => !pinnedTabs.some(u => u === url))).then((res: any) => {
      if (!res || res.status === 'error') return console.error('background.js | Error inserting tabs to Canvas')
      console.log('background.js | Tabs auto-inserted to Canvas: ', res);
    }).catch((error) => {
      console.error('background.js | Error updating browser tabs:', error);
    })
  }

  if (config.sync.autoOpenCanvasTabs) {
    // Automatically open new canvas tabs
    await browserOpenTabArray(index.getCanvasTabArray().filter(({ url }) => !pinnedTabs.some(u => u === url)));
  }

  switch(config.sync.tabBehaviorOnContextChange) {
    case "Close": {
      // Automatically close existing tabs that are outside of context
      await browserCloseNonContextTabs();
      break;
    }
    case "Save and Close": {
      await browserCloseNonContextTabs(async (tabsToRemove) => {
        try {
          const res = await canvasInsertTabArray(tabsToRemove);
          if (!res || res.status === 'error') return console.error('background.js | Error inserting tabs to Canvas')
          console.log('background.js | Tabs auto-inserted to Canvas: ', res);
        } catch (error) {
          console.error('background.js | Error updating browser tabs:', error);
        }
      })
      break;
    }
    case "Keep": {
      // do nothing
    }
  }

  // Try to update the UI (might not be loaded(usually the case))
  contextUrlChanged();
}

export const contextUrlChanged = () => {
  browser.runtime.sendMessage({ type: RUNTIME_MESSAGES.context_get_url, payload: context.url }, (response) => {
    if (browser.runtime.lastError) {
      console.log(`background.js | Unable to connect to UI, error: ${browser.runtime.lastError}`);
    } else {
      console.log('background.js | Message to UI sent successfully');
    }
  });
}