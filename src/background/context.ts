import config from "@/general/config";
import index from "./TabIndex";
import { canvasFetchTabsForContext } from "./canvas";
import { handleContextChangeTabUpdates, browserOpenTabArray, sendRuntimeMessage } from "./utils";
import { RUNTIME_MESSAGES } from "@/general/constants";
import { getPinnedTabs } from "@/general/utils";

const DEFAULT_URL = 'universe:///';

export let context: IContext = {
  url: DEFAULT_URL,
  contextBitmapArray: [],
  color: '#fff',
};

export const updateContext = (ctx: IContext | undefined) => {
  if (!ctx) {
    context.url = DEFAULT_URL;
    context.color = '#fff';
    context.contextBitmapArray = [];
    delete context.path;
    delete context.pathArray;
    delete context.tree;
    contextUrlChanged();
    return;
  }

  context.url = typeof ctx.url === "string" ? ctx.url : DEFAULT_URL;
  console.log("updating context", ctx);
  context.color = ctx.color || "#fff";
  context.contextBitmapArray = ctx.contextBitmapArray || [];

  if (ctx.path) context.path = ctx.path;
  else delete context.path;

  if (ctx.pathArray) context.pathArray = ctx.pathArray;
  else delete context.pathArray;

  if (ctx.tree) context.tree = ctx.tree;
  else delete context.tree;

  contextUrlChanged();
};

export const setContext = async (ctx: { payload: IContext }) => {
  console.log("RECEIVED CONTEXT UPDATE", ctx);
  updateContext(ctx.payload);
  setContextUrl({ payload: context.url });
}

export const setContextUrl = async (url: { payload: string }) => {
  console.log('background.js | [socket.io] Received context URL update: ', url);
  const previousContextIdArray = context.contextBitmapArray;
  context.url = url.payload;

  const previousContextTabsArray = index.getCanvasTabArray();

  await index.updateBrowserTabs();

  try {
    let res: any = await canvasFetchTabsForContext();
    if (res && res.data) {
      index.insertCanvasTabArray(res.data);
    }

    const pinnedTabs = await getPinnedTabs();

    switch(config.sync.tabBehaviorOnContextChange) {
      case "Close": {
        // Automatically close existing tabs that are outside of context
        await handleContextChangeTabUpdates(previousContextTabsArray, pinnedTabs);
        break;
      }
      case "Save and Close": {
        await handleContextChangeTabUpdates(previousContextTabsArray, pinnedTabs, previousContextIdArray);
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
  } catch (error) {
    console.error('Error updating context:', error);
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.error_message,
      payload: 'Error updating context'
    });
  }

  // Try to update the UI (might not be loaded(usually the case))
  contextUrlChanged();
}

export const contextUrlChanged = () => {
  sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_url, payload: context.url });
}
