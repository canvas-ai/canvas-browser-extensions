import { SOCKET_MESSAGES } from "@/general/constants";
import { getSocket } from "./socket";
import index from "./TabIndex";
import { genFeatureArray, getCurrentBrowser, onContextTabsUpdated } from "./utils";


export function canvasFetchTabsForContext() {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    console.log("SOCKET_MESSAGES.DOCUMENT_CONTEXT.GET_ARRAY REQUEST");
    socket.emit(
      SOCKET_MESSAGES.DOCUMENT_CONTEXT.GET_ARRAY,
      genFeatureArray("READ"),
      (res) => {
        console.log("SOCKET_MESSAGES.DOCUMENT_CONTEXT.GET_ARRAY RESPONSE");
        if (res.status === "error") {
          console.error("background.js | Error fetching tabs from Canvas: ", res);
          reject("background.js | Error fetching tabs: " + res.message);
        } else {
          const parsed = res.payload
            .filter((tab) => tab !== null)
            .map((tab) => ({...tab.data, docId: tab.docId || tab.id }));
          res.data = parsed;
          console.log("background.js | Tabs fetched from Canvas: ", res.data.length);
          resolve(res);
        }
      }
    );
  });
}

export function canvasFetchContextUrl(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(SOCKET_MESSAGES.CONTEXT.GET_URL, {}, (res) => {
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
    if (!tab) {
      reject("background.js | Invalid tab");
    }
    socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT, formatTabProperties(tab), genFeatureArray("WRITE"), resolve);
  });
}

export function canvasInsertTabArray(tabArray: ICanvasTab[]): Promise<ICanvasInsertResponse> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    if (!tabArray || !tabArray.length) {
      reject("background.js | Invalid tab array");
    }
    socket.emit(SOCKET_MESSAGES.DOCUMENT_CONTEXT.INSERT_ARRAY, tabArray.map((tab) => formatTabProperties(tab)), genFeatureArray("WRITE"), resolve);
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
    socket.emit(SOCKET_MESSAGES.DOCUMENT.INSERT_ARRAY, tabArray.map((tab) => formatTabProperties(tab)), contextUrlArray, genFeatureArray("WRITE"), resolve);
  });
}

export function formatTabProperties(tab: ICanvasTab): IFormattedTabProperties {
  if(!tab.docId) tab.docId = index.getCanvasDocumentIdByTabUrl(tab.url as string);
  return {
    type: 'data/abstraction/tab',
    meta: {
      url: tab.url,
      browser: getCurrentBrowser()
    },
    data: { ...tab, id: tab.docId || tab.id },
  };
}
