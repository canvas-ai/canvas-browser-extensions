import { SET_BROWSER_TABS, BrowserTabActionTypes, CanvasTabActionTypes, SET_CANVAS_TABS, ADD_CANVAS_TABS, REMOVE_CANVAS_TABS, ADD_BROWSER_TABS, REMOVE_BROWSER_TABS,  } from './tabActionTypes';

export const setBrowserTabs = (tabs: chrome.tabs.Tab[]): BrowserTabActionTypes => ({
  type: SET_BROWSER_TABS,
  payload: tabs,
});

export const addBrowserTabs = (tabs: chrome.tabs.Tab[]): BrowserTabActionTypes => ({
  type: ADD_BROWSER_TABS,
  payload: tabs,
});

export const removeBrowserTabs = (tabs: chrome.tabs.Tab[]): BrowserTabActionTypes => ({
  type: REMOVE_BROWSER_TABS,
  payload: tabs,
});


export const setCanvasTabs = (tabs: chrome.tabs.Tab[]): CanvasTabActionTypes => ({
  type: SET_CANVAS_TABS,
  payload: tabs,
});

export const addCanvasTabs = (tabs: chrome.tabs.Tab[]): CanvasTabActionTypes => ({
  type: ADD_CANVAS_TABS,
  payload: tabs,
});

export const removeCanvasTabs = (tabs: chrome.tabs.Tab[]): CanvasTabActionTypes => ({
  type: REMOVE_CANVAS_TABS,
  payload: tabs,
});

