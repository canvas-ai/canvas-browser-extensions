import config from "@/general/config";
import index from "./TabIndex";
import { canvasFetchTabsForContext } from "./canvas";
import { handleContextChangeTabUpdates, browserOpenTabArray, sendRuntimeMessage } from "./utils";
import { RUNTIME_MESSAGES } from "@/general/constants";
import { getPinnedTabs } from "@/general/utils";
import { IContext } from "@/types/IContext";
import { getSocket, updateLocalCanvasTabsData } from "./socket";

const DEFAULT_URL = 'universe:///';

// For debouncing context update operations
let lastContextUpdate = 0;
const UPDATE_THROTTLE_MS = 1000; // Minimum time between updates
let pendingContextUpdate: NodeJS.Timeout | null = null;
let lastNotificationUpdate = 0;

// Log initial context configuration
console.log(`background.js | Context initialization with configured contextId: ${config.transport.contextId || 'none'}`);

// Initialize context with configured contextId or fallback to 'unknown'
export let context: IContext = {
  id: config.transport.contextId || 'unknown',
  userId: 'unknown',
  workspaceId: 'unknown',
  url: DEFAULT_URL,
  baseUrl: '/',
  color: '#fff',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  locked: false,
};

export function getValidContextId(context: IContext): string {
  const configContextId = config.transport.contextId;
  const contextId = (!context || !context.id || context.id === 'unknown') ?
                   (configContextId || 'default') :
                   context.id;

  console.log(`background.js | Using context ID: ${contextId} (from config: ${configContextId || 'none'}, from context: ${context?.id || 'none'})`);
  return contextId;
}

export const updateContext = async (newCtxData: IContext | undefined) => {
  const now = Date.now();

  // Debounce rapid context updates
  if (now - lastContextUpdate < UPDATE_THROTTLE_MS) {
    console.log(`background.js | Throttling context update, last update was ${now - lastContextUpdate}ms ago`);

    // Clear any existing pending update
    if (pendingContextUpdate) {
      clearTimeout(pendingContextUpdate);
    }

    // Schedule an update for later
    pendingContextUpdate = setTimeout(() => {
      console.log('background.js | Processing delayed context update');
      updateContext(newCtxData);
    }, UPDATE_THROTTLE_MS);

    return;
  }

  // Set timestamp for this update
  lastContextUpdate = now;

  // Save current state for comparison
  const oldContextId = context.id;
  const oldWorkspaceId = context.workspaceId;
  const oldUrl = context.url;

  // Handle reset case
  if (!newCtxData) {
    context.id = 'unknown';
    context.userId = 'unknown';
    context.workspaceId = 'unknown';
    context.url = DEFAULT_URL;
    context.baseUrl = '/';
    context.color = '#fff';
    context.contextArray = [];
    context.contextBitmapArray = [];
    context.path = undefined;
    context.pathArray = undefined;
    context.tree = undefined;
    context.locked = false;
    console.log("Context reset to default/empty state.");

    // Clean up WebSocket subscriptions for old context
    try {
      const socket = await getSocket();
      if (oldContextId && oldContextId !== 'unknown') {
        socket.unsubscribe('context', getValidContextId({ id: oldContextId } as IContext));
      }
      if (oldWorkspaceId && oldWorkspaceId !== 'unknown') {
        socket.unsubscribe('workspace', oldWorkspaceId);
      }
    } catch (error) {
      console.error("Error unsubscribing from old context:", error);
    }

    // Clean up local data
    index.clearCanvasTabs();
    index.updateBrowserTabs();

    // Notify UI
    contextUrlChanged();
    return;
  }

  // More comprehensive check to skip redundant updates
  const isIdenticalUpdate =
    newCtxData.id === context.id &&
    newCtxData.workspaceId === context.workspaceId &&
    newCtxData.url === context.url &&
    newCtxData.baseUrl === context.baseUrl &&
    newCtxData.color === context.color &&
    newCtxData.locked === context.locked;

  if (isIdenticalUpdate) {
    console.log("background.js | Skipping redundant context update - no changes detected");
    return;
  }

  // Apply the update
  console.log("background.js | Updating context:", newCtxData);
  Object.assign(context, newCtxData);

  // Validate critical fields
  if (!context.id || context.id === 'unknown' || !context.workspaceId || context.workspaceId === 'unknown') {
    console.error("Updated context is missing critical ID or WorkspaceID. Aborting further processing.", context);
    return;
  }

  // Determine what changed
  const idChanged = context.id !== oldContextId || context.workspaceId !== oldWorkspaceId;
  const urlChanged = context.url !== oldUrl;

  try {
    // Handle context or workspace ID change
    if (idChanged) {
      console.log(`background.js | Context change detected: old ${oldContextId} (ws: ${oldWorkspaceId}) -> new ${context.id} (ws: ${context.workspaceId})`);
      const socket = await getSocket();

      // Unsubscribe from old context if needed
      if (oldContextId && oldContextId !== 'unknown' && oldContextId !== context.id) {
        socket.unsubscribe('context', getValidContextId({ id: oldContextId } as IContext));
      }

      // Unsubscribe from old workspace if needed
      if (oldWorkspaceId && oldWorkspaceId !== 'unknown' && oldWorkspaceId !== context.workspaceId) {
        socket.unsubscribe('workspace', oldWorkspaceId);
      }

      // Subscribe to new context and workspace
      socket.subscribeToContext(getValidContextId(context));
      socket.subscribeToWorkspace(context.workspaceId);

      // Update local tab data
      updateLocalCanvasTabsData(getValidContextId(context));
    }
    // Handle URL change when ID didn't change
    else if (urlChanged) {
      console.log(`background.js | URL changed: ${oldUrl} -> ${context.url}`);
      const socket = await getSocket();

      // Only send URL update to server if change was locally initiated
      // (if change came from server, don't send back to avoid loops)
      const isServerInitiated = newCtxData.serverInitiated === true;
      if (!isServerInitiated) {
        console.log(`background.js | Sending URL update to server for context ${getValidContextId(context)}`);
        await socket.setContextUrl(getValidContextId(context), context.url);
      } else {
        console.log(`background.js | Skipping URL update to server as change was server-initiated`);
        // Clear the flag after we've used it
        context.serverInitiated = undefined;
      }
    }
    // Handle other property changes
    else {
      console.log("background.js | Context properties updated, but ID, WorkspaceID, and URL unchanged. No server notification needed.");
    }
  } catch (error) {
    console.error("Error during context update processing:", error);
  }

  // Always notify UI of the change
  contextUrlChanged();
}

