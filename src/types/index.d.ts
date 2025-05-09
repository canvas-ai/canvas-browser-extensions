interface ITabDocumentSchema {
  type: string | string[],
  meta: any,
  data: any
}

interface IContext {
  url: string;
  contextArray: string[];
  color: string;
  path?: string;
  pathArray?: any;
  tree?: any;
}

type IProtocol = "http" | "https";

interface IConfigProps {
  sync: {
    tabBehaviorOnContextChange: "Close" | "Save and Close" | "Keep";
    autoOpenCanvasTabs: boolean
  },

  browserIdentity: {
    syncOnlyTaggedTabs: boolean,
    browserTag: string
  },

  session: ISession,

  transport: {
    protocol: IProtocol,
    host: string,
    port: number | "",
    token: string,
    pinToContext: string,
    isApiToken: boolean,
    contextId: string
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
  sessions: ISession[];
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

type IBrowserType = "edge" | "firefox" | "chrome";

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
  type: 'data/abstraction/tab',
  meta: Partial<ICanvasInsertMetaRequestInputs>,
  data: ICanvasTab,
}

interface ISessionContext {
    id: string;
    sessionId: string;
    baseUrl: string;
    url: string;
    path: string;
    array: any[];
    contextArray: string[];
    featureArray: any[];
    filterArray: any[];
}

interface ISession {
  id: string;
  baseUrl: string;
  contexts?: { [key: string]: ISessionContext };
}
