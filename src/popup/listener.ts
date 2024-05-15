import { RUNTIME_MESSAGES, SOCKET_EVENTS } from "@/general/constants";
import { showErrorMessage, showSuccessMessage, tabsUpdated } from "./utils";
import { setConnected, setContext, setPinnedTabs, setRetrying, setSessionList } from "./redux/variables/varActions";
import { addBrowserTabs, addCanvasTabs, addOpenedCanvasTabs, addSyncedBrowserTabs, removeBrowserTabs, removeCanvasTabs, removeOpenedCanvasTabs, removeSyncedBrowserTabs, setBrowserTabs, setCanvasTabs, setOpenedCanvasTabs, setSyncedBrowserTabs } from "./redux/tabs/tabActions";
import { Dispatch } from "redux";
import { setConfig } from "./redux/config/configActions";
import { getPinnedTabs } from "@/general/utils";

export const messageListener = 
  (dispatch: Dispatch<any>, variables: IVarState) => (message: { type: string, payload: any }, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  console.log('UI | Message received: ', message);
  switch(message.type) {
    case RUNTIME_MESSAGES.config_get: {
      dispatch(setConfig(message.payload));
      break;
    }
    case RUNTIME_MESSAGES.context_get_url: {
      const url = message.payload;
      dispatch(setContext({ ...variables.context, url }));
      break;
    }
    case RUNTIME_MESSAGES.context_get: {
      const context = message.payload;
      dispatch(setContext({ ...context }));
      break;
    }
    case RUNTIME_MESSAGES.tabs_updated: {
      tabUpdateEventHandler(dispatch, message.payload);
      break;
    }
    case RUNTIME_MESSAGES.pinned_tabs_updated: {
      getPinnedTabs().then(pinnedTabs => {
        dispatch(setPinnedTabs(pinnedTabs));        
      })
      break;
    }
    case RUNTIME_MESSAGES.update_sessions_list: {
      dispatch(setSessionList(message.payload as ISession[]));
    }
    case RUNTIME_MESSAGES.socket_event: {
      socketEventHandler(dispatch, message.payload);
      break;
    }
    case RUNTIME_MESSAGES.socket_status: {
      dispatch(setConnected(message.payload));
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
  }
}

const socketEventHandler = (dispatch: Dispatch<any>, payload: any) => {
  const sockevent = payload.event;
  console.log(`UI | Got a new socket event: "${sockevent}"`);
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
    default:
      console.log(`ERROR: UI | Unknown socket event: "${sockevent}"`);
  }
}

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