import { SOCKET_MESSAGES, SOCKET_EVENTS } from "@/general/constants";
import { getSocket } from "./socket";
import index from "./TabIndex";
import { genFeatureArray, getCurrentBrowser, onContextTabsUpdated } from "./utils";
import { IContext } from "@/types/IContext";
import { context as currentActiveContext } from "./context";


export const canvasFetchTabsForContext = async (contextId: string) => {
  const socket = await getSocket();
  return socket.listDocuments(contextId);
};

export function canvasFetchContextUrl(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(SOCKET_MESSAGES.CONTEXT.GET_URL, {}, (res) => {
      if (!res || res.status !== "success") {
        console.error("background.js | Error fetching context URL", res);
        reject(res?.message || "Error fetching context url from Canvas");
      } else {
        console.log("background.js | Context URL fetched: ", res);
        resolve(res.payload);
      }
    });
  });
}

export const canvasFetchContext = async (contextId?: string) => {
  const socket = await getSocket();
  if (!contextId) {
    // fallback: get current context from extension state if needed
    throw new Error('contextId required for canvasFetchContext');
  }
  return socket.getContext(contextId);
};

export async function canvasFetchDocuments(contextId: string, featureArray: string[]): Promise<any[]> {
  const socket = await getSocket();
  // Use the new websocket-centric API helper
  return socket.listDocuments(contextId, featureArray);
}

export const canvasInsertDocument = async (contextId: string, document: any, featureArray = [], options = {}) => {
  const socket = await getSocket();
  return socket.insertDocument(contextId, document, featureArray, options);
};

export const canvasUpdateDocument = async (contextId: string, document: any, featureArray = [], options = {}) => {
  const socket = await getSocket();
  return socket.updateDocument(contextId, document, featureArray, options);
};

export const canvasRemoveDocument = async (contextId: string, documentId: string) => {
  const socket = await getSocket();
  return socket.removeDocument(contextId, documentId);
};

export const canvasDeleteDocument = async (contextId: string, documentId: string) => {
  const socket = await getSocket();
  return socket.deleteDocument(contextId, documentId);
};

export function canvasFetchTab(docId: number) {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(
      SOCKET_MESSAGES.DOCUMENT_CONTEXT.GET,
      genFeatureArray("READ"),
      docId,
      (res) => {
        console.log("background.js | Tab fetched: ", res);
        resolve(res);
      }
    );
  });
}

export function canvasInsertTab(tab: ICanvasTab): Promise<ICanvasInsertOneResponse> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    if (!currentActiveContext.id) {
      console.error("background.js | canvasInsertTab: Active contextId is not available.");
      return reject("Active contextId is not available. Cannot insert tab.");
    }
    if (!tab) {
      return reject("background.js | Invalid tab");
    }
    const payload = {
      contextId: currentActiveContext.id,
      document: formatTabProperties(tab),
      featureArray: genFeatureArray("WRITE")
    };
    socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT, payload, (res: ICanvasInsertOneResponse) => {
      if (res && res.status === 'success') {
        resolve(res);
      } else {
        console.error('background.js | canvasInsertTab failed or unexpected response:', res);
        reject(res?.message || "Insert tab failed or unexpected response from server");
      }
    });
  });
}

export function canvasInsertTabArray(tabArray: ICanvasTab[]): Promise<ICanvasInsertResponse> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    if (!currentActiveContext.id) {
      console.error("background.js | canvasInsertTabArray: Active contextId is not available.");
      return reject("Active contextId is not available. Cannot insert tabs.");
    }
    if (!tabArray || !tabArray.length) {
      return reject("background.js | Invalid tab array");
    }
    const payload = {
      contextId: currentActiveContext.id,
      documents: tabArray.map((t) => formatTabProperties(t)),
      featureArray: genFeatureArray("WRITE")
    };
    socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT_ARRAY, payload, (res: ICanvasInsertResponse) => {
      if (res && res.status === 'success') {
        resolve(res);
      } else {
        console.error('background.js | canvasInsertTabArray failed or unexpected response:', res);
        reject(res?.message || "Insert tab array failed or unexpected response from server");
      }
    });
  });
}

