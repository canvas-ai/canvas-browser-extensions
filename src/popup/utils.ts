import { Dispatch } from "redux";
import { setBrowserTabs, setCanvasTabs } from "./redux/tabs/tabActions";
import { RUNTIME_MESSAGES } from "@/general/constants";
import { toast } from "react-toastify";

export const browser: typeof chrome = globalThis.browser || chrome;

export const requestVariableUpdate = (message: { action: string }) => {
  return browser.runtime.sendMessage(message);
}

export const sanitizeContextUrl = (url: string | undefined) => {
  console.log('UI | Sanitizing context URL')
  console.log(url)
  if (!url || url == '/' || url == 'universe:///') return 'Universe'
  url = url
      // .replace(/^universe/, 'Universe')
      .replace(/\/\//g, '/')
      .replace(/\:/g, '')
      .split("")
      .map((ch, i, self) => i && self[i-1] !== '/' ? ch : ch.toUpperCase())
      .join("");
      //.replace(/universe/g,'∞')
  return url
}

export const getContextBreadcrumbs = (url: string | undefined) => {
  console.log('UI | Updating breadcrumbs')
  if (!url) return []; // console.error('UI | No URL provided')
  if (typeof url !== 'string') return []; // console.error('UI | URL is not a string')

  url = sanitizeContextUrl(url)
  const breadcrumbNames = url.split("/").filter((name) => name !== "");
  return breadcrumbNames.map((name) => {
    return {
      href: "#!",
      className: "breadcrumb black-text",
      textContent: name
    }
  });
}

export const requestUpdateTabs = () => {
  requestVariableUpdate({ action: RUNTIME_MESSAGES.index_get_deltaBrowserToCanvas });
  requestVariableUpdate({ action: RUNTIME_MESSAGES.index_get_deltaCanvasToBrowser });
}

export const tabsUpdated = (dispatch: Dispatch<any>, updateData: IUpdateTypes, adder: (tabs: chrome.tabs.Tab[]) => void, remover: (tabs: chrome.tabs.Tab[]) => void) => {
  if(updateData.insertedTabs && updateData.insertedTabs.length) {
    tabsInserted(dispatch, updateData.insertedTabs, adder);
  }
  if(updateData.removedTabs && updateData.removedTabs.length) {
    tabsRemoved(dispatch, updateData.removedTabs, remover);
  }
}

export const tabsInserted = (dispatch: Dispatch<any>, insertedTabs: chrome.tabs.Tab[], adder: (insertedTabs: chrome.tabs.Tab[]) => void) => {
  dispatch(adder(insertedTabs));
}

export const tabsRemoved = (dispatch: Dispatch<any>, removedTabs: chrome.tabs.Tab[], remover: (removedTabs: chrome.tabs.Tab[]) => void) => {
  dispatch(remover(removedTabs));
}

export const showErrorMessage = (message: string) => {
  toast(message, {
    
  });
}

export const showSuccessMessage = (message: string) => {
  toast(message, {
    
  });
}
