import { BrowserTabActionTypes, CanvasTabActionTypes, SET_BROWSER_TABS, SET_CANVAS_TABS } from './tabActionTypes';

const tabReducer = (state = { canvasTabs: [], browserTabs: [] }, action: BrowserTabActionTypes | CanvasTabActionTypes): { canvasTabs: chrome.tabs.Tab[], browserTabs: chrome.tabs.Tab[] } => {
  switch (action.type) {
    case SET_BROWSER_TABS:
      return {
        ...state,
        browserTabs: action.payload,
      };
    case SET_CANVAS_TABS:
      return {
        ...state,
        canvasTabs: action.payload,
      };
    default:
      return state;
  }
};


export default tabReducer;
