import { RUNTIME_MESSAGES, SOCKET_EVENTS } from "@/general/constants";
import { showErrorMessage, showSuccessMessage, tabsUpdated } from "./utils";
import { setConnected, setContext, setPinnedTabs, setRetrying } from "./redux/variables/varActions";
import { addBrowserTabs, addCanvasTabs, addOpenedCanvasTabs, addSyncedBrowserTabs, removeBrowserTabs, removeCanvasTabs, removeOpenedCanvasTabs, removeSyncedBrowserTabs, setBrowserTabs, setCanvasTabs, setOpenedCanvasTabs, setSyncedBrowserTabs } from "./redux/tabs/tabActions";
import { Dispatch } from "redux";
import { setConfig } from "./redux/config/configActions";
import { getPinnedTabs } from "@/general/utils";

export const messageListener =
  (dispatch: Dispatch<any>, variables: IVarState) => (message: { type: string, payload: any }, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  // Basic validation to prevent errors
  if (!message || typeof message !== 'object' || !message.type) {
    console.error('UI | Invalid message received:', message);
    return;
  }

  console.log(`UI | Message received: ${message.type}`,
    message.type === RUNTIME_MESSAGES.context_get ?
      { id: message.payload?.id, url: message.payload?.url } :
      message.payload
  );

  try {
    switch(message.type) {
      case RUNTIME_MESSAGES.config_get: {
        if (message.payload) {
          dispatch(setConfig(message.payload));
        }
        break;
      }
      case RUNTIME_MESSAGES.context_get_url: {
        const url = message.payload;
        if (url && variables.context) {
          // Only update if URL actually changed
          if (variables.context.url !== url) {
            console.log(`UI | Updating context URL from ${variables.context.url} to ${url}`);

            // Create a complete context object with the new URL
            const updatedContext = {
              ...variables.context,
              url: url
            };

            // Dispatch the full context update to ensure all components rerender
            dispatch(setContext(updatedContext));
          } else {
            console.log(`UI | Skipping redundant context URL update: ${url}`);
          }
        }
        break;
      }
      case RUNTIME_MESSAGES.context_get: {
        const context = message.payload;
        if (context && context.id) {
          // Compare with current context to avoid redundant updates for logging purposes,
          // but dispatch to ensure all properties are updated.
          const currentUrl = variables.context?.url;
          if (currentUrl !== context.url) {
            console.log(`UI | Updating context: ${context.id} with URL ${context.url} (previously ${currentUrl})`);
          } else {
            console.log(`UI | Context URL unchanged (${context.url}), but updating other context properties for ID: ${context.id}`);
          }
          // Dispatch immediately, ensuring a new object reference for Redux.
          dispatch(setContext({ ...context }));
        }
        break;
      }
      case RUNTIME_MESSAGES.tabs_updated: {
        tabUpdateEventHandler(dispatch, message.payload);
        break;
      }
      case RUNTIME_MESSAGES.pinned_tabs_updated: {
        getPinnedTabs().then(pinnedTabs => {
          dispatch(setPinnedTabs(pinnedTabs));
        });
        break;
      }
      case RUNTIME_MESSAGES.socket_event: {
        socketEventHandler(dispatch, message.payload, variables);
        break;
      }
      case RUNTIME_MESSAGES.socket_status: {
        const isConnected = Boolean(message.payload);
        // Only dispatch if connection status changed
        if (variables.connected !== isConnected) {
          console.log(`UI | Socket connection status changed to: ${isConnected}`);
          dispatch(setConnected(isConnected));
        }
        break;
      }
      case RUNTIME_MESSAGES.index_get_deltaBrowserToCanvas: {
        dispatch(setBrowserTabs(message.payload));
        break;
      }
      case RUNTIME_MESSAGES.index_get_deltaCanvasToBrowser: {
        dispatch(setCanvasTabs(message.payload));
        break;
      }
      case RUNTIME_MESSAGES.synced_browser_tabs: {
        dispatch(setSyncedBrowserTabs(message.payload));
        break;
      }
      case RUNTIME_MESSAGES.opened_canvas_tabs: {
        dispatch(setOpenedCanvasTabs(message.payload));
        break;
      }
      case RUNTIME_MESSAGES.error_message: {
        showErrorMessage(message.payload);
        break;
      }
      case RUNTIME_MESSAGES.success_message: {
        showSuccessMessage(message.payload);
        break;
      }
      default: {
        console.log(`UI | Unhandled message type: ${message.type}`);
      }
    }
  } catch (error) {
    console.error(`UI | Error handling message ${message.type}:`, error);
  }
}

