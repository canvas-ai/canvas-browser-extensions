interface ITabDocumentSchema {
  schema: string | string[],
  data: any
}

interface IContext {
  id: string;
  url: string;
  contextBitmapArray: string[];
  color: string;
  path?: string;
  pathArray?: any;
  tree?: any;
  acl?: object;
  baseUrl?: string;
  clientContextArray?: any[];
  featureBitmapArray?: any[];
  filterArray?: any[];
  locked?: boolean;
  pendingUrl?: any;
  serverContextArray?: any[];
  userId?: string;
  workspaceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

type IProtocol = "http" | "https";
type IContextChangeBehavior = "Close Current and Open New" | "Save and Close Current and Open New" | "Keep Current and Open New" | "Keep Current and Do Not Open New";

interface IConfigProps {
  sync: {
    tabBehaviorOnContextChange: IContextChangeBehavior;
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
    isApiToken: boolean
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

interface IUserInfo {
  userId: string;
  email: string;
}

interface IVarState {
  connected: boolean;
  retrying: boolean;
}

interface ITabsInfo {
  canvasTabs: ICanvasTab[];
  browserTabs: ICanvasTab[];
  openedCanvasTabs: ICanvasTab[];
  syncedBrowserTabs: ICanvasTab[];
}

interface ICanvasTab extends chrome.tabs.Tab {
  docId?: number;
  browser?: IBrowserType;
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
  schema: 'data/abstraction/tab',
  data: ICanvasTab,
}

interface ISessionContext {
    id: string;
    sessionId: string;
    baseUrl: string;
    url: string;
    path: string;
    array: any[];
    contextBitmapArray: string[];
    featureArray: any[];
    filterArray: any[];
}

interface ISession {
  id: string;
  baseUrl: string;
  contexts?: { [key: string]: ISessionContext };
}
