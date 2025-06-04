import config from "@/general/config";
import index from "./TabIndex";
import { documentInsertTabArray, formatTabProperties, requestFetchTabsForContext } from "./canvas";
import { handleContextChangeTabUpdates, browserOpenTabArray, sendRuntimeMessage, onContextTabsUpdated, genFeatureArray } from "./utils";
import { RUNTIME_MESSAGES, SOCKET_MESSAGES } from "@/general/constants";
import { getPinnedTabs, browser } from "@/general/utils";
import { getSocket } from "./socket";

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

export const saveTabsToPreviousContext = async (tabArray: ICanvasTab[], previousContextUrl: string): Promise<ICanvasInsertResponse> => {
  return new Promise(async (resolve, reject) => {
    if (!tabArray || !tabArray.length) {
      console.log('background.js | No tabs to save to previous context');
      resolve({ status: 'success', payload: [] } as ICanvasInsertResponse);
      return;
    }

    const socket = await getSocket();
    
    try {
      const currentContextInfo = await getCurrentContext();
      
      console.log(`background.js | Saving ${tabArray.length} tabs to previous context: ${previousContextUrl}`);
      
      const response = await new Promise<any>((resolveInsert, rejectInsert) => {
        socket.on(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT_ARRAY_RESULT, (response: any) => {
          socket.removeAllListeners(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT_ARRAY_RESULT);
          console.log('background.js | Tab array inserted to previous context: ', response);
          
          if (response && response.status === 'success' && response.payload) {
            console.log(`background.js | Tab array saved to previous context successfully: `, response);
            resolveInsert(response);
          } else if (response.status === "error") {
            console.error("background.js | Error saving tab array to previous context: ", response);
            rejectInsert(new Error(response.message || "Error saving tab array to previous context"));
          } else {
            console.error("background.js | Unexpected response status for previous context tab save: ", response);
            rejectInsert(new Error("Unexpected response from Canvas"));
          }
        });

        // Find the previous context by URL
        browser.storage.local.get(['contexts']).then((result) => {
          const contexts = result.contexts || [];
          const previousContext = contexts.find((ctx: IContext) => ctx.url === previousContextUrl);
          
          if (!previousContext) {
            console.error('background.js | Previous context not found for URL:', previousContextUrl);
            rejectInsert(new Error('Previous context not found'));
            return;
          }

          // Emit the insert request for the previous context
          socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT_ARRAY, {
            contextId: previousContext.id,
            documents: tabArray.map((tab) => formatTabProperties(tab))
          }, genFeatureArray("WRITE"));
        }).catch((error) => {
          console.error('background.js | Error getting contexts for previous context save:', error);
          rejectInsert(error);
        });
      });

      console.log('background.js | Successfully saved tabs to previous context');
      resolve(response);

    } catch (error) {
      console.error("background.js | Exception in saveTabsToPreviousContext: ", error);
      reject(error);
    }
  });
};

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

    // Calculate which tabs should be closed and opened based on behavior
    let tabsToClose: ICanvasTab[] = [];
    let tabsToOpen: ICanvasTab[] = [];

    switch(config.sync.tabBehaviorOnContextChange) {
      case "Close Current and Open New": {
        // Close all tabs that are not in the new context and not pinned
        tabsToClose = currentBrowserTabs.filter(tab => 
          tab.url && 
          !newContextTabs.some(canvasTab => canvasTab.url === tab.url) &&
          !pinnedTabs.includes(tab.url)
        );
        
        // Open tabs from new context that are not already open and not pinned
        tabsToOpen = newContextTabs.filter(tab => 
          tab.url &&
          !currentBrowserTabs.some(browserTab => browserTab.url === tab.url) &&
          !pinnedTabs.includes(tab.url)
        );
        break;
      }
      
      case "Save and Close Current and Open New": {
        // FIXED: Use proper websocket approach like sync all button
        // First save current tabs to previous context
        const syncableTabs = currentBrowserTabs.filter(tab => 
          tab.url && 
          !previousContextTabsArray.some(prevTab => prevTab.url === tab.url) &&
          !pinnedTabs.includes(tab.url)
        );
        
        console.log(`background.js | Tabs to sync to previous context: ${syncableTabs.length}`);
        
        if (syncableTabs.length > 0 && previousContextUrl) {
          try {
            console.log('background.js | Saving current tabs to previous context using websocket...');
            const res = await saveTabsToPreviousContext(syncableTabs, previousContextUrl);
            if (!res || res.status === 'error') {
              console.error('background.js | Error saving tabs to previous context');
              sendRuntimeMessage({ 
                type: RUNTIME_MESSAGES.error_message, 
                payload: 'Error saving tabs to previous context' 
              });
            } else {
              console.log('background.js | Tabs successfully saved to previous context: ', res);
              sendRuntimeMessage({ 
                type: RUNTIME_MESSAGES.success_message, 
                payload: `${syncableTabs.length} tabs saved to previous context` 
              });
            }
          } catch (error) {
            console.error('background.js | Error saving tabs to previous context:', error);
            sendRuntimeMessage({ 
              type: RUNTIME_MESSAGES.error_message, 
              payload: 'Error saving tabs to previous context' 
            });
          }
        }

        // Close all tabs that are not in the new context and not pinned
        tabsToClose = currentBrowserTabs.filter(tab => 
          tab.url && 
          !newContextTabs.some(canvasTab => canvasTab.url === tab.url) &&
          !pinnedTabs.includes(tab.url)
        );
        
        // Open tabs from new context that are not already open and not pinned
        tabsToOpen = newContextTabs.filter(tab => 
          tab.url &&
          !currentBrowserTabs.some(browserTab => browserTab.url === tab.url) &&
          !pinnedTabs.includes(tab.url)
        );
        break;
      }
      
      case "Keep Current and Open New": {
        // Only open new tabs, don't close any
        tabsToOpen = newContextTabs.filter(tab => 
          tab.url &&
          !currentBrowserTabs.some(browserTab => browserTab.url === tab.url) &&
          !pinnedTabs.includes(tab.url)
        );
        break;
      }
      
      case "Keep Current and Do Not Open New": {
        // Do nothing - keep existing tabs and don't open new ones
        break;
      }
    }

    // Optimize: Remove tabs from close list that are also in open list
    const tabsToOpenUrls = getTabUrls(tabsToOpen);
    const optimizedTabsToClose = tabsToClose.filter(tab => !tabsToOpenUrls.has(tab.url));
    
    const optimizedTabsToOpen = tabsToOpen.filter(tab => 
      !optimizedTabsToClose.some(closeTab => closeTab.url === tab.url)
    );

    console.log(`background.js | Tab behavior "${config.sync.tabBehaviorOnContextChange}" optimization: 
      - Would close ${tabsToClose.length} tabs, optimized to ${optimizedTabsToClose.length}
      - Would open ${tabsToOpen.length} tabs, optimized to ${optimizedTabsToOpen.length}
      - Avoided ${tabsToClose.length - optimizedTabsToClose.length} unnecessary close/open cycles`);

    // Execute the optimized tab operations
    if (optimizedTabsToClose.length > 0) {
      // Ensure at least one tab remains open
      if (currentBrowserTabs.length === optimizedTabsToClose.length) {
        await browser.tabs.create({});
      }

      // Close tabs that should be closed
      for (const tab of optimizedTabsToClose) {
        if (tab.id) {
          try {
            console.log(`background.js | Closing tab ${tab.url}`);
            await browser.tabs.remove(tab.id);
          } catch (error) {
            console.error('Error closing tab:', error);
          }
        }
      }
    }

    // Open new tabs if auto-open is enabled
    if (config.sync.autoOpenCanvasTabs && optimizedTabsToOpen.length > 0) {
      console.log(`background.js | Opening ${optimizedTabsToOpen.length} new context tabs`);
      await browserOpenTabArray(optimizedTabsToOpen);
    }

    // Update the browser tabs index
    await index.updateBrowserTabs();

    // Send success message to popup
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.success_message,
      payload: 'Context switched successfully'
    });

    console.log('background.js | Context switch completed successfully');

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
