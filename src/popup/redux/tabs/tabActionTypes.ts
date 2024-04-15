export const SET_BROWSER_TABS = 'SET_BROWSER_TABS';
export const SET_CANVAS_TABS = 'SET_CANVAS_TABS';

export const ADD_BROWSER_TABS = 'ADD_BROWSER_TABS';
export const ADD_CANVAS_TABS = 'ADD_CANVAS_TABS';

export const REMOVE_BROWSER_TABS = 'REMOVE_BROWSER_TABS';
export const REMOVE_CANVAS_TABS = 'REMOVE_CANVAS_TABS';

interface SetBrowserTabs {
  type: typeof SET_BROWSER_TABS;
  payload: ICanvasTab[];
}

interface SetCanvasTabs {
  type: typeof SET_CANVAS_TABS;
  payload: ICanvasTab[];
}

interface AddBrowserTabs {
  type: typeof ADD_BROWSER_TABS;
  payload: ICanvasTab[];
}

interface AddCanvasTabs {
  type: typeof ADD_CANVAS_TABS;
  payload: ICanvasTab[];
}

interface RemoveBrowserTabs {
  type: typeof REMOVE_BROWSER_TABS;
  payload: ICanvasTab[];
}

interface RemoveCanvasTabs {
  type: typeof REMOVE_CANVAS_TABS;
  payload: ICanvasTab[];
}


export type BrowserTabActionTypes = SetBrowserTabs | AddBrowserTabs | RemoveBrowserTabs;

export type CanvasTabActionTypes = SetCanvasTabs | AddCanvasTabs | RemoveCanvasTabs;
