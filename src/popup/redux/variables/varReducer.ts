import { SET_CONNECTED, SET_CONTEXT, SET_PINNED_TABS, SET_RETRYING, VariableActionTypes } from "./varActionTypes";
import { savePinnedTabsToStorage } from "@/general/utils";

const initialState: IVarState = {
  connected: false,
  retrying: false,
  context: {},
  pinnedTabs: [],
};

export const variablesReducer = (state = initialState, action: VariableActionTypes): IVarState => {
  switch (action.type) {
    case SET_CONNECTED:
      return {
        ...state,
        connected: action.payload
      };
    case SET_CONTEXT:
      return {
        ...state,
        context: action.payload
      };
    case SET_RETRYING:
      return {
        ...state,
        retrying: action.payload
      };
    case SET_PINNED_TABS:
      const result = {
        ...state,
        pinnedTabs: action.payload,
      };
      savePinnedTabsToStorage(result.pinnedTabs);
      return result;
    default:
      return state;
  }
};
