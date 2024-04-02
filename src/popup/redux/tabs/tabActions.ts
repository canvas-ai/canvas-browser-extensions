import { SET_BROWSER_TABS, BrowserTabActionTypes, CanvasTabActionTypes, SET_CANVAS_TABS,  } from './tabActionTypes';

export const setBrowserTabs = (tabs: chrome.tabs.Tab[]): BrowserTabActionTypes => ({
  type: SET_BROWSER_TABS,
  payload: tabs,
});

export const setCanvasTabs = (tabs: chrome.tabs.Tab[]): CanvasTabActionTypes => ({
  type: SET_CANVAS_TABS,
  payload: tabs,
});
