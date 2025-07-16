import config from "@/general/config";
import index from "./TabIndex";
import { documentInsertTabArray, formatTabProperties, requestFetchTabsForContext, canvasFetchContext } from "./canvas";
import { handleContextChangeTabUpdates, browserOpenTabArray, sendRuntimeMessage, onContextTabsUpdated, genFeatureArray } from "./utils";
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

// Save context to storage
const saveCurrentContext = async (ctx: IContext) => {
  await browser.storage.local.set({
    CNVS_CONTEXT: ctx,
    CNVS_SELECTED_CONTEXT: ctx
  });
  console.log('background.js | Context saved to storage:', ctx);
};

export const updateContext = async (ctx: IContext | undefined) => {
  if (!ctx) {
    console.log('background.js | No context provided for update');
    return;
  }

  console.log('background.js | Updating context:', ctx);

  // Save to storage
  await saveCurrentContext(ctx);

  // Update config with new context URL
  await config.load();
  await config.set('transport', {
    ...config.transport,
    pinToContext: ctx.url || DEFAULT_URL
  });

  // Trigger context URL change handling
  await setContextUrl({ payload: ctx.url || DEFAULT_URL });
};

export const setContext = async (ctx: { payload: IContext }) => {
  console.log("RECEIVED CONTEXT UPDATE", ctx);
  await updateContext(ctx.payload);
  const currentContext = await getCurrentContext();
  if (currentContext) {
    setContextUrl({ payload: currentContext.url });
  }
};

export const saveTabsToPreviousContext = async (tabArray: ICanvasTab[], previousContextIdArray: string[] | null = null): Promise<ICanvasInsertResponse> => {
  console.log('background.js | [CONTEXT] Saving tabs to previous context:', tabArray.length);

  if (!tabArray || tabArray.length === 0) {
    console.log('background.js | [CONTEXT] No tabs to save to previous context');
    return Promise.resolve({ status: 'success', payload: [] } as ICanvasInsertResponse);
  }

  // If no previous context ID provided, use a default or skip
  if (!previousContextIdArray || previousContextIdArray.length === 0) {
    console.log('background.js | [CONTEXT] No previous context ID array provided, skipping save');
    return Promise.resolve({ status: 'success', payload: [] } as ICanvasInsertResponse);
  }

  // Use the documentInsertTabArray function to save tabs with context URL array
  return documentInsertTabArray(tabArray, previousContextIdArray);
};

