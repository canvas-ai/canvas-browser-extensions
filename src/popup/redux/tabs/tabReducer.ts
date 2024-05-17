import { ADD_BROWSER_TABS, ADD_CANVAS_TABS, ADD_OPENED_CANVAS_TABS, ADD_SYNCED_BROWSER_TABS, BrowserTabActionTypes, CanvasTabActionTypes, REMOVE_BROWSER_TABS, REMOVE_CANVAS_TABS, REMOVE_OPENED_CANVAS_TABS, REMOVE_SYNCED_BROWSER_TABS, SET_BROWSER_TABS, SET_CANVAS_TABS, SET_OPENED_CANVAS_TABS, SET_SYNCED_BROWSER_TABS } from './tabActionTypes';

const defaultState = { canvasTabs: [], browserTabs: [], openedCanvasTabs: [], syncedBrowserTabs: [] };

const tabReducer = (state = defaultState, action: BrowserTabActionTypes | CanvasTabActionTypes): ITabsInfo => {
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
        browserTabs: state.browserTabs.filter((bt: ICanvasTab) => !action.payload.some(pt => pt.url === bt.url)),
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
        canvasTabs: state.canvasTabs.filter((ct: ICanvasTab) => !action.payload.some(pt => pt.url === ct.url)),
      };
  
    case SET_SYNCED_BROWSER_TABS:
      return {
        ...state,
        syncedBrowserTabs: action.payload,
      };
    case ADD_SYNCED_BROWSER_TABS:
      return {
        ...state,
        syncedBrowserTabs: [...state.syncedBrowserTabs, ...action.payload],
      };
    case REMOVE_SYNCED_BROWSER_TABS:
      return {
        ...state,
        syncedBrowserTabs: state.syncedBrowserTabs.filter((bt: ICanvasTab) => !action.payload.some(pt => pt.url === bt.url)),
      };
      
    case SET_OPENED_CANVAS_TABS:
      return {
        ...state,
        openedCanvasTabs: action.payload,
      };

    case ADD_OPENED_CANVAS_TABS:
      return {
        ...state,
        openedCanvasTabs: [...state.openedCanvasTabs, ...action.payload],
      };
    case REMOVE_OPENED_CANVAS_TABS:
      return {
        ...state,
        openedCanvasTabs: state.openedCanvasTabs.filter((ct: ICanvasTab) => !action.payload.some(pt => pt.url === ct.url)),
      };
  
    default:
      return state;
  }
};


export default tabReducer;
