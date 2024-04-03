/**
 * General functions for interacting with the Canvas backend
 */

import { AxiosResponse } from "axios";
import { getSocket } from "./socket";

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


/**
 * Functions for interacting with the Canvas backend
 */

export function canvasFetchContext() {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit("context:get", (res) => {
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
      "context:document:getArray",
      "data/abstraction/tab",
      (res) => {
        if (res.status === "error") {
          console.error("background.js | Error fetching tabs from Canvas: ", res);
          reject("background.js | Error fetching tabs: " + res.message);
        } else {
          const parsed = res.payload
            .filter((tab) => tab !== null)
            .map((tab) => tab.data);
          res.data = parsed;
          console.log("background.js | Tabs fetched from Canvas: ", res.data.length);
          resolve(res);
        }
      }
    );
  });
}

export function canvasFetchContextUrl() {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit("context:get:url", (res) => {
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
    socket.emit("schemas:get", { type: "data/abstraction/tab" }, (res) => {
      console.log("background.js | Tab schema fetched: ", res);
      resolve(res);
    });
  });
}

export function canvasFetchTab(id) {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit(
      "context:document:get",
      { type: "data/abstraction/tab", id: id },
      (res) => {
        console.log("background.js | Tab fetched: ", res);
        resolve(res);
      }
    );
  });
}

export function canvasHasTab(id) {
  return new Promise((resolve, reject) => {
    // TODO: Implement the logic for checking if the tab exists
  });
}

export function canvasInsertTab(tab) {
  return new Promise((resolve, reject) => {
    // TODO: Implement the logic for inserting a tab
  });
}

export function canvasUpdateTab(tab: ITabDocumentSchema): Promise<AxiosResponse> {
  return new Promise((resolve, reject) => {
    // TODO: Implement the logic for updating a tab
  });
}

export function canvasRemoveTab(tab) {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    socket.emit("context:remove:document", tab, (res) => {
      console.log("background.js | Tab removed: ", res);
      resolve(res);
    });
  });
}

export function canvasInsertTabArray(tabArray) {
  return new Promise(async (resolve, reject) => {
    const socket = await getSocket();
    if (!tabArray || !tabArray.length) {
      reject("background.js | Invalid tab array");
    }
    tabArray = tabArray.map((tab) => formatTabProperties(tab));
    socket.emit("context:document:insertArray", tabArray, (res) => {
      resolve(res);
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

export function formatTabProperties(tab) {
  return {
    type: "data/abstraction/tab",
    data: tab,
  };
}
