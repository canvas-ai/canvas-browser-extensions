import { SOCKET_MESSAGES, RUNTIME_MESSAGES } from "@/general/constants";
import { getSocket } from "./socket";
import index from "./TabIndex";
import { genFeatureArray, getCurrentBrowser, onContextTabsUpdated, sendRuntimeMessage } from "./utils";
import { browser } from "@/general/utils";

const getContext = async () => {
  const selectedContext = await browser.storage.local.get(["CNVS_SELECTED_CONTEXT"]);
  if (selectedContext.CNVS_SELECTED_CONTEXT) {
    return selectedContext.CNVS_SELECTED_CONTEXT;
  }
  
  const contexts = await browser.storage.local.get(["contexts"]);
  return contexts.contexts[0] || null;
}

const getContextId = async () => {
  try {
    const context: IContext | null = await getContext();
    if(!context) return "default";
    return `${context.userId}/${context.id}`;
  } catch (error) {
    console.error("background.js | Error getting context id", error);
    return 'default';
  }
};

export const canvasFetchContext = async (): Promise<IContext> => {
  const socket = await getSocket();
  return new Promise(async (resolve, reject) => {
    socket.emit('context:get', await getContextId(), (response: any) => {
      if (response && response.status === 'success') {
        resolve(response.payload.context);
      } else {
        reject(new Error(response?.message || 'Failed to fetch context'));
      }
    });
  });
};

export const requestFetchTabsForContext = async (): Promise<chrome.tabs.Tab[]> => {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.on(SOCKET_MESSAGES.DOCUMENT_CONTEXT.LIST_RESULT, (res: any) => {
      console.log(`background.js | [${SOCKET_MESSAGES.DOCUMENT_CONTEXT.LIST_RESULT}] Tabs fetched: `, res.payload);
      socket.removeAllListeners(SOCKET_MESSAGES.DOCUMENT_CONTEXT.LIST_RESULT);
      if (res && res.status === 'success' && res.payload) {
        resolve(res.payload.map((document: any) => ({...document.data, docId: document.id})));
      } else {
        reject(new Error(res?.message || 'Failed to fetch tabs'));
        console.error('background.js | Invalid payload received for context:documents:list:result:', res);
      }
    });
    console.log("background.js | Fetching tabs for context: ", await getContextId());
    socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.LIST, {
      contextId: await getContextId(),
      featureArray: genFeatureArray("READ"),
      filterArray: [],
      options: {}
    }, (res: any) => {
      console.log(`background.js | [${SOCKET_MESSAGES.DOCUMENT_CONTEXT.LIST}] Tabs fetched: `, res.payload);
      socket.removeAllListeners(SOCKET_MESSAGES.DOCUMENT_CONTEXT.LIST_RESULT);
      if (res && res.status === 'success' && res.payload) {
        resolve(res);
      } else {
        reject(new Error(res?.message || 'Failed to fetch tabs'));
        console.error('background.js | Invalid payload received for context:documents:list:result:', res);
      }
    });
  });
};

export function canvasFetchContextUrl(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(SOCKET_MESSAGES.CONTEXT.GET_URL, await getContextId(), (res) => {
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
      contextId: await getContextId(),
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

export function canvasInsertDocument(document: any, featureArray: string[] = [], options: any = {}): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    
    if (!document) {
      reject(new Error("Document is required"));
      return;
    }

    try {
      const contextId = await getContextId();
      
      // Use the socket's emit method which returns a Promise
      const response: any = await socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT, {
        contextId,
        document,
        featureArray,
        options
      });

      if (!response) {
        console.error("background.js | No response received for document insert");
        reject(new Error("No response received from Canvas"));
        return;
      }

      if (response.status === "success") {
        console.log("background.js | Document inserted successfully: ", response);
        
        // Update tab index and sync status if this is a tab document
        if (document.schema === 'data/abstraction/tab' && document.data && response.payload) {
          const insertedTab = {
            ...document.data,
            docId: response.payload.id
          };
          
                  // Add to canvas tabs index (without triggering UI updates)
        index.insertCanvasTabSilent(insertedTab);
        
        // Notify UI about the tab changes
        onContextTabsUpdated({
          canvasTabs: { insertedTabs: [insertedTab] }
        });
        
        // Send success message
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.success_message, payload: 'Document inserted to Canvas' });
        
        // Update browser tabs to recalculate synced status (debounced)
        index.updateBrowserTabsWithDelay();
        }
        
        resolve(response);
      } else if (response.status === "error") {
        console.error("background.js | Error inserting document: ", response);
        reject(new Error(response.message || "Error inserting document to Canvas"));
      } else {
        console.error("background.js | Unexpected response status: ", response);
        reject(new Error("Unexpected response from Canvas"));
      }
    } catch (error) {
      console.error("background.js | Exception in canvasInsertDocument: ", error);
      reject(error);
    }
  });
}

