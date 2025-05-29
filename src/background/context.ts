import config from "@/general/config";
import index from "./TabIndex";
import { requestFetchTabsForContext } from "./canvas";
import { handleContextChangeTabUpdates, browserOpenTabArray, sendRuntimeMessage } from "./utils";
import { RUNTIME_MESSAGES } from "@/general/constants";
import { getPinnedTabs, browser } from "@/general/utils";

const DEFAULT_URL = 'universe:///';

// Helper function to get the current context from storage
const getCurrentContext = async (): Promise<IContext | null> => {
  const selectedContext = await browser.storage.local.get(["CNVS_SELECTED_CONTEXT"]);
  if (selectedContext.CNVS_SELECTED_CONTEXT) {
    return selectedContext.CNVS_SELECTED_CONTEXT;
  }

  const contexts = await browser.storage.local.get(["contexts"]);
  return contexts.contexts?.[0] || null;
};

// Helper function to save the current context to storage
const saveCurrentContext = async (ctx: IContext) => {
  await browser.storage.local.set({
    CNVS_CONTEXT: ctx,
    CNVS_SELECTED_CONTEXT: ctx
  });
};

export const updateContext = async (ctx: IContext | undefined) => {
  if (!ctx) {
    const defaultContext: IContext = {
      id: 'default',
      userId: 'default',
      url: DEFAULT_URL,
      color: '#fff',
      contextBitmapArray: []
    };
    await saveCurrentContext(defaultContext);
    contextUrlChanged();
    return;
  }

  const updatedContext: IContext = {
    ...ctx,
    url: typeof ctx.url === "string" ? ctx.url : DEFAULT_URL,
    color: ctx.color || "#fff",
    contextBitmapArray: ctx.contextBitmapArray || []
  };

  console.log("updating context", updatedContext);
  await saveCurrentContext(updatedContext);
  contextUrlChanged();
};

export const setContext = async (ctx: { payload: IContext }) => {
  console.log("RECEIVED CONTEXT UPDATE", ctx);
  await updateContext(ctx.payload);
  const currentContext = await getCurrentContext();
  if (currentContext) {
    setContextUrl({ payload: currentContext.url });
  }
}

export const setContextUrl = async (url: { payload: string }) => {
  console.log('background.js | [socket.io] Received context URL update: ', url);

  const currentContext = await getCurrentContext();
  const previousContextIdArray = currentContext?.contextBitmapArray || [];

  // Update the context with new URL
  if (currentContext) {
    const updatedContext = { ...currentContext, url: url.payload };
    await saveCurrentContext(updatedContext);
  }

  const previousContextTabsArray = index.getCanvasTabArray();

  await index.updateBrowserTabs();

  try {
    console.log('background.js | Fetching tabs for new context...');
    requestFetchTabsForContext().then(async (tabs) => {
      if (tabs && tabs.length > 0) {
        console.log(`background.js | Received ${tabs.length} tabs for new context`);
        // Use silent method first to update storage, then trigger UI update
        index.insertCanvasTabArraySilent(tabs, true);
        // Now update browser tabs to recalculate sync status and notify UI
        await index.updateBrowserTabs();
      } else {
        console.log('background.js | No tabs found for new context - clearing canvas tabs');
        // Clear canvas tabs if no data received or empty array
        index.clearCanvasTabs();
        // Also update browser tabs to recalculate sync status
        await index.updateBrowserTabs();
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

      // Send success message to popup
      sendRuntimeMessage({
        type: RUNTIME_MESSAGES.success_message,
        payload: 'Context switched successfully'
      });

      console.log('background.js | Context switch completed successfully');
    });
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

export const contextUrlChanged = async () => {
  const currentContext = await getCurrentContext();
  sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_get_url, payload: currentContext?.url || DEFAULT_URL });
}
