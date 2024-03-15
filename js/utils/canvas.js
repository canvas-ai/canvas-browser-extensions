/**
 * General functions for interacting with the Canvas backend
 */

function canvasFetchData(resource) {
  return new Promise((resolve, reject) => {
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

function canvasInsertData(resource, data) {
  return new Promise((resolve, reject) => {
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

function canvasFetchContext() {
  return new Promise((resolve, reject) => {
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

function canvasFetchTabsForContext() {
  return new Promise((resolve, reject) => {
    socket.emit(
      "context:document:getArray",
      { type: "data/abstraction/tab" },
      (res) => {
        if (res.status === "error") {
          console.error(
            "background.js | Error fetching tabs from Canvas: ",
            res
          );
          reject("background.js | Error fetching tabs: " + res.message);
        } else {
          const parsed = res.data
            .filter((tab) => tab !== null)
            .map((tab) => tab.data);
          res.data = parsed;
          console.log(
            "background.js | Tabs fetched from Canvas: ",
            res.data.length
          );
          resolve(res);
        }
      }
    );
  });
}

function canvasFetchContextUrl() {
  return new Promise((resolve, reject) => {
    socket.emit("context:get:url", (res) => {
      if (!res || res.status !== "success") {
        console.error("background.js | Error fetching context URL", res);
        reject("Error fetching context url from Canvas");
      } else {
        console.log("background.js | Context URL fetched: ", res);
        resolve(res);
      }
    });
  });
}

function canvasFetchTabSchema() {
  return new Promise((resolve, reject) => {
    socket.emit("schemas:get", { type: "data/abstraction/tab" }, (res) => {
      console.log("background.js | Tab schema fetched: ", res);
      resolve(res);
    });
  });
}

function canvasFetchTab(id) {
  return new Promise((resolve, reject) => {
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

function canvasHasTab(id) {
  return new Promise((resolve, reject) => {
    // TODO: Implement the logic for checking if the tab exists
  });
}

function canvasInsertTab(tab) {
  return new Promise((resolve, reject) => {
    // TODO: Implement the logic for inserting a tab
  });
}

function canvasUpdateTab(tab) {
  return new Promise((resolve, reject) => {
    // TODO: Implement the logic for updating a tab
  });
}

function canvasRemoveTab(tab) {
  return new Promise((resolve, reject) => {
    socket.emit("context:remove:document", tab, (res) => {
      console.log("background.js | Tab removed: ", res);
      resolve(res);
    });
  });
}

function canvasInsertTabArray(tabArray) {
  return new Promise((resolve, reject) => {
    if (!tabArray || !tabArray.length) {
      reject("background.js | Invalid tab array");
    }
    tabArray = tabArray.map((tab) => formatTabProperties(tab));
    socket.emit("context:document:insertArray", tabArray, (res) => {
      resolve(res);
    });
  });
}

function canvasCheckConnection() {
  return new Promise((resolve, reject) => {
    let intervalId = setInterval(() => {
      if (!isConnected) {
        console.log("background.js | Canvas backend not yet connected");
      } else {
        clearInterval(intervalId);
        resolve();
      }
    }, 1000);
  });
}

function formatTabProperties(tab) {
  return {
    type: "data/abstraction/tab",
    data: tab,
  };
}
