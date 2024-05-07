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
    autoBrowserTabsSync: "Never" | "On Context Change" | "Always";
    tabBehaviorOnContextChange: "Close" | "Save and Close" | "Keep";
    autoOpenCanvasTabs: boolean,
    autoRestoreSession: boolean,
    autoSaveSession: boolean,
    autoOpenTabs: boolean,
    autoCloseTabs: boolean,
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
  insertedTabs?: ICanvasTab[];
  removedTabs?: ICanvasTab[];
}

interface IUpdatedTabsData {
  canvasTabs?: IUpdateTypes;
  openedCanvasTabs?: IUpdateTypes;
  browserTabs?: IUpdateTypes;
  syncedBrowserTabs?: IUpdateTypes;
}

interface IVarState {
  connected: boolean;
  context: IContext;
  retrying: boolean;
  pinnedTabs: string[];
}

interface ITabsInfo {
  canvasTabs: ICanvasTab[];
  browserTabs: ICanvasTab[];
  openedCanvasTabs: ICanvasTab[];
  syncedBrowserTabs: ICanvasTab[];
}

interface ICanvasTab extends chrome.tabs.Tab {
  docId?: number;
}

type IVersionInput = 0;

type IEncodings = "utf8";

type IBrowserType = "Edge" | "Firefox" | "Chrome";

interface ICanvasInsertMetaRequestInputs {
  url: string;
  browser: IBrowserType;
}

interface ISocketResponse<T> {
  status: "success" | "error";
  message?: string;
  payload: T;
}

type IRequestTypes = "data/abstraction/tab";

interface ICanvasInsertResponsePayload {
  id: number;
  type: IRequestTypes;
  version: IVersionInput;
  checksum: string;
  meta: {
    contentEncoding: IEncodings;
    contentType: "application/json";
    created: string;
    modified: string;  
  } & ICanvasInsertMetaRequestInputs
}

type ICanvasInsertResponse = ISocketResponse<ICanvasInsertResponsePayload[]>;

type ICanvasInsertOneResponse = ISocketResponse<ICanvasInsertResponsePayload>;

interface IFormattedTabProperties {
  type: IRequestTypes,
  meta: Partial<ICanvasInsertMetaRequestInputs>,
  data: ICanvasTab,
}