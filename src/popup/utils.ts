import { Dispatch } from "redux";
import { RUNTIME_MESSAGES } from "@/general/constants";
import { toast } from "react-toastify";
import { browser } from "@/general/utils";

export const requestVariableUpdate = (message: { action: string }) => {
  return browser.runtime.sendMessage(message);
}

export const sanitizeContextUrl = (url: string | undefined) => {
  if (!url || url == '/' || url == 'universe:///') return 'Universe'
  url = url
      .replace(/\/\//g, '/')
      .replace(/\:/g, '')
      .split("")
      .map((ch, i, self) => i && self[i-1] !== '/' ? ch : ch.toUpperCase())
      .join("");
  return url
}

export const getContextBreadcrumbs = (url: string | undefined) => {
  if (!url) return [];
  if (typeof url !== 'string') return [];

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

export const requestUpdateSessionsList = () => {
  requestVariableUpdate({ action: RUNTIME_MESSAGES.update_sessions_list });
}

export const tabsUpdated = (dispatch: Dispatch<any>, updateData: IUpdateTypes, adder: (tabs: ICanvasTab[]) => void, remover: (tabs: ICanvasTab[]) => void) => {
  if(updateData.insertedTabs && updateData.insertedTabs.length) {
    tabsInserted(dispatch, updateData.insertedTabs, adder);
  }
  if(updateData.removedTabs && updateData.removedTabs.length) {
    tabsRemoved(dispatch, updateData.removedTabs, remover);
  }
}

export const tabsInserted = (dispatch: Dispatch<any>, insertedTabs: ICanvasTab[], adder: (insertedTabs: ICanvasTab[]) => void) => {
  dispatch(adder(insertedTabs));
}

export const tabsRemoved = (dispatch: Dispatch<any>, removedTabs: ICanvasTab[], remover: (removedTabs: ICanvasTab[]) => void) => {
  dispatch(remover(removedTabs));
}

export const showErrorMessage = (message: string) => {
  toast(message, { });
}

export const showSuccessMessage = (message: string) => {
  toast(message, { });
}

export const cx = (...classNames: (string | undefined)[]) => {
  return classNames.filter(c => c).join(" ");
}

export const isOnUniverse = (url: string) => {
  return getContextBreadcrumbs(url).length === 1 && getContextBreadcrumbs(url)[0].textContent.trim().toLowerCase() === "universe";
}