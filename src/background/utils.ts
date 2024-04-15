import { RUNTIME_MESSAGES } from "@/general/constants";
import index from "./TabIndex";

export const browser: typeof chrome = globalThis.browser || chrome;

export function browserIsValidTabUrl(tabUrl: string) {
  return !/^(about|chrome|moz-extension|file|view-source|view-unsafely):/.test(tabUrl);
}

export function browserOpenTab(tab: ICanvasTab) {
  return new Promise((res, rej) => {
    if (!tab || !tab.url) return false;
    if (!browserIsValidTabUrl(tab.url)) return false;
    console.log(`background.js | Opening tab: `, tab);

    try {
      browser.tabs.create({
        url: tab.url,
        // cookieStoreId: tab.cookieStoreId // removed
        //windowId: tab.windowId, // Restore may fail if windowId does not exist, TODO: Handle this case with windows.create()
        //index: tab.index, 
        //active: tab.active,
        //muted: tab.muted,
        //openInReaderMode: tab.openInReaderMode,
        //pinned: tab.pinned,
        //selected: tab.selected            
      }).then(newTab => {
        newTab.discarded = tab.discarded;
        newTab.title = tab.title;
        res(newTab);
      });
    } catch (error) {
      console.error('UI | Error creating tab:', error);
      return false;
    }
  });
}


export async function browserOpenTabArray(tabArray: ICanvasTab[] | undefined) {
  if (!tabArray || !tabArray.length) return false;
  console.log(`background.js | Opening tab array: `, tabArray);

  try {
    chrome.windows.getAll(async windows => {
      if (windows.length === 0) {
        await chrome.windows.create({});
      }
  
      for (const tab of tabArray) {
        if (tab.url && !index.hasBrowserTab(tab.url)) {
          console.log(`background.js | Opening tab ${tab.url}`);
          await browserOpenTab(tab);  // assuming browserOpenTab is an export async function
        }
      }
    });
  } catch (error) {
    console.error('background.js | Error opening tab array:', error);
  }
}


export function browserCloseTab(id: number | undefined) {
  if (!id) return false;
  return browser.tabs.remove(id);
}

export function browserCloseTabArray(tabArray: number[] | undefined) {
  if (!tabArray || !tabArray.length) return false;
  return browser.tabs.remove(tabArray);
}

export async function browserCloseNonContextTabs() {
  try {
    browser.tabs.query({}, async tabs => {
      let tabsToRemove = tabs.filter(tab => tab.url && !index.hasCanvasTab(tab.url));
      if (tabsToRemove.length === 0) return;
  
      if (tabs.length === tabsToRemove.length) {
        // Open a new tab before closing all others to ensure at least one remains
        await browser.tabs.create({});
      }
  
      for (const tab of tabsToRemove) {
        console.log(`background.js | Removing tab ${tab.id}`);
        if (tab.id) await browser.tabs.remove(tab.id);  // Using await here to ensure tab is removed
      }  
    });
  } catch (error) {
    console.error('Error in closing non-context tabs:', error);
  }
}


export function sanitizeContextPath(path: string | undefined) {
  if (!path || path == '/') return 'universe:///'
  path = path
  //.replace(/\/\//g, '/')
  //.replace(/\:/g, '')
  //.replace(/universe/g,'∞')

  return path
}

export function stripTabProperties(tab: ICanvasTab) {
  return {
    id: tab.id,
    index: tab.index,
    // Restore may fail if windowId does not exist
    // TODO: Handle this case with windows.create()
    // windowId: tab.windowId,
    highlighted: tab.highlighted,
    active: tab.active,
    pinned: tab.pinned,

    // hidden: tab.hidden, // commented out

    // boolean. Whether the tab is created and made visible in the tab bar without any content
    // loaded into memory, a state known as discarded. The tab's content is loaded when the tab
    // is activated.
    // Defaults to true to conserve memory on restore
    discarded: true, // tab.discarded,
    incognito: tab.incognito,
    //width: 1872,
    //height: 1004,
    //lastAccessed: 1675111332554,
    audible: tab.audible,
    mutedInfo: tab.mutedInfo,
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl

    // removed:
    // isArticle: tab.isArticle,
    // isInReaderMode: tab.isInReaderMode,
    // sharingState: tab.sharingState,
  }
}


export const sleep = (ms: number = 1000) => new Promise(r => setTimeout(r, ms));


export const onContextTabsUpdated = (updateInfo: IUpdatedTabsData) => {
  browser.runtime.sendMessage({ type: RUNTIME_MESSAGES.tabs_updated, payload: updateInfo }).catch(e => console.log(e));
}

export const sendRuntimeMessage = async (message: { type: string, payload: any }) => {
  return browser.runtime.sendMessage(message).catch(e => console.log(e));
}