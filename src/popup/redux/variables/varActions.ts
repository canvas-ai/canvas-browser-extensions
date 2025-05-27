import { SET_CONNECTED, SET_RETRYING, VariableActionTypes } from "./varActionTypes";
import { browser } from "@/general/utils";

export const setRetrying = (retrying: boolean): VariableActionTypes => ({
  type: SET_RETRYING,
  payload: retrying
});

export const setConnected = (connected: boolean): VariableActionTypes => ({
  type: SET_CONNECTED,
  payload: connected,
});

// Storage-based functions (no Redux actions needed)
export const saveSessionList = async (sessions: ISession[]) => {
  await browser.storage.local.set({ CNVS_SESSION_LIST: sessions });
};

export const getSessionList = async (): Promise<ISession[]> => {
  const result = await browser.storage.local.get(["CNVS_SESSION_LIST"]);
  return result.CNVS_SESSION_LIST || [{ id: "Default", baseUrl: "/" }];
};

export const saveUserInfo = async (userInfo: { userId: string; email: string; }) => {
  await browser.storage.local.set({ CNVS_USER_INFO: userInfo });
};

export const getUserInfo = async (): Promise<IUserInfo | null> => {
  const result = await browser.storage.local.get(["CNVS_USER_INFO"]);
  return result.CNVS_USER_INFO || null;
};

export const saveContext = async (context: IContext) => {
  await browser.storage.local.set({ CNVS_CONTEXT: context });
};

export const getContext = async (): Promise<IContext | null> => {
  const result = await browser.storage.local.get(["CNVS_CONTEXT"]);
  return result.CNVS_CONTEXT || null;
};

export const savePinnedTabs = async (pinnedTabs: string[]) => {
  await browser.storage.local.set({ CNVS_PINNED_TABS: pinnedTabs });
};

export const getPinnedTabs = async (): Promise<string[]> => {
  const result = await browser.storage.local.get(["CNVS_PINNED_TABS"]);
  return result.CNVS_PINNED_TABS || [];
};