export function canvasUpdateTab(tab: ITabDocumentSchema): Promise<any> {
  return new Promise((resolve, reject) => {
    // TODO: Implement the logic for updating a tab
  });
}

function deleteOrRemoveTab(ROUTE: string, tab: ICanvasTab, log: "remove" | "delete") {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    if(!tab.docId) tab.docId = index.getCanvasDocumentIdByTabUrl(tab.url as string);
    socket.emit(ROUTE, tab.docId, (res) => {
      if (res.status === "success") {
        console.log(`background.js | Successful tab(${tab.id}) ${log} from canvas: `, res);
        index.removeCanvasTab(tab.url as string);
        onContextTabsUpdated({ canvasTabs: { removedTabs: [tab] } });
        resolve(res);
      } else {
        console.error(`background.js | Failed ${log} for tab ${tab.id}:`)
        console.error(res);
        resolve(false);
      }
    });
  });
}

function deleteOrRemoveTabs(ROUTE: string, tabs: ICanvasTab[], log: "remove" | "delete") {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    tabs = tabs.map(tab => {
      if(!tab.docId) tab.docId = index.getCanvasDocumentIdByTabUrl(tab.url as string);
      return tab;
    });
    socket.emit(ROUTE, tabs.map(tab => tab.docId), (res) => {
      if (res.status === "success") {
        console.log(`background.js | Successful ${log} tabs from canvas result: `, res);
        tabs.forEach(tab => index.removeCanvasTab(tab.url as string));
        onContextTabsUpdated({ canvasTabs: { removedTabs: tabs } });
        resolve(res);
      } else {
        console.error(`background.js | Failed ${log} for tabs:`)
        console.error(res);
        resolve(false);
      }
    });
  });
}

export function canvasRemoveTab(tab: ICanvasTab) {
  return deleteOrRemoveTab(SOCKET_MESSAGES.DOCUMENT_CONTEXT.REMOVE, tab, "remove");
}

export function canvasDeleteTab(tab: ICanvasTab) {
  return deleteOrRemoveTab(SOCKET_MESSAGES.DOCUMENT_CONTEXT.DELETE, tab, "remove");
}

export function canvasRemoveTabs(tabs: ICanvasTab[]) {
  return deleteOrRemoveTabs(SOCKET_MESSAGES.DOCUMENT_CONTEXT.REMOVE_ARRAY, tabs, "remove");
}

export function canvasDeleteTabs(tabs: ICanvasTab[]) {
  return deleteOrRemoveTabs(SOCKET_MESSAGES.DOCUMENT_CONTEXT.DELETE_ARRAY, tabs, "delete");
}

export function documentInsertTabArray(tabArray: ICanvasTab[], contextUrlArray: string[]): Promise<ICanvasInsertResponse> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    if (!tabArray || !tabArray.length) {
      reject("background.js | Invalid tab array");
    }
    console.log(`SAVING FOR CONTEXT ${contextUrlArray.toString()}`, tabArray);
    socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT_ARRAY,
      {
        contextId: contextUrlArray[0],
        documents: tabArray.map((tab) => formatTabProperties(tab)),
        featureArray: genFeatureArray("WRITE")
      },
      resolve
    );
  });
}

export function formatTabProperties(tab: ICanvasTab): IFormattedTabProperties {
  return {
    schema: 'data/abstraction/tab',
    data: {
      browser: getCurrentBrowser(),
      url: tab.url || '',
      tabData: { ...tab },
    },
  };
}

/**
 * Fetch user contexts from Canvas
 */
export const canvasFetchUserContexts = async () => {
  try {
    const socket = await getSocket();
    const contexts = await socket.listContexts();

    // Filter out any null or undefined contexts and log a warning
    const validContexts = contexts.filter(ctx => {
      if (!ctx) {
        console.warn('background.js | canvasFetchUserContexts received null or undefined context');
        return false;
      }
      return true;
    });

    if (validContexts.length === 0 && contexts.length > 0) {
      console.error('background.js | canvasFetchUserContexts: All contexts were invalid');
    }

    console.log(`background.js | canvasFetchUserContexts: Fetched ${validContexts.length} contexts`);
    return validContexts;
  } catch (error) {
    console.error('background.js | canvasFetchUserContexts error:', error);
    return [];
  }
};
