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
  return url
}

export const getContextBreadcrumbs = async (): Promise<Array<{href: string, className: string, textContent: string}>> => {
  try {
    // Get the selected context from storage
    const result = await browser.storage.local.get(["CNVS_SELECTED_CONTEXT", "contexts"]);
    const selectedContext = result.CNVS_SELECTED_CONTEXT;
    const contexts = result.contexts;

    // Use selected context if available, otherwise fallback to first context in list
    const contextToUse = selectedContext || (contexts && contexts.length > 0 ? contexts[0] : null);

    if (!contextToUse || !contextToUse.url) {
      return [];
    }

    return await getContextBreadcrumbsFromContext(contextToUse);
  } catch (error) {
    console.error("Error getting context breadcrumbs:", error);
    return [];
  }
}

const createBreadcrumbsFromUrl = (url: string): Array<{href: string, className: string, textContent: string}> => {
  if (!url || typeof url !== 'string') return [];

  const sanitizedUrl = sanitizeContextUrl(url);
  const breadcrumbNames = sanitizedUrl.split("/").filter((name) => name !== "");

  return breadcrumbNames.map((name) => {
    return {
      href: "#!",
      className: "breadcrumb black-text",
      textContent: name
    }
  });
}

export const getContextBreadcrumbsFromContext = async (context: IContext | null): Promise<Array<{href: string, className: string, textContent: string}>> => {
  if (!context || !context.url) return [];

  try {
    // Get current user info to determine if context is shared
    const result = await browser.storage.local.get(["userInfo", "CNVS_USER_INFO", "user"]);
    const userInfo = result.userInfo || result.CNVS_USER_INFO || result.user;

    // Determine if context is shared
    const isShared = context.userId && userInfo?.userId && context.userId !== userInfo.userId;

    // Format: "(context.id) context.url" or "(context.id) context.url (shared)"
    const contextLabel = isShared
      ? `(${context.id}) ${context.url} (shared)`
      : `(${context.id}) ${context.url}`;

    return [{
      href: "#!",
      className: "breadcrumb black-text",
      textContent: contextLabel
    }];
  } catch (error) {
    // Fallback to just (context.id) context.url if userInfo not available
    const contextLabel = `(${context.id}) ${context.url}`;
    return [{
      href: "#!",
      className: "breadcrumb black-text",
      textContent: contextLabel
    }];
  }
}

export const requestUpdateTabs = () => {
  requestVariableUpdate({ action: RUNTIME_MESSAGES.index_get_deltaBrowserToCanvas });
  requestVariableUpdate({ action: RUNTIME_MESSAGES.index_get_deltaCanvasToBrowser });
}

export const requestUpdateUserInfo = () => {
  requestVariableUpdate({ action: RUNTIME_MESSAGES.user_info });
}

export const requestUpdateSessionsList = () => {
  requestVariableUpdate({ action: RUNTIME_MESSAGES.update_sessions_list });
}

export const requestRefreshCanvasTabs = () => {
  return requestVariableUpdate({ action: RUNTIME_MESSAGES.canvas_tabs_refresh });
}

export const requestRefreshContextTabs = () => {
  return requestVariableUpdate({ action: RUNTIME_MESSAGES.context_refresh_tabs });
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

export const isOnUniverse = (context: IContext | null): boolean => {
  return !context || !context.url || context.url === '/' || context.url === 'universe:///';
}
