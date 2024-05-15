export const SET_CONNECTED = 'SET_CONNECTED';
export const SET_CONTEXT = 'SET_CONTEXT';
export const SET_RETRYING = 'SET_RETRYING';
export const SET_PINNED_TABS = 'SET_PINNED_TABS';
export const SET_SESSION_LIST = 'SET_SESSION_LIST';

interface SetConnected {
  type: typeof SET_CONNECTED;
  payload: boolean;
}

interface SetContext {
  type: typeof SET_CONTEXT;
  payload: IContext;
}

interface SetSessionList {
  type: typeof SET_SESSION_LIST;
  payload: ISession[];
}

interface SetRetrying {
  type: typeof SET_RETRYING;
  payload: boolean;
}

interface SetPinnedTabs {
  type: typeof SET_PINNED_TABS;
  payload: string[];
}


export type VariableActionTypes = SetConnected | SetContext | SetRetrying | SetPinnedTabs | SetSessionList;