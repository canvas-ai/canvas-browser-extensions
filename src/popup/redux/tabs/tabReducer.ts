import { ADD_BROWSER_TABS, ADD_CANVAS_TABS, BrowserTabActionTypes, CanvasTabActionTypes, REMOVE_BROWSER_TABS, REMOVE_CANVAS_TABS, SET_BROWSER_TABS, SET_CANVAS_TABS } from './tabActionTypes';

const tabReducer = (state = { canvasTabs: [], browserTabs: [] }, action: BrowserTabActionTypes | CanvasTabActionTypes): { canvasTabs: chrome.tabs.Tab[], browserTabs: chrome.tabs.Tab[] } => {
  switch (action.type) {
    case SET_BROWSER_TABS:
      return {
        ...state,
        browserTabs: action.payload,
      };
    case ADD_BROWSER_TABS:
      return {
        ...state,
        browserTabs: [...state.browserTabs, ...action.payload],
      };
    case REMOVE_BROWSER_TABS:
      return {
        ...state,
        browserTabs: state.browserTabs.filter((bt: chrome.tabs.Tab) => !action.payload.some(pt => pt.url === bt.url)),
      };
      
    case SET_CANVAS_TABS:
      return {
        ...state,
        canvasTabs: action.payload,
      };

    case ADD_CANVAS_TABS:
      return {
        ...state,
        canvasTabs: [...state.canvasTabs, ...action.payload],
      };
    case REMOVE_CANVAS_TABS:
      return {
        ...state,
        canvasTabs: state.canvasTabs.filter((ct: chrome.tabs.Tab) => !action.payload.some(pt => pt.url === ct.url)),
      };
  
    default:
      return state;
  }
};


export default tabReducer;