const socketEventHandler = (
  dispatch: Dispatch<any>,
  payload: any,
  variables?: IVarState
) => {
  // Skip invalid payloads
  if (!payload || !payload.event) {
    console.error('UI | Invalid socket event payload:', payload);
    return;
  }

  // Skip if this is a duplicate event (recently handled)
  if (payload.timestamp) {
    const lastProcessedTimestamp = socketEventHandler.lastProcessedTimestamps[payload.event] || 0;
    if (payload.timestamp <= lastProcessedTimestamp) {
      console.log(`UI | Skipping duplicate socket event: ${payload.event} (already processed at ${lastProcessedTimestamp})`);
      return;
    }
    socketEventHandler.lastProcessedTimestamps[payload.event] = payload.timestamp;
  }

  const sockevent = payload.event;
  console.log(`UI | Processing socket event: ${sockevent}`, payload);

  try {
    switch (sockevent) {
      case SOCKET_EVENTS.connecting:
        dispatch(setConnected(false));
        dispatch(setRetrying(true));
        break;
      case SOCKET_EVENTS.connect:
        dispatch(setConnected(true));
        dispatch(setRetrying(false));
        break;
      case SOCKET_EVENTS.disconnect:
        dispatch(setConnected(false));
        dispatch(setRetrying(false));
        break;
      case SOCKET_EVENTS.connect_error:
        dispatch(setConnected(false)); // maybe could show the last connection error
        dispatch(setRetrying(false));
        break;
      case SOCKET_EVENTS.connect_timeout:
        dispatch(setConnected(false)); // maybe could show timeout error
        dispatch(setRetrying(false));
        break;
      case SOCKET_EVENTS.CONTEXT_URL_CHANGED:
        // Special handling for context URL changes from the server
        console.log('=== UI PROCESSING CONTEXT_URL_CHANGED ===');
        console.log('Raw payload:', payload);

        // Extract the URL and contextId from the payload
        // The payload structure can be either {url, id} or have these properties nested
        let contextId = payload.id;
        let newUrl = payload.url;

        // Check for nested structure in case the server sends it differently
        if (!newUrl && payload.payload) {
          newUrl = payload.payload.url;
          contextId = payload.payload.id || contextId;
        }

        console.log(`Extracted: contextId=${contextId}, newUrl=${newUrl}`);

        if (contextId && newUrl && variables?.context) {
          console.log(`UI | Received CONTEXT_URL_CHANGED from server for context ${contextId}: ${newUrl}`);

          // Only process if it's for our current context
          if (variables.context.id === contextId) {
            // Check if the URL is actually different to avoid unnecessary updates
            if (variables.context.url !== newUrl) {
              console.log(`UI | Updating context URL from ${variables.context.url} to ${newUrl} based on server event`);

              // Create a complete context object with the new URL
              const updatedContext = {
                ...variables.context,
                url: newUrl,
                _lastUpdated: Date.now() // Add timestamp to ensure Redux registers the change
              };

              // Dispatch the full context update to ensure all components rerender
              dispatch(setContext(updatedContext));

              // Also emit a context URL update event to ensure all components get notified
              // This helps components that might only be listening for URL changes
              dispatch({
                type: 'CONTEXT_URL_UPDATED',
                payload: newUrl
              });
            } else {
              console.log(`UI | Skipping redundant context URL update: ${newUrl}`);
            }
          } else {
            console.log(`UI | Ignoring URL change for non-current context: ${contextId} (current: ${variables.context.id})`);
          }
        } else {
          console.warn('UI | Invalid CONTEXT_URL_CHANGED payload - missing required properties:', payload);
        }
        console.log('======================================');
        break;
      default:
        console.log(`UI | Unhandled socket event: "${sockevent}"`);
    }
  } catch (error) {
    console.error(`UI | Error handling socket event ${sockevent}:`, error);
  }
}

// Static property to track timestamps of processed events
socketEventHandler.lastProcessedTimestamps = {};

const tabUpdateEventHandler = (dispatch: Dispatch<any>, payload: any) => {
  const updateData: IUpdatedTabsData = payload;
  if (updateData.canvasTabs)
    tabsUpdated(dispatch, updateData.canvasTabs, addCanvasTabs, removeCanvasTabs);
  if (updateData.openedCanvasTabs)
    tabsUpdated(dispatch, updateData.openedCanvasTabs, addOpenedCanvasTabs, removeOpenedCanvasTabs);
  if (updateData.browserTabs)
    tabsUpdated(dispatch, updateData.browserTabs, addBrowserTabs, removeBrowserTabs);
  if (updateData.syncedBrowserTabs)
    tabsUpdated(dispatch, updateData.syncedBrowserTabs, addSyncedBrowserTabs, removeSyncedBrowserTabs);
}