// Enhanced version with proper tab features and write permissions
export function canvasInsertDocumentWithFeatures(document: any, options: any = {}): Promise<any> {
  const featureArray = genFeatureArray("WRITE");
  return canvasInsertDocument(document, featureArray, options);
}

export function canvasUpdateDocument(document: any): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.REMOVE, {
      contextId: await getContextId(),
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
      contextId: await getContextId(),
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
        contextId: await getContextId(),
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
      reject(new Error("background.js | Invalid tab"));
      return;
    }

    try {
      const contextId = await getContextId();
      const featureArray = genFeatureArray("WRITE");
      
      // Use the socket's emit method which returns a Promise
      const response: any = await socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT, {
        contextId,
        document: formatTabProperties(tab),
        featureArray,
        options: {}
      });

      if (!response) {
        console.error("background.js | No response received for tab insert");
        reject(new Error("No response received from Canvas"));
        return;
      }

      if (response.status === "success") {
        console.log(`background.js | Tab ${tab.id} inserted successfully: `, response);
        
        // Update the tab with the document ID from the response
        const insertedTab = {
          ...tab,
          docId: response.payload.id
        };
        
        // Add to canvas tabs index (without triggering UI updates)
        index.insertCanvasTabSilent(insertedTab);
        
        // Notify UI about the tab changes
        onContextTabsUpdated({
          canvasTabs: { insertedTabs: [insertedTab] }
        });
        
        // Send success message
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.success_message, payload: 'Tab inserted to Canvas' });
        
        // Update browser tabs to recalculate synced status (debounced)
        index.updateBrowserTabsWithDelay();
        
        resolve(response);
      } else if (response.status === "error") {
        console.error(`background.js | Error inserting tab ${tab.id}: `, response);
        reject(new Error(response.message || "Error inserting tab to Canvas"));
      } else {
        console.error(`background.js | Unexpected response status for tab ${tab.id}: `, response);
        reject(new Error("Unexpected response from Canvas"));
      }
    } catch (error) {
      console.error("background.js | Exception in canvasInsertTab: ", error);
      reject(error);
    }
  });
}

