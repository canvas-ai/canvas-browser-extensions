import { SOCKET_MESSAGES, RUNTIME_MESSAGES } from "@/general/constants";
import { getSocket } from "./socket";
import index from "./TabIndex";
import { genFeatureArray, getCurrentBrowser, onContextTabsUpdated, sendRuntimeMessage } from "./utils";
import { browser } from "@/general/utils";
import config from "@/general/config";
import { stripTabProperties } from "./utils";

// REST API Helper Functions
const getApiBaseUrl = async () => {
  await config.load();
  return `${config.transport.protocol}://${config.transport.host}:${config.transport.port}`;
};

const getAuthHeaders = async () => {
  await config.load();
  return {
    'Authorization': `Bearer ${config.transport.token}`,
    'Content-Type': 'application/json'
  };
};

const getContext = async () => {
  await config.load();
  return config.transport.pinToContext || 'universe:///';
};

const getContextId = async () => {
  const contextUrl = await getContext();

  // Extract context ID from URL - handle different formats
  if (contextUrl.includes('://')) {
    return contextUrl.replace(/^.*:\/\//, '').replace(/\/$/, '') || 'universe';
  }

  return contextUrl || 'universe';
};

// REST API Functions for Context Operations
export const canvasFetchContext = async (): Promise<IContext> => {
  const baseUrl = await getApiBaseUrl();
  const headers = await getAuthHeaders();
  const contextId = await getContextId();

  try {
    const response = await fetch(`${baseUrl}/contexts/${contextId}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch context: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.context || data;
  } catch (error) {
    console.error('background.js | Error fetching context via REST:', error);
    throw error;
  }
};

export const requestFetchTabsForContext = async (): Promise<chrome.tabs.Tab[]> => {
  const baseUrl = await getApiBaseUrl();
  const headers = await getAuthHeaders();
  const contextId = await getContextId();

  try {
    console.log(`background.js | Fetching tabs for context: ${contextId}`);

    const response = await fetch(`${baseUrl}/contexts/${contextId}/documents?schema=data/abstraction/tab`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch documents: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const documents = data.documents || data;

    // Map documents to tabs with docId
    const tabsWithDocId = documents.map((document: any) => {
      const tab = {
        ...document.data,
        docId: document.id  // Store the document ID
      };
      console.log(`background.js | Mapped tab: ${tab.url} with docId: ${tab.docId}`);
      return tab;
    });

    return tabsWithDocId;
  } catch (error) {
    console.error('background.js | Error fetching tabs via REST:', error);
    throw error;
  }
};

export function canvasFetchContextUrl(): Promise<string> {
  return canvasFetchContext().then(ctx => ctx.url);
}

export function canvasFetchDocuments(featureArray: string[]): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      const baseUrl = await getApiBaseUrl();
      const headers = await getAuthHeaders();
      const contextId = await getContextId();

      const queryParams = new URLSearchParams();
      if (featureArray.length > 0) {
        queryParams.append('features', featureArray.join(','));
      }

      const response = await fetch(`${baseUrl}/contexts/${contextId}/documents?${queryParams}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("background.js | Documents fetched via REST: ", data);
      resolve(data);
    } catch (error) {
      console.error("background.js | Error fetching documents via REST:", error);
      reject(error);
    }
  });
}

export function canvasInsertDocument(document: any, featureArray: string[] = [], options: any = {}): Promise<any> {
  return new Promise(async (resolve, reject) => {
    if (!document) {
      reject(new Error("Document is required"));
      return;
    }

    try {
      const baseUrl = await getApiBaseUrl();
      const headers = await getAuthHeaders();
      const contextId = await getContextId();

      const requestBody = {
        document,
        featureArray,
        options
      };

      const response = await fetch(`${baseUrl}/contexts/${contextId}/documents`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Failed to insert document: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("background.js | Document inserted successfully via REST: ", data);

      // Update tab index and sync status if this is a tab document
      if (document.schema === 'data/abstraction/tab' && document.data && data.document) {
        const insertedTab = {
          ...document.data,
          docId: data.document.id
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

      resolve(data);
    } catch (error) {
      console.error("background.js | Error inserting document via REST:", error);
      reject(error);
    }
  });
}

export function canvasInsertDocumentWithFeatures(document: any, options: any = {}): Promise<any> {
  return canvasInsertDocument(document, genFeatureArray("WRITE"), options);
}

export function canvasUpdateDocument(document: any): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      const baseUrl = await getApiBaseUrl();
      const headers = await getAuthHeaders();
      const contextId = await getContextId();

      if (!document.id) {
        throw new Error("Document ID is required for update");
      }

      const response = await fetch(`${baseUrl}/contexts/${contextId}/documents/${document.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ document })
      });

      if (!response.ok) {
        throw new Error(`Failed to update document: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("background.js | Document updated via REST: ", data);
      resolve(data);
    } catch (error) {
      console.error("background.js | Error updating document via REST:", error);
      reject(error);
    }
  });
}

