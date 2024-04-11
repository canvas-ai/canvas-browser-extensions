import config from "@/general/config";
import index from "./TabIndex";
import { canvasFetchTabsForContext, canvasInsertTabArray } from "./canvas";
import { browserOpenTabArray } from "./utils";

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

  // Automatically close existing tabs if enabled
  // if (config.sync.autoCloseTabs) await browserCloseNonContextTabs();

  if (config.sync.autoSyncBrowserTabs !== "Never") {
    const tabs = index.getBrowserTabArray();
    canvasInsertTabArray(tabs).then((res: any) => {
      if (!res || res.status === 'error') return console.error('background.js | Error inserting tabs to Canvas')
      console.log('background.js | Tabs auto-inserted to Canvas: ', res);
    }).catch((error) => {
      console.error('background.js | Error updating browser tabs:', error);
    })
  }

  // Automatically open new canvas tabs if enabled
  if (config.sync.autoOpenCanvasTabs === "On Context Change")
    await browserOpenTabArray(index.getCanvasTabArray());

  // Try to update the UI (might not be loaded(usually the case))
  contextUrlChanged();
}

export const contextUrlChanged = () => {
  chrome.runtime.sendMessage({ type: 'context:url', data: context.url }, (response) => {
    if (chrome.runtime.lastError) {
      console.log(`background.js | Unable to connect to UI, error: ${chrome.runtime.lastError}`);
    } else {
      console.log('background.js | Message to UI sent successfully');
    }
  });
}