import { RUNTIME_MESSAGES } from "@/general/constants";
import index from "./TabIndex";
import { browser, getPinnedTabs, savePinnedTabsToStorage } from "@/general/utils";
import config from "@/general/config";
import { documentInsertTabArray } from "./canvas";

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
      }).then(newTab => {
        ["mutedInfo", "discarded", "active", "pinned", "title"].forEach(prop => {
          if(tab.hasOwnProperty(prop)) 
            newTab[prop] = tab[prop];
        });
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
    const windows = await browser.windows.getAll();
    if (windows.length === 0) {
      await browser.windows.create({});
    }

    for (const tab of tabArray) {
      if (tab.url && !index.hasBrowserTab(tab.url)) {
        console.log(`background.js | Opening tab ${tab.url}`);
        await browserOpenTab(tab);  // assuming browserOpenTab is an export async function
      }
    }
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

type IBeforeRemoveFunc = ((tabsToRemove: ICanvasTab[]) => Promise<ICanvasTab[]>) | ((tabsToRemove: ICanvasTab[]) => ICanvasTab[]);

export const getFilteredTabs = async (canvasTabs: ICanvasTab[], pinnedTabs: string[], tabs: null | ICanvasTab[] = null) => {
  tabs = tabs || await browser.tabs.query({});
  return tabs.filter(tab => tab.url && !canvasTabs.some(pct => pct.url === tab.url) && !pinnedTabs.some(url => tab.url === url))
}

export async function handleContextChangeTabUpdates(previousCanvasTabs: ICanvasTab[], pinnedTabs: string[], previousContextUrl: string | null = null) {
  try {
    const tabs = await browser.tabs.query({});
    if(previousContextUrl) {
      const syncableTabs = await getFilteredTabs(previousCanvasTabs, pinnedTabs, tabs);
      try {
        const res = await documentInsertTabArray(syncableTabs, [previousContextUrl]);
        if (!res || res.status === 'error') return console.error('background.js | Error inserting tabs to Canvas')
        console.log('background.js | Documents auto-inserted to Canvas: ', res);
      } catch (error) {
        console.error('background.js | Error updating documents:', error);
      }
    }
    
    const closableTabs = await getFilteredTabs(index.getCanvasTabArray(), pinnedTabs, tabs);

    if (tabs.length === closableTabs.length) {
      // Open a new tab before closing all others to ensure at least one remains
      await browser.tabs.create({});
    }

    for (const tab of closableTabs) {
      console.log(`background.js | Removing tab ${tab.id}`);
      if (tab.id) await browser.tabs.remove(tab.id);  // Using await here to ensure tab is removed
    }  
    await index.updateBrowserTabs();
  } catch (error) {
    console.error('Error in closing non-context tabs:', error);
  }
}

export function sanitizeContextPath(path: string | undefined) {
  if (!path || path == '/') return 'universe:///'
  return path
}

export function stripTabProperties(tab: ICanvasTab) {
  return {
    id: tab.id,
    index: tab.index,
    highlighted: tab.highlighted,
    active: tab.active,
    pinned: tab.pinned,

    // boolean. Whether the tab is created and made visible in the tab bar without any content
    // loaded into memory, a state known as discarded. The tab's content is loaded when the tab
    // is activated.
    // Defaults to true to conserve memory on restore
    discarded: true, // tab.discarded,

    incognito: tab.incognito,
    audible: tab.audible,
    mutedInfo: tab.mutedInfo,
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl
  }
}


export const sleep = (ms: number = 1000) => new Promise(r => setTimeout(r, ms));


export const onContextTabsUpdated = (updateInfo: IUpdatedTabsData) => {
  sendRuntimeMessage({ type: RUNTIME_MESSAGES.tabs_updated, payload: updateInfo }).catch(e => console.log(e));
}

export const sendRuntimeMessage = async (message: { type: string, payload: any }) => {
  return browser.runtime.sendMessage(message).catch(e => console.log(e));
}

export const getCurrentBrowser: () => IBrowserType = () => {
  const userAgent = navigator.userAgent;
  if(userAgent.includes("Edg")) return "edge";
  if(userAgent.includes("Firefox")) return "firefox";
  return "chrome";
}

export const filterRemovedPinnedTabs = async (tabsArray: ICanvasTab[]) => {
  const pinnedTabs = await getPinnedTabs();
  await savePinnedTabsToStorage(pinnedTabs.filter(url => tabsArray.some(tab => tab.url === url)));
}

export const genFeatureArray = (requestType: "READ" | "WRITE" = "READ") => {
  const features = [`data/abstraction/tab`];
  if(requestType === "WRITE") {
    features.push(`custom/app/${getCurrentBrowser()}`);
  }
  const bt = config.browserIdentity.browserTag.trim();
  if((requestType === "WRITE" || config.browserIdentity.syncOnlyTaggedTabs) && bt.length) {
    features.push(`custom/tag/${bt}`);
  }
  return features;
}