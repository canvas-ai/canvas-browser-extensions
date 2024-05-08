import { SOCKET_MESSAGES } from "@/general/constants";
import { getSocket } from "./socket";
import index from "./TabIndex";
import { getCurrentBrowser, genFeatureArray, onContextTabsUpdated } from "./utils";

export function canvasFetchData(resource) {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    if (!resource) {
      console.error("background.js | No resource provided");
      reject("No resource provided");
    }

    socket.emit(resource, (response) => {
      console.log("background.js | Canvas fetchData response:", response);
      resolve(response);
    });
  });
}

export function canvasInsertData(resource, data) {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    if (!resource) {
      console.error("background.js | No resource provided");
      reject("No resource provided");
    }

    if (!data) {
      console.error("background.js | No data provided");
      reject("No data provided");
    }

    socket.emit(resource, data, (response) => {
      console.log("background.js | Canvas insertData response:", response);
      resolve(response);
    });
  });
}


export function canvasFetchContext() {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(SOCKET_MESSAGES.CONTEXT.GET_URL, (res) => {
      if (!res || res.status !== "success") {
        reject("background.js | Error fetching context url from Canvas");
      } else {
        console.log("background.js | Context fetched: ", res);
        resolve(res);
      }
    });
  });
}

export function canvasFetchTabsForContext() {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(
      SOCKET_MESSAGES.DOCUMENT.GET_ARRAY,
      genFeatureArray(),
      (res) => {
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

export function canvasFetchTabSchema() {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(SOCKET_MESSAGES.SCHEMAS.GET, { type: genFeatureArray() }, (res) => {
      console.log("background.js | Tab schema fetched: ", res);
      resolve(res);
    });
  });
}

export function canvasFetchTab(docId: number) {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(
      SOCKET_MESSAGES.DOCUMENT.GET,
      { type: genFeatureArray(), docId },
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
    socket.emit(SOCKET_MESSAGES.DOCUMENT.INSERT, formatTabProperties(tab), resolve);
  });
}

export function canvasInsertTabArray(tabArray: ICanvasTab[]): Promise<ICanvasInsertResponse> {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    if (!tabArray || !tabArray.length) {
      reject("background.js | Invalid tab array");
    }
    socket.emit(SOCKET_MESSAGES.DOCUMENT.INSERT_ARRAY, tabArray.map((tab) => formatTabProperties(tab)), (res) => {
      resolve(res);
    });
  });
}

export function canvasUpdateTab(tab: ITabDocumentSchema): Promise<any> {
  return new Promise((resolve, reject) => {
    // TODO: Implement the logic for updating a tab
  });
}

export function canvasRemoveTab(tab: ICanvasTab) {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    if(!tab.docId) tab.docId = index.getCanvasDocumentIdByTabUrl(tab.url as string);
    socket.emit(SOCKET_MESSAGES.DOCUMENT.REMOVE, tab.docId, (res) => {
      console.log("background.js | Tab removed: ", res);
      if (res.status === "success") {
        console.log(`background.js | Tab ${tab.id} removed from Canvas: `, res);
        index.removeCanvasTab(tab.url as string);
        onContextTabsUpdated({ canvasTabs: { removedTabs: [tab] } });
        resolve(res);
      } else {
        console.error(`background.js | Remove failed for tab ${tab.id}:`)
        console.error(res);
        resolve(false);
      }
    });
  });
}

export function canvasRemoveTabs(tabs: ICanvasTab[]) { // TODO add SOCKET_MESSAGES.DOCUMENT.REMOVE_ARRAY
  return Promise.all(tabs.map(canvasRemoveTab));
}

export function canvasDeleteTabs(tabs: ICanvasTab[]) { // TODO add SOCKET_MESSAGES.DOCUMENT.DELETE_ARRAY
  return Promise.all(tabs.map(canvasDeleteTab));
}

export function canvasDeleteTab(tab: ICanvasTab) {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    if(!tab.docId) tab.docId = index.getCanvasDocumentIdByTabUrl(tab.url as string);
    socket.emit(SOCKET_MESSAGES.DOCUMENT.DELETE, tab.docId, (res: ISocketResponse<any>) => {
      if (res.status === "success") {
        console.log("background.js | Tab deleted: ", res);
        index.removeCanvasTab(tab.url as string);
        onContextTabsUpdated({ canvasTabs: { removedTabs: [tab] } });
        resolve(res);
      } else {
        console.error(`background.js | Delete failed for tab ${tab.id}:`)
        console.error(res);
        resolve(false);
      }
    });
  });
}

export function canvasCheckConnection() {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    let intervalId = setInterval(() => {
      if (!socket.isConnected()) {
        console.log("background.js | Canvas backend not yet connected");
      } else {
        clearInterval(intervalId);
        resolve(true);
      }
    }, 1000);
  });
}

export async function formatTabProperties(tab: ICanvasTab): Promise<IFormattedTabProperties> {
  if(!tab.docId) tab.docId = index.getCanvasDocumentIdByTabUrl(tab.url as string);
  const result = {
    type: genFeatureArray(),
    meta: {
      url: tab.url,
      browser: getCurrentBrowser()
    },
    data: { ...tab, id: tab.docId || tab.id },
  };
  return result;
}
