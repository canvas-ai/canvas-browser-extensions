import { browser } from "@/popup/utils";
import { SET_CONNECTED, SET_CONTEXT, SET_PINNED_TABS, SET_RETRYING, VariableActionTypes } from "./varActionTypes";

const DEFAULT_STATE = {
  connected: false,
  context: {
    url: "universe:///",
    color: "#fff"
  },
  retrying: false,
  pinnedTabs: []
}

const savePinnedTabsToStorage = (pinnedTabs: string[]) => {
  console.log("saving pinnedTabs to storage...", pinnedTabs);
  browser.storage.local.set({ "pinnedTabs": pinnedTabs });
};

const varReducer = (state = DEFAULT_STATE, action: VariableActionTypes): IVarState => {
  switch (action.type) {
    case SET_CONNECTED:
      return {
        ...state,
        connected: action.payload,
      };
    case SET_CONTEXT:
      return {
        ...state,
        context: action.payload,
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


export default varReducer;