export function canvasDeleteDocument(documentId: string): Promise<any> {
  return new Promise(async (resolve, reject) => {
    try {
      const baseUrl = await getApiBaseUrl();
      const headers = await getAuthHeaders();
      const contextId = await getContextId();

      const response = await fetch(`${baseUrl}/contexts/${contextId}/documents/${documentId}`, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to delete document: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("background.js | Document deleted via REST: ", data);
      resolve(data);
    } catch (error) {
      console.error("background.js | Error deleting document via REST:", error);
      reject(error);
    }
  });
}

export function canvasFetchTab(docId: number) {
  return new Promise(async (resolve, reject) => {
    try {
      const baseUrl = await getApiBaseUrl();
      const headers = await getAuthHeaders();
      const contextId = await getContextId();

      const response = await fetch(`${baseUrl}/contexts/${contextId}/documents/${docId}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("background.js | Tab fetched via REST: ", data);
      resolve(data);
    } catch (error) {
      console.error("background.js | Error fetching tab via REST:", error);
      reject(error);
    }
  });
}

// REST API function for fetching context list
export async function canvasFetchContextList(): Promise<IContext[]> {
  try {
    const baseUrl = await getApiBaseUrl();
    const headers = await getAuthHeaders();

    const response = await fetch(`${baseUrl}/contexts`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch contexts: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("background.js | Context list fetched via REST: ", data);
    return data.contexts || data;
  } catch (error) {
    console.error("background.js | Error fetching context list via REST:", error);
    throw error;
  }
}

// REST API function for fetching context documents
export async function canvasFetchContextDocuments(contextId: string, featureArray: string[] = [], filterArray: any[] = [], options: any = {}): Promise<any> {
  try {
    const baseUrl = await getApiBaseUrl();
    const headers = await getAuthHeaders();

    const queryParams = new URLSearchParams();
    if (featureArray.length > 0) {
      queryParams.append('features', featureArray.join(','));
    }
    if (filterArray.length > 0) {
      queryParams.append('filters', JSON.stringify(filterArray));
    }
    if (Object.keys(options).length > 0) {
      queryParams.append('options', JSON.stringify(options));
    }

    const response = await fetch(`${baseUrl}/contexts/${contextId}/documents?${queryParams}`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch context documents: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("background.js | Context documents fetched via REST: ", data);
    return data;
  } catch (error) {
    console.error("background.js | Error fetching context documents via REST:", error);
    throw error;
  }
}

// Tab-specific operations using REST API
export function canvasInsertTab(tab: ICanvasTab): Promise<ICanvasInsertOneResponse> {
  const tabDocument = formatTabProperties(tab);
  return canvasInsertDocument(tabDocument, genFeatureArray("WRITE"));
}

export function canvasInsertTabArray(tabArray: ICanvasTab[]): Promise<ICanvasInsertResponse> {
  return new Promise(async (resolve, reject) => {
    if (!tabArray || !tabArray.length) {
      reject(new Error("background.js | Invalid tab array"));
      return;
    }

    try {
      const baseUrl = await getApiBaseUrl();
      const headers = await getAuthHeaders();
      const contextId = await getContextId();
      const featureArray = genFeatureArray("WRITE");

      console.log(`background.js | Inserting ${tabArray.length} tabs via REST API`);

      const requestBody = {
        documents: tabArray.map((tab) => formatTabProperties(tab)),
        featureArray,
        options: {}
      };

      const response = await fetch(`${baseUrl}/contexts/${contextId}/documents/batch`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Failed to insert documents: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("background.js | Tab array inserted successfully via REST: ", data);

      // Update tab index with inserted tabs
      if (data.documents && Array.isArray(data.documents)) {
        const insertedTabs = data.documents.map((doc: any, index: number) => ({
          ...tabArray[index],
          docId: doc.id
        }));

        // Add to canvas tabs index (without triggering UI updates)
        index.insertCanvasTabArraySilent(insertedTabs, false);

        // Notify UI about the tab changes
        onContextTabsUpdated({
          canvasTabs: { insertedTabs }
        });

        // Send success message
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.success_message, payload: `${insertedTabs.length} tabs inserted to Canvas` });

        // Update browser tabs to recalculate synced status (debounced)
        index.updateBrowserTabsWithDelay();
      }

      resolve(data);
    } catch (error) {
      console.error("background.js | Error inserting tab array via REST:", error);
      reject(error);
    }
  });
}

export function canvasUpdateTab(tab: ITabDocumentSchema): Promise<any> {
  const tabData = tab.data;
  if (!tabData.docId) {
    throw new Error("Document ID is required for tab update");
  }

  return canvasUpdateDocument({
    id: tabData.docId,
    schema: tab.schema,
    data: stripTabProperties(tabData)
  });
}

function deleteOrRemoveTab(operation: "remove" | "delete", tab: ICanvasTab, log: "remove" | "delete") {
  return new Promise(async (resolve, reject) => {
    console.log(`background.js | Attempting to ${log} tab: `, tab);

    const handleSuccessResponse = (res: any) => {
      console.log(`background.js | Tab ${log} successful:`, res);

      // Remove from canvas tabs index
      index.removeCanvasTab(tab.url as string);

      // Notify UI about the change
      onContextTabsUpdated({
        canvasTabs: { removedTabs: [tab] }
      });

      // Send success message
      sendRuntimeMessage({
        type: RUNTIME_MESSAGES.success_message,
        payload: `Tab ${log}d from Canvas`
      });

      // Update browser tabs to recalculate synced status (debounced)
      index.updateBrowserTabsWithDelay();

      resolve(true);
    };

    const handleErrorResponse = (error: any) => {
      console.error(`background.js | Tab ${log} failed:`, error);
      sendRuntimeMessage({
        type: RUNTIME_MESSAGES.error_message,
        payload: `Failed to ${log} tab from Canvas: ${error.message || error}`
      });
      resolve(false);
    };

    try {
      // Ensure we have a docId
      if (!tab.docId) {
        tab.docId = index.getCanvasDocumentIdByTabUrl(tab.url as string);
        console.log(`background.js | Retrieved docId from index: ${tab.docId} for URL: ${tab.url}`);
      }

      if (!tab.docId) {
        console.error(`background.js | Cannot ${log} tab - no docId found for URL: ${tab.url}`);
        console.error('background.js | Current canvas tabs index state:');
        index.logCanvasTabsWithDocIds();
        sendRuntimeMessage({
          type: RUNTIME_MESSAGES.error_message,
          payload: `Cannot ${log} tab - document ID not found. Try refreshing canvas tabs first.`
        });
        resolve(false);
        return;
      }

      const baseUrl = await getApiBaseUrl();
      const headers = await getAuthHeaders();
      const contextId = await getContextId();

      const endpoint = operation === "delete"
        ? `${baseUrl}/contexts/${contextId}/documents/${tab.docId}`
        : `${baseUrl}/contexts/${contextId}/documents/${tab.docId}/remove`;

      const response = await fetch(endpoint, {
        method: operation === "delete" ? 'DELETE' : 'POST',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to ${operation} document: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      handleSuccessResponse(data);
    } catch (error) {
      handleErrorResponse(error);
    }
  });
}

function deleteOrRemoveTabs(operation: "remove" | "delete", tabs: ICanvasTab[], log: "remove" | "delete") {
  console.log(`background.js | Starting batch ${log} operation for ${tabs.length} tabs`);

  // Process each tab individually and collect promises
  const promises = tabs.map(tab => deleteOrRemoveTab(operation, tab, log));

  return Promise.all(promises).then(results => {
    const successCount = results.filter(Boolean).length;
    const errorCount = results.length - successCount;

    console.log(`background.js | Batch ${log} completed: ${successCount} successful, ${errorCount} errors`);

    if (successCount > 0) {
      sendRuntimeMessage({
        type: RUNTIME_MESSAGES.success_message,
        payload: `${successCount} tab(s) ${log}d from Canvas${errorCount > 0 ? ` (${errorCount} failed)` : ''}`
      });
    }

    if (errorCount > 0) {
      sendRuntimeMessage({
        type: RUNTIME_MESSAGES.error_message,
        payload: `${errorCount} tab(s) failed to ${log}`
      });
    }

    return results;
  });
}

export function canvasRemoveTab(tab: ICanvasTab) {
  return deleteOrRemoveTab("remove", tab, "remove");
}

export function canvasDeleteTab(tab: ICanvasTab) {
  return deleteOrRemoveTab("delete", tab, "delete");
}

export function canvasRemoveTabs(tabs: ICanvasTab[]) {
  return deleteOrRemoveTabs("remove", tabs, "remove");
}

export function canvasDeleteTabs(tabs: ICanvasTab[]) {
  return deleteOrRemoveTabs("delete", tabs, "delete");
}

export function documentInsertTabArray(tabArray: ICanvasTab[], contextUrlArray: string[]): Promise<ICanvasInsertResponse> {
  return new Promise(async (resolve, reject) => {
    if (!tabArray || !tabArray.length) {
      reject(new Error("background.js | Invalid tab array"));
      return;
    }

    try {
      const baseUrl = await getApiBaseUrl();
      const headers = await getAuthHeaders();
      const contextId = await getContextId();
      const featureArray = genFeatureArray("WRITE");

      console.log(`SAVING FOR CONTEXT ${contextUrlArray.toString()}`, tabArray);

      const requestBody = {
        documents: tabArray.map((tab) => formatTabProperties(tab)),
        contextUrlArray,
        featureArray
      };

      const response = await fetch(`${baseUrl}/contexts/${contextId}/documents/batch`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Failed to insert documents: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("background.js | Document tab array inserted successfully via REST: ", data);
      resolve(data);
    } catch (error) {
      console.error("background.js | Error inserting document tab array via REST:", error);
      reject(error);
    }
  });
}

export function formatTabProperties(tab: ICanvasTab): IFormattedTabProperties {
  return {
    schema: 'data/abstraction/tab',
    data: {
      ...tab,
      browser: getCurrentBrowser()
    }
  };
}

async function getUserInfo(): Promise<null | IUserInfo> {
  // This should be implemented via REST API if needed
  return null;
}
