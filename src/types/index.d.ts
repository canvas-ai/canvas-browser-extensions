interface ITabDocumentSchema {
  type: string,
  meta: any,
  data: any
}

interface IContext {
  url: string;
  color: string;
  path?: string;
  pathArray?: any;
  tree?: any;
}

type IProtocol = "http" | "https";

interface IConfigProps {
  sync: {
    autoRestoreSession: boolean,
    autoSaveSession: boolean,
    autoOpenTabs: boolean,
    autoCloseTabs: boolean,
    // autoCloseTabsBehavior:
    // - saveToCurrentContext
    // - saveToNewContext
    // - saveToTrash
    // - saveToUniverse
    // - ignore (leave open, do not sync to Canvas)
    autoCloseTabsBehavior: "ignore" | "saveToUniverse" | "saveToTrash" | "saveToNewContext" | "saveToCurrentContext"
  },

  session: {},

  transport: {
    protocol: IProtocol,
    host: string,
    port: number | "",
    token: string,
    pinToContext: string
  },
}

interface IConfig extends IConfigProps {

  set: (key: string, value: T) => T,

  get: (key: string) => any
}

interface IUpdateTypes {
  insertedTabs?: chrome.tabs.Tab[];
  removedTabs?: chrome.tabs.Tab[];
}

interface IUpdatedTabsData {
  canvasTabs?: IUpdateTypes;
  browserTabs?: IUpdateTypes;
}