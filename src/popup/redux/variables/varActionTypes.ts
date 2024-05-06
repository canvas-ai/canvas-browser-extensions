export const SET_CONNECTED = 'SET_CONNECTED';
export const SET_CONTEXT = 'SET_CONTEXT';
export const SET_RETRYING = 'SET_RETRYING';
export const SET_PINNED_TABS = 'SET_PINNED_TABS';

interface SetConnected {
  type: typeof SET_CONNECTED;
  payload: boolean;
}

interface SetContext {
  type: typeof SET_CONTEXT;
  payload: IContext;
}

interface SetRetrying {
  type: typeof SET_RETRYING;
  payload: boolean;
}

interface SetPinnedTabs {
  type: typeof SET_PINNED_TABS;
  payload: string[];
}


export type VariableActionTypes = SetConnected | SetContext | SetRetrying | SetPinnedTabs;