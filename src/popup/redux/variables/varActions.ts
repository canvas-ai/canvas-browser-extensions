import { Dispatch } from "redux";
import { SET_CONNECTED, SET_CONTEXT, SET_PINNED_TABS, SET_RETRYING, SET_SESSION_LIST, VariableActionTypes } from "./varActionTypes";
import { browser } from "@/general/utils";

export const setSessionList = (sessions: ISession[]): VariableActionTypes => ({
  type: SET_SESSION_LIST,
  payload: sessions
});

export const setRetrying = (retrying: boolean): VariableActionTypes => ({
  type: SET_RETRYING,
  payload: retrying
});

export const setConnected = (connected: boolean): VariableActionTypes => ({
  type: SET_CONNECTED,
  payload: connected,
});

export const setContext = (context: IContext): VariableActionTypes => ({
  type: SET_CONTEXT,
  payload: context,
});

export const setPinnedTabs = (pinnedTabs: string[]): VariableActionTypes => ({
  type: SET_PINNED_TABS,
  payload: pinnedTabs,
});


export const loadInitialPinnedTabsState = () => async (dispatch: Dispatch<VariableActionTypes>) => {
  try {
    // Retrieve sync state from Chrome storage
    const pinnedTabs = await new Promise<string[]>((resolve, reject) => {
      browser.storage.local.get(["pinnedTabs"]).then(storage => {
        console.log("get pinnedTabs result: ", storage);
        resolve(storage.pinnedTabs || []);
      });
    });

    // Dispatch action to set sync state
    dispatch(setPinnedTabs(pinnedTabs));
  } catch (error) {
    console.error('Error loading initial state from Chrome storage:', error);
  }
};