export function canvasInsertTabArray(tabArray: ICanvasTab[]): Promise<ICanvasInsertResponse> {
  return new Promise(async (resolve, reject) => {
    if (!tabArray || !tabArray.length) {
      reject(new Error("background.js | Invalid tab array"));
      return;
    }

    const socket = await getSocket();
    socket.on(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT_ARRAY_RESULT, (response: any) => {
      socket.removeAllListeners(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT_ARRAY_RESULT);
      console.log('background.js | Tab array inserted to Canvas: ', response);
      if (response && response.status === 'success' && response.payload) {
        console.log(`background.js | Tab array inserted successfully: `, response);
          
        // Map the inserted tabs with their document IDs
        const insertedTabs = tabArray.map((tab, index) => ({
          ...tab,
          docId: response.payload[index]?.id
        }));
        
        index.insertCanvasTabArraySilent(insertedTabs, false);
        
        // Notify UI about the tab changes
        onContextTabsUpdated({
          canvasTabs: { insertedTabs }
        });
        
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.success_message, payload: 'Tabs inserted to Canvas' });
        
        // Update browser tabs to recalculate synced status (debounced)
        index.updateBrowserTabsWithDelay();
        
        resolve(response);
  
      } else if (response.status === "error") {
        console.error("background.js | Error inserting tab array: ", response);
        reject(new Error(response.message || "Error inserting tab array to Canvas"));
      } else {
        console.error("background.js | Unexpected response status for tab array: ", response);
        reject(new Error("Unexpected response from Canvas"));
      }
    });

    try {
      const contextId = await getContextId();
      const featureArray = genFeatureArray("WRITE");
      
      socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT_ARRAY, {
        contextId,
        documents: tabArray.map((tab) => formatTabProperties(tab))
      }, featureArray);
    } catch (error) {
      console.error("background.js | Exception in canvasInsertTabArray: ", error);
      reject(error);
    }
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
    
    // Extract the duplicated success handling logic into a reusable function
    const handleSuccessResponse = (res: any) => {
      socket.removeAllListeners(`${ROUTE}:result`);
      if (res.status === "success") {
        console.log(`background.js | Successful tab(${tab.id}) ${log} from canvas: `, res);
        index.removeCanvasTab(tab.url as string);
        onContextTabsUpdated({ canvasTabs: { removedTabs: [tab] } });
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.success_message, payload: `Tab ${log}d from Canvas` });
        index.updateBrowserTabsWithDelay();
        resolve(res);
      } else {
        console.error(`background.js | Failed ${log} for tab ${tab.id}:`)
        console.error(res);
        resolve(false);
      }
    };
    
    socket.on(`${ROUTE}:result`, handleSuccessResponse);
    
    if(!tab.docId) tab.docId = index.getCanvasDocumentIdByTabUrl(tab.url as string);
    socket.emit(ROUTE, {
      contextId: await getContextId(),
      documentId: tab.docId
    }, handleSuccessResponse);
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
      contextId: await getContextId(),
      documentIdArray: tabs.map(tab => tab.docId)
    }, (res) => {
      if (res.status === "success") {
        console.log(`background.js | Successful ${log} tabs from canvas result: `, res);
        tabs.forEach(tab => index.removeCanvasTab(tab.url as string));
        onContextTabsUpdated({ canvasTabs: { removedTabs: tabs } });
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.success_message, payload: `Tabs ${log}d from Canvas` });
        index.updateBrowserTabsWithDelay();
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
      reject(new Error("background.js | Invalid tab array"));
      return;
    }

    try {
      const contextId = await getContextId();
      const featureArray = genFeatureArray("WRITE");
      
      console.log(`SAVING FOR CONTEXT ${contextUrlArray.toString()}`, tabArray);
      
      const response: any = await socket.emit(SOCKET_MESSAGES.DOCUMENT.INSERT_ARRAY, {
        contextId,
        documents: tabArray.map((tab) => formatTabProperties(tab)),
        contextUrlArray
      }, featureArray);

      if (!response) {
        console.error("background.js | No response received for document tab array insert");
        reject(new Error("No response received from Canvas"));
        return;
      }

      if (response.status === "success") {
        console.log(`background.js | Document tab array inserted successfully: `, response);
        
        // Map the inserted tabs with their document IDs
        const insertedTabs = tabArray.map((tab, index) => ({
          ...tab,
          docId: response.payload[index]?.id
        }));
        
        // Add all tabs to canvas tabs index (without triggering UI updates)
        index.insertCanvasTabArraySilent(insertedTabs, false);
        
        // Notify UI about the tab changes
        onContextTabsUpdated({
          canvasTabs: { insertedTabs }
        });
        
        // Send success message
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.success_message, payload: 'Document tabs inserted to Canvas' });
        
        // Update browser tabs to recalculate synced status (debounced)
        index.updateBrowserTabsWithDelay();
        
        resolve(response);
      } else if (response.status === "error") {
        console.error("background.js | Error inserting document tab array: ", response);
        reject(new Error(response.message || "Error inserting document tab array to Canvas"));
      } else {
        console.error("background.js | Unexpected response status for document tab array: ", response);
        reject(new Error("Unexpected response from Canvas"));
      }
    } catch (error) {
      console.error("background.js | Exception in documentInsertTabArray: ", error);
      reject(error);
    }
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

async function getUserInfo(): Promise<null | IUserInfo> {
  try {
    const result = await browser.storage.local.get(["CNVS_USER_INFO"]);
    const userInfo = result.CNVS_USER_INFO || null;
    return userInfo;
  } catch (error) {
    console.error("Error retrieving user info:", error);
    return null;
  }
}
