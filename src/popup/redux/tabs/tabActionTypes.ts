export const SET_BROWSER_TABS = 'SET_BROWSER_TABS';
export const SET_CANVAS_TABS = 'SET_CANVAS_TABS';

interface SetBrowserTabs {
  type: typeof SET_BROWSER_TABS;
  payload: chrome.tabs.Tab[];
}

interface SetCanvasTabs {
  type: typeof SET_CANVAS_TABS;
  payload: chrome.tabs.Tab[];
}

export type BrowserTabActionTypes = SetBrowserTabs;

export type CanvasTabActionTypes = SetCanvasTabs;
