import { SET_CONNECTED, SET_CONTEXT, SET_RETRYING, VariableActionTypes } from "./varActionTypes";

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
