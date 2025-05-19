import { SOCKET_MESSAGES } from "@/general/constants";
import { getSocket } from "./socket";
import index from "./TabIndex";
import { genFeatureArray, getCurrentBrowser, onContextTabsUpdated } from "./utils";
import { RUNTIME_MESSAGES } from '@/general/constants';
import { sendRuntimeMessage } from './utils';
import config from '@/general/config';

const getContextId = () => {
  const userEmail = config.transport.token && !config.transport.isApiToken ?
    JSON.parse(atob(config.transport.token.split('.')[1])).email : '';
  return userEmail ? `${userEmail}/default` : 'default';
};

export const canvasFetchContext = async (): Promise<IContext> => {
  const socket = await getSocket();
  return new Promise((resolve, reject) => {
    socket.emit('context:get', getContextId(), (response: any) => {
      if (response && response.status === 'success') {
        resolve(response.payload.context);
      } else {
        reject(new Error(response?.message || 'Failed to fetch context'));
      }
    });
  });
};

export const canvasFetchTabsForContext = async (): Promise<any> => {
  const socket = await getSocket();
  return new Promise((resolve, reject) => {
    socket.emit('context:documents:list', {
      contextId: getContextId(),
      featureArray: ['tab'],
      filterArray: [],
      options: {}
    }, (response: any) => {
      if (response && response.status === 'success') {
        resolve(response);
      } else {
        reject(new Error(response?.message || 'Failed to fetch tabs'));
      }
    });
  });
};

export function canvasFetchContextUrl(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(SOCKET_MESSAGES.CONTEXT.GET_URL, getContextId(), (res) => {
      if (!res || res.status !== "success") {
        console.error("background.js | Error fetching context URL", res);
        reject("Error fetching context url from Canvas");
      } else {
        console.log("background.js | Context URL fetched: ", res);
        resolve(res.payload);
      }
    });
  });
}

export function canvasFetchDocuments(featureArray: string[]): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.GET_ARRAY, {
      contextId: getContextId(),
      featureArray
    }, (res) => {
      if (!res || res.status !== "success") {
        console.error("background.js | Error fetching documents", res);
        reject("Error fetching documents from Canvas");
      } else {
        console.log("background.js | Documents fetched: ", res);
        resolve(res);
      }
    });
  });
}

export function canvasInsertDocument(document: any): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT, {
      contextId: getContextId(),
      document
    }, (res) => {
      if (!res || res.status !== "success") {
        console.error("background.js | Error inserting document", res);
        reject("Error inserting document to Canvas");
      } else {
        console.log("background.js | Document inserted: ", res);
        resolve(res);
      }
    });
  });
}

export function canvasUpdateDocument(document: any): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.REMOVE, {
      contextId: getContextId(),
      document
    }, (res) => {
      if (!res || res.status !== "success") {
        console.error("background.js | Error updating document", res);
        reject("Error updating document in Canvas");
      } else {
        console.log("background.js | Document updated: ", res);
        resolve(res);
      }
    });
  });
}

export function canvasDeleteDocument(documentId: string): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.DELETE, {
      contextId: getContextId(),
      documentId
    }, (res) => {
      if (!res || res.status !== "success") {
        console.error("background.js | Error deleting document", res);
        reject("Error deleting document from Canvas");
      } else {
        console.log("background.js | Document deleted: ", res);
        resolve(res);
      }
    });
  });
}

export function canvasFetchTab(docId: number) {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(
      SOCKET_MESSAGES.DOCUMENT_CONTEXT.GET,
      {
        contextId: getContextId(),
        documentId: docId
      },
      genFeatureArray("READ"),
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
    if (!tab) {
      reject("background.js | Invalid tab");
    }
    socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT, {
      contextId: getContextId(),
      document: formatTabProperties(tab)
    }, genFeatureArray("WRITE"), resolve);
  });
}

export function canvasInsertTabArray(tabArray: ICanvasTab[]): Promise<ICanvasInsertResponse> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    if (!tabArray || !tabArray.length) {
      reject("background.js | Invalid tab array");
    }
    socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT_ARRAY, {
      contextId: getContextId(),
      documents: tabArray.map((tab) => formatTabProperties(tab))
    }, genFeatureArray("WRITE"), resolve);
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
    socket.emit(ROUTE, {
      contextId: getContextId(),
      documentId: tab.docId
    }, (res) => {
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
    socket.emit(ROUTE, {
      contextId: getContextId(),
      documentIdArray: tabs.map(tab => tab.docId)
    }, (res) => {
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
    socket.emit(SOCKET_MESSAGES.DOCUMENT.INSERT_ARRAY, {
      contextId: getContextId(),
      documents: tabArray.map((tab) => formatTabProperties(tab)),
      contextUrlArray
    }, genFeatureArray("WRITE"), resolve);
  });
}

export function formatTabProperties(tab: ICanvasTab): IFormattedTabProperties {
  if(!tab.docId) tab.docId = index.getCanvasDocumentIdByTabUrl(tab.url as string);
  return {
    schema: 'data/abstraction/tab',
    data: {
      url: tab.url,
      browser: getCurrentBrowser(),
      ...tab, id: tab.docId || tab.id
    },
  };
}
