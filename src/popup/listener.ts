import { RUNTIME_MESSAGES, SOCKET_EVENTS } from "@/general/constants";
import { showErrorMessage, showSuccessMessage, tabsUpdated } from "./utils";
import { setConnected, setRetrying, saveUserInfo, saveContext, savePinnedTabs, saveSessionList } from "./redux/variables/varActions";
import { addBrowserTabs, addCanvasTabs, addOpenedCanvasTabs, addSyncedBrowserTabs, removeBrowserTabs, removeCanvasTabs, removeOpenedCanvasTabs, removeSyncedBrowserTabs, setBrowserTabs, setCanvasTabs, setOpenedCanvasTabs, setSyncedBrowserTabs } from "./redux/tabs/tabActions";
import { Dispatch } from "redux";
import { getPinnedTabs } from "@/general/utils";

export const messageListener = 
  (dispatch: Dispatch<any>, variables: IVarState) => (message: { type: string, payload: any }, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  console.log('UI | Message received: ', message);
  switch(message.type) {
    case RUNTIME_MESSAGES.config_get: {
      // Config is now handled by storage hooks, no action needed
      break;
    }
    case RUNTIME_MESSAGES.context_get_url: {
      const url = message.payload;
      // Update context in storage, fetch current context first
      saveContext({ id: 'default', url, contextBitmapArray: [], color: '#fff' });
      break;
    }
    case RUNTIME_MESSAGES.context_get: {
      const context = message.payload;
      saveContext(context);
      break;
    }
    case RUNTIME_MESSAGES.tabs_updated: {
      tabUpdateEventHandler(dispatch, message.payload);
      break;
    }
    case RUNTIME_MESSAGES.pinned_tabs_updated: {
      getPinnedTabs().then(pinnedTabs => {
        savePinnedTabs(pinnedTabs);        
      })
      break;
    }
    case RUNTIME_MESSAGES.update_sessions_list: {
      saveSessionList(message.payload as ISession[]);
      break;
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
    case SOCKET_EVENTS.authenticated:
      saveUserInfo(payload.data);
      dispatch(setConnected(true));
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