// Main context URL change handler
export const setContextUrl = async (url: { payload: string }) => {
  console.log('background.js | [socket.io] Received context URL update: ', url);

  // CRITICAL: Capture previous context data BEFORE updating anything
  const currentContext = await getCurrentContext();
  const previousContextUrl = currentContext?.url || '';
  const previousContextTabsArray = index.getCanvasTabArray(); // Get current tabs BEFORE context change

  console.log('background.js | Previous context tabs:', previousContextTabsArray.length);
  console.log('background.js | Previous context URL:', previousContextUrl);

  // Update the context with new URL
  if (currentContext) {
    const updatedContext = { ...currentContext, url: url.payload };
    await saveCurrentContext(updatedContext);
  }

  await index.updateBrowserTabs();

  try {
    console.log('background.js | Fetching tabs for new context...');

    // CRITICAL: Use await instead of .then() to ensure proper sequencing
    const tabs = await requestFetchTabsForContext();

    if (tabs && tabs.length > 0) {
      console.log(`background.js | Received ${tabs.length} tabs for new context`);
      // Use silent method first to update storage, then trigger UI update
      index.insertCanvasTabArraySilent(tabs, true);
      // Now update browser tabs to recalculate sync status and notify UI
      await index.updateBrowserTabs();
    } else {
      console.log('background.js | No tabs found for new context - clearing canvas tabs');
      // Get current tabs before clearing
      const currentTabs = index.getCanvasTabArray();
      // Clear canvas tabs if no data received or empty array
      index.clearCanvasTabs();
      // Notify UI about the tab clearing
      if (currentTabs.length > 0) {
        onContextTabsUpdated({
          canvasTabs: { removedTabs: currentTabs }
        });
      }
      // Also send a direct update to ensure UI is cleared
      sendRuntimeMessage({
        type: RUNTIME_MESSAGES.index_get_deltaCanvasToBrowser,
        payload: []
      });
      // Also update browser tabs to recalculate sync status
      await index.updateBrowserTabs();
    }

    const pinnedTabs = await getPinnedTabs();
    const newContextTabs = index.getCanvasTabArray(); // Get NEW context tabs
    const currentBrowserTabs = await browser.tabs.query({});

    console.log(`background.js | Context change comparison:
      - Previous context tabs: ${previousContextTabsArray.length}
      - New context tabs: ${newContextTabs.length}
      - Current browser tabs: ${currentBrowserTabs.length}
      - Pinned tabs: ${pinnedTabs.length}`);

    // Helper function to get tab URLs as a Set for fast lookup
    const getTabUrls = (tabs: ICanvasTab[]) => new Set(tabs.map(tab => tab.url).filter(Boolean));

    const previousTabUrls = getTabUrls(previousContextTabsArray);
    const newTabUrls = getTabUrls(newContextTabs);
    const currentBrowserTabUrls = new Set(currentBrowserTabs.map(tab => tab.url).filter(Boolean));

    // Calculate tabs that exist in browser but not in new context
    const tabsToClose = currentBrowserTabs.filter(browserTab =>
      browserTab.url &&
      currentBrowserTabUrls.has(browserTab.url) &&
      previousTabUrls.has(browserTab.url) &&
      !newTabUrls.has(browserTab.url) &&
      !pinnedTabs.includes(browserTab.url)
    );

    // Calculate tabs that exist in new context but not in browser
    const tabsToOpen = newContextTabs.filter(newTab =>
      newTab.url &&
      !currentBrowserTabUrls.has(newTab.url) &&
      !pinnedTabs.includes(newTab.url)
    );

    console.log(`background.js | Context change tab operations:
      - Tabs to close: ${tabsToClose.length}
      - Tabs to open: ${tabsToOpen.length}`);

    // Apply context change behavior
    await config.load();
    const behavior = config.sync.tabBehaviorOnContextChange;

    switch (behavior) {
      case "Save and Close Current and Open New":
        // Save tabs from previous context if we have them and previous context URL
        if (previousContextTabsArray.length > 0 && previousContextUrl && previousContextUrl !== url.payload) {
          console.log('background.js | Saving previous context tabs before closing...');
          try {
            await saveTabsToPreviousContext(previousContextTabsArray, [previousContextUrl]);
            console.log('background.js | Previous context tabs saved successfully');
          } catch (error) {
            console.error('background.js | Error saving previous context tabs:', error);
            // Continue with context change even if save fails
          }
        }

        // Close tabs that were in previous context but not in new context
        if (tabsToClose.length > 0) {
          const tabIdsToClose = tabsToClose.map(tab => tab.id).filter(Boolean) as number[];
          console.log(`background.js | Closing ${tabIdsToClose.length} tabs from previous context`);
          for (const tabId of tabIdsToClose) {
            try {
              await browser.tabs.remove(tabId);
            } catch (error) {
              console.error(`background.js | Error closing tab ${tabId}:`, error);
            }
          }
        }

        // Open new context tabs
        if (tabsToOpen.length > 0 && config.sync.autoOpenCanvasTabs) {
          console.log(`background.js | Opening ${tabsToOpen.length} tabs for new context`);
          await browserOpenTabArray(tabsToOpen);
        }
        break;

      case "Close Current and Open New":
        // Close tabs that were in previous context but not in new context
        if (tabsToClose.length > 0) {
          const tabIdsToClose = tabsToClose.map(tab => tab.id).filter(Boolean) as number[];
          console.log(`background.js | Closing ${tabIdsToClose.length} tabs from previous context`);
          for (const tabId of tabIdsToClose) {
            try {
              await browser.tabs.remove(tabId);
            } catch (error) {
              console.error(`background.js | Error closing tab ${tabId}:`, error);
            }
          }
        }

        // Open new context tabs
        if (tabsToOpen.length > 0 && config.sync.autoOpenCanvasTabs) {
          console.log(`background.js | Opening ${tabsToOpen.length} tabs for new context`);
          await browserOpenTabArray(tabsToOpen);
        }
        break;

      case "Keep Current and Open New":
        // Only open new context tabs, don't close anything
        if (tabsToOpen.length > 0 && config.sync.autoOpenCanvasTabs) {
          console.log(`background.js | Opening ${tabsToOpen.length} tabs for new context (keeping current tabs)`);
          await browserOpenTabArray(tabsToOpen);
        }
        break;

      case "Keep Current and Do Not Open New":
        // Do nothing - keep all current tabs and don't open new ones
        console.log('background.js | Keeping current tabs and not opening new ones');
        break;

      default:
        console.log(`background.js | Unknown tab behavior: ${behavior}, defaulting to no action`);
        break;
    }

    console.log('background.js | Context URL change handling completed successfully');

  } catch (error) {
    console.error('background.js | Error handling context URL change:', error);
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.error_message,
      payload: `Error switching context: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
};

export const contextUrlChanged = async () => {
  console.log('background.js | Context URL changed event received');

  // Fetch the current context and handle the change
  try {
    const currentContext = await canvasFetchContext();
    if (currentContext && currentContext.url) {
      await setContextUrl({ payload: currentContext.url });
    } else {
      console.log('background.js | No current context found after context URL change');
    }
  } catch (error) {
    console.error('background.js | Error handling context URL change:', error);
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.error_message,
      payload: 'Error fetching context after URL change'
    });
  }
};
