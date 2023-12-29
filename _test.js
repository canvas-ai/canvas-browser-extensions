/**
 * Canvas backend functions
 */

function saveTabToBackend(tab, cb) {
    let doc = formatTabProperties(tab);
    socket.emit('index:insertDocument', doc, (res) => {
        console.log('Tab inserted: ', res);
        if (cb) cb(res)
    });
}

function loadTabFromBackend(tabID, cb) {
    socket.emit('document:get', tabID, (res) => {
        console.log(`Tab ${tabID} fetched: `, res);
        if (cb) cb(res)
    });
}




function compareAndPopulateMaps() {
    fetchOpenTabs().then(openTabs => {
        fetchTabsFromCanvas().then(canvasTabs => {

            // Check for tabs that are open but not in Canvas
            openTabs.forEach((tab, url) => {
                if (!canvasTabs.has(url)) {
                    browserToCanvasTabsDelta.set(url, tab);
                }
            });

            // Check for tabs that are in Canvas but not open
            canvasTabs.forEach((canvasTab, url) => {
                if (!openTabs.has(url)) {
                    canvasToBrowserTabsDelta.set(url, canvasTab);
                }
            });

            console.log('background.js | Tabs not synced to Canvas: ', canvasToBrowserTabsDelta.size);
            console.log('background.js | Tabs not opened in browser: ', browserToCanvasBlacklist.size);

        }).catch(error => console.error("background.js | Error fetching tabs from Canvas:", error));
    }).catch(error => console.error("background.js | Error fetching open tabs:", error));
}

function fetchOpenTabs() {
    let browserTabsMap = new Map();
    return new Promise((resolve, reject) => {
        browser.tabs.query({}).then(tabs => {
            tabs.forEach(tab => {
                browserTabsMap.set(tab.url, tab);
            });
            resolve(browserTabsMap);
        }).catch(reject);
    });
}

function fetchTabsFromCanvas() {
    let canvasTabsMap = new Map();
    return new Promise((resolve, reject) => {
        socket.emit('documents:get', { type: 'data/abstraction/tab'}, (res) => {
            console.log('background.js | Tabs fetched: ', res);
            if (!res || res.status === 'error') resolve(canvasTabsMap) // TODO: Handle error

            res.data.forEach(tabData => {
                canvasTabsMap.set(tabData.url, tabData); // Assuming tabData.url is the SHA1 checksum of the URL
            });
            resolve(canvasTabsMap);
        });

        resolve(canvasTabsMap);
    });
}




async function sendTabToCanvas(tab, tagArray) {
    return new Promise((resolve, reject) => {
        socket.emit('sendTabToCanvas', { tab, tagArray }, (response) => {
            if (response.error) {
                reject(response.error);
            } else {
                resolve(response);
            }
        });
    });
}

async function sendTabsToCanvas(tabArray, tagArray) {
    return new Promise((resolve, reject) => {
        socket.emit('sendTabToCanvas', { tabArray, tagArray }, (response) => {
            if (response.error) {
                reject(response.error);
            } else {
                resolve(response);
            }
        });
    });
}



// Fetch context URL, Tab schema, and stored URLs from the server
function fetchContextUrl() {
    socket.emit('context:get:url', {}, (url) => {
        context.url = url;
        console.log('background.js | Context URL fetched: ', url);
    });
}

function fetchTabSchema() {
    socket.emit('db:schema:get', { type: 'data/abstraction/tab', version: '2' }, function (res) {
        if (!res || res.status === 'error') {
            console.error('background.js | Tab schema not found');
        }
        Tab = res;
        console.log('background.js | Tab schema fetched: ', Tab);
    });
}


function fetchStoredUrls() {
    socket.emit('listDocuments', {
        context: context.url,
        type: 'data/abstraction/tab',
    }, (data) => {
        tabUrls = data;
        console.log('background.js | Stored URLs fetched: ', tabUrls);
    });
}

// Function to compare and populate maps




/**
 * Browser tab functions
 */

function updateBrowserTabs(tabArray, hideInsteadOfRemove = false) {
    browser.tabs.query({}).then((tabs) => {
        let tabsToRemove = tabs.filter(tab => !tabArray.find(newTab => newTab.id === tab.id));
        tabsToRemove.forEach(tab => {
            console.log(`background.js | Removing tab ${tab.id}`);
            browser.tabs.remove(tab.id)
        });

        tabArray.forEach(newTab => {
            if (!tabs.find(tab => tab.id === newTab.id)) {
                console.log(`background.js | Creating tab ${tab.id}`);
                browser.tabs.create(newTab);
            }
        });
    });
}