export const setActiveContext = async (ctxToSetActive: IContext) => {
  console.log("setActiveContext called with:", ctxToSetActive);
  if (ctxToSetActive && ctxToSetActive.id && ctxToSetActive.id !== 'unknown') {
    await updateContext(ctxToSetActive);
  } else {
    console.error("setActiveContext called with invalid context data", ctxToSetActive);
  }
}

export const setContext = async (eventPayload: { payload: IContext }) => {
  console.log("background/context.ts | setContext (via event) received payload:", eventPayload.payload);
  await updateContext(eventPayload.payload);
}

export const setContextUrl = async (urlPayload: { payload: string }) => {
  const oldUrl = context.url;

  // Skip if URL hasn't changed
  if (oldUrl === urlPayload.payload) {
    console.log(`background/context.ts | setContextUrl skipped - URL unchanged: ${oldUrl}`);
    return;
  }

  console.log(`background/context.ts | setContextUrl called. Current context.url: ${oldUrl}, New URL from payload: ${urlPayload.payload}`);
  context.url = urlPayload.payload;

  if (!context.id || context.id === 'unknown') {
    console.warn("setContextUrl: Current context ID is unknown. Cannot sync tabs.");
    contextUrlChanged();
    return;
  }

  const previousContextTabsArray = index.getCanvasTabArray();
  await index.updateBrowserTabs();

  try {
    console.log("setContextUrl: Proceeding with tab synchronization logic for context ID:", context.id);
    const pinnedTabs = await getPinnedTabs();

    switch(config.sync.tabBehaviorOnContextChange) {
      case "Close": {
        await handleContextChangeTabUpdates(previousContextTabsArray, pinnedTabs);
        break;
      }
      case "Save and Close": {
        await handleContextChangeTabUpdates(previousContextTabsArray, pinnedTabs, context.contextBitmapArray || context.contextArray);
        break;
      }
      case "Keep": {
        // do nothing
      }
    }

    if (config.sync.autoOpenCanvasTabs) {
      await browserOpenTabArray(index.getCanvasTabArray().filter(({ url }) => !pinnedTabs.some(ptUrl => ptUrl === url)));
    }
  } catch (error) {
    console.error('Error during setContextUrl tab synchronization:', error);
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.error_message,
      payload: 'Error updating context tabs'
    });
  }

  // Send the update to server
  const socket = await getSocket();
  await socket.setContextUrl(getValidContextId(context), context.url);

  // Notify UI of change
  contextUrlChanged();
}

export const contextUrlChanged = () => {
  console.log("contextUrlChanged: Notifying UI of URL:", context.url);

  // Throttle UI notifications to avoid feedback loops
  const now = Date.now();
  if (now - lastNotificationUpdate < UPDATE_THROTTLE_MS) {
    console.log(`contextUrlChanged: Throttling UI notifications (last sent ${now - lastNotificationUpdate}ms ago)`);
    return; // Exit early to prevent notification storm
  }

  // Update the timestamp for next throttle check
  lastNotificationUpdate = now;

  try {
    // Create a clean copy to avoid reference issues
    const contextCopy = JSON.parse(JSON.stringify(context));

    // Track what we're sending to avoid redundant updates
    console.log("contextUrlChanged: Sending context update to UI:", {
      id: contextCopy.id,
      url: contextCopy.url,
      timestamp: now
    });

    // Send both the full context update AND a separate URL update
    // This increases reliability in case one message type isn't handled correctly
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.context_get,
      payload: contextCopy
    });

    // Send a dedicated URL update as a backup/duplicate to ensure it gets through
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.context_get_url,
      payload: context.url || DEFAULT_URL
    });
  } catch (error) {
    console.error("Error in contextUrlChanged:", error);

    // If there was an error in the notification, try a simpler approach
    try {
      console.log("contextUrlChanged: Falling back to simple URL notification");
      sendRuntimeMessage({
        type: RUNTIME_MESSAGES.context_get_url,
        payload: context.url || DEFAULT_URL
      });
    } catch (backupError) {
      console.error("Critical error in contextUrlChanged backup notification:", backupError);
    }
  }
}
