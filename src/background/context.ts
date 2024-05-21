import config from "@/general/config";
import index from "./TabIndex";
import { canvasFetchTabsForContext, canvasInsertTabArray, documentInsertTabArray } from "./canvas";
import { handleContextChangeTabUpdates, browserOpenTabArray, sendRuntimeMessage } from "./utils";
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
  if(context.url === url.payload) {
    console.error("SERVER IS SENDING CONTEXT CHANGE MULTIPLE TIMES...");
    return;
  }
  const previousContextUrl = context.url;
  context.url = url.payload;

  const previousContextTabsArray = index.getCanvasTabArray();

  await index.updateBrowserTabs();

  let res: any = await canvasFetchTabsForContext();
  index.insertCanvasTabArray(res.data);

  const pinnedTabs = await getPinnedTabs();

  switch(config.sync.tabBehaviorOnContextChange) {
    case "Close": {
      // Automatically close existing tabs that are outside of context
      await handleContextChangeTabUpdates(previousContextTabsArray, pinnedTabs);
      break;
    }
    case "Save and Close": {
      await handleContextChangeTabUpdates(previousContextTabsArray, pinnedTabs, previousContextUrl);
      break;
    }
    case "Keep": {
      // do nothing
    }
  }


  if (config.sync.autoOpenCanvasTabs) {
    // Automatically open new canvas tabs
    await browserOpenTabArray(index.getCanvasTabArray().filter(({ url }) => !pinnedTabs.some(u => u === url)));
  }

  // Try to update the UI (might not be loaded(usually the case))
  contextUrlChanged();
}

export const contextUrlChanged = () => {
  sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_url, payload: context.url });
}