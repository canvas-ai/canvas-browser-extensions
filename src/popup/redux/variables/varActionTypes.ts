export const SET_CONNECTED = 'SET_CONNECTED';
export const SET_RETRYING = 'SET_RETRYING';

interface SetConnected {
  type: typeof SET_CONNECTED;
  payload: boolean;
}

interface SetRetrying {
  type: typeof SET_RETRYING;
  payload: boolean;
}

export type VariableActionTypes = SetConnected | SetRetrying;