console.log('background.js | Initializing Canvas Browser Extension background worker');

// Extension config @config.js
// Extension canvas utils @utils-canvas.js
// Extension browser utils @utils-browser.js

// Runtime defaults
let context = {
    url: 'universe:///',
    color: '#fff',
};

let TabSchema = {};

let watchTabProperties = {
    properties: [
        "url",
        "hidden",
        "pinned",
        "mutedInfo"
    ]
};


/**
 * Tab Index Class (TODO: Move to utils)
 */

class Index {
    constructor() {
        this.browserTabs = new Map();
        this.canvasTabs = new Map();
    }

    insertBrowserTab(tab) {
        this.browserTabs.set(tab.url, tab);
    }

    removeBrowserTab(url) {
        this.browserTabs.delete(url);
    }

    insertBrowserTabArray(tabArray) {
        tabArray.forEach(tab => this.browserTabs.set(tab.url, tab));
    }

    hasBrowserTab(url) {
        return this.browserTabs.has(url);
    }

    insertCanvasTab(tab) {
        this.canvasTabs.set(tab.url, tab);
    }

    removeCanvasTab(url) {
        this.canvasTabs.delete(url);
    }

    insertCanvasTabArray(tabArray) {
        tabArray.forEach(tab => this.canvasTabs.set(tab.url, tab));
    }

    hasCanvasTab(url) {
        return this.canvasTabs.has(url);
    }

    deltaBrowserToCanvas() {
        return [...this.browserTabs.values()].filter(tab => !this.canvasTabs.has(tab.url));
    }

    deltaCanvasToBrowser() {
        return [...this.canvasTabs.values()].filter(tab => !this.browserTabs.has(tab.url));
    }
}

const index = new Index();


/**
 * Initialize Socket.io
 */

const socket = io.connect(`${config.transport.protocol}://${config.transport.host}:${config.transport.port}`);
socket.on('connect', () => {
    console.log('background.js | [socket.io] Browser Client connected to Canvas');

    canvasFetchContextUrl((res) => {
        if (!res || res.status !== 'success') return console.error('background.js | Error fetching context url from Canvas')
        console.log('background.js | [socket.io] Received context url: ', res.data)
        context.url = res.data;
    });

    canvasFetchTabSchema((res) => {
        if (!res || res.status !== 'success') return console.error('background.js | Error fetching tab schema from Canvas')
        console.log('background.js | [socket.io] Received tab schema: ', res.data)
        TabSchema = res.data;
    });

    canvasFetchContextTabs((res) => {
        if (!res || res.status !== 'success') return console.error('background.js | Error fetching tabs from Canvas');
        index.insertCanvasTabArray(res.data);
    });

    browser.tabs.query({}).then((tabs) => {
        index.insertBrowserTabArray(tabs);
    });

});

socket.on('connect_error', function (error) {
    console.log(`background.js | [socket.io] Browser Connection to "${config.transport.protocol}://${config.transport.host}:${config.transport.port}" failed`);
    console.error(error.message);
});

socket.on('connect_timeout', function () {
    console.log('background.js | [socket.io] Canvas Connection Timeout');
});

socket.on('disconnect', () => {
    console.log('background.js | [socket.io] Browser Client disconnected from Canvas');
});


/**
 * Socket.io event listeners
 */

socket.on('context:url', async (url) => {
    console.log('background.js | [socket.io] Received context URL update: ', url);
    context.url = url;

    canvasFetchContextTabs((res) => {
        if (!res || res.status !== 'success') return console.error('background.js | Error fetching tabs from Canvas');
        index.insertCanvasTabArray(res.data);
    });

    browser.tabs.query({}).then((tabs) => {
        index.insertBrowserTabArray(tabs);
    });

    // Automatically close existing tabs if enabled
    //if (config.sync.autoCloseTabs) { browserCloseCurrentTabs(); }

    // Automatically open new canvas tabs
    //if (config.sync.autoOpenTabs) { browserOpenTabs(canvasTabs); }

    // Try to update the UI (might not be loaded)
    browser.runtime.sendMessage({ type: 'context:url', data: url }, function(response) {
        if (browser.runtime.lastError) {
            console.log(`background.js | Unable to connect to UI, error: ${browser.runtime.lastError}`);
        } else {
            console.log('background.js | Message to UI sent successfully');
        }
    });

});

socket.on('context:documentInserted', (res) => {
    console.log('background.js | [socket.io] Received documentInserted event: ', res);
});


/**
 * Browser event listeners
 */

browser.tabs.onCreated.addListener((tab) => {
    // noop, we need to wait for the onUpdated event to get the url
    console.log(`background.js | Tab created: ${tab.id}`);
})

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only trigger if url is set and is different from what we already have cached
    // Assuming we already have the current session stored
    if (changeInfo.url && !index.hasBrowserTab(tab.url)) { //browserTabs[tabId] !== tab.url) {

        // Ignore empty tabs
        if (tab.url == "about:newtab" || tab.url == "about:blank") return
        index.insertBrowserTab(tab) //browserTabs[tabId] = tab.url;

        let tabDocument = formatTabProperties(tab);

        // Update backend
        console.log(`background.js | Tab ID ${tabId} changed, sending update to backend`)
        canvasInsertTab(tabDocument, (res) => {
            if (res.status === "success") {
                console.log(`background.js | Tab ${tabId} inserted: `, res);
            } else {
                console.error(`background.js | Insert failed for tab ${tabId}:`)
                console.error(res);
            }
        })

    }
}, watchTabProperties)

browser.tabs.onMoved.addListener((tabId, moveInfo) => {
    let url = browserTabs[tabId];

    // We need to rebuild the object because moveInfo doesn't contain the url
    let tab = {
        id: tabId,
        url: url,
        index: moveInfo.toIndex
    };


    console.log(`background.js | Tab ID ${tabId} moved from ${moveInfo.fromIndex} to ${moveInfo.toIndex}, sending update to backend`);

    let tabDocument = TabSchema
    tabDocument.data = stripTabProperties(tab)

    // Send update to backend
    canvasUpdateTab(tabDocument, (res) => {
        if (res.status === "success") {
            console.log(`background.js | Tab ${tabId} updated: `, res);
        } else {
            console.error(`background.js | Update failed for tab ${tabId}:`)
            console.error(res);
        }
    });

});

browser.browserAction.onClicked.addListener((tab, OnClickData) => {
    // Ignore empty tabs
    if (!tab.url || tab.url == "about:newtab" || tab.url == "about:blank") return

    // Update backend
    console.log(`Sending update to backend for tab ${tab.id}`);
    browserTabs[tab.id] = tab.url;

    let tabDocument = TabSchema
    tabDocument.data = stripTabProperties(tab)

    // Send update to backend
    canvasUpdateTab(tabDocument, (res) => {
        if (res.status === "success") {
            console.log(`background.js | Tab ${tabId} updated: `, res);
        } else {
            console.error(`background.js | Update failed for tab ${tabId}:`)
            console.error(res);
        }
    });

});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
    let url = browserTabs[tabId];
    let tab = {
        id: tabId,
        url: url
    };

    // Ignore empty tabs
    if (!tab.url || tab.url == "about:newtab" || tab.url == "about:blank") return

    let tabDocument = TabSchema
    tabDocument.data = stripTabProperties(tab)

    // Update backend
    console.log(`background.js | Tab ID ${tabId} removed, updating backend`);
    canvasRemoveTab(tabDocument, (res) => {
        if (res.status === "success") {
            console.log(`background.js | Tab ${tabId} removed from Canvas: `, res);
        } else {
            console.error(`background.js | Remove failed for tab ${tabId}:`)
            console.error(res);
        }
    })

    // Update browser
    delete browserTabs[tabId]

});


/**
 * UI Message Handlers
 */

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('background.js | UI Message received: ', message);

    switch (message.action) {

        // socket.io
        case 'socket:status':
            sendResponse(socket.connected);
            break;

        // Canvas Config
        case 'config:get':
            sendResponse(config);
            break;

        case 'config:get:item':
            if (!message.key) return console.error('background.js | No config key specified');
            sendResponse(config[message.key]);
            break;

        case 'config:set:item':
            if (!message.key || !message.value) return console.error('background.js | No config key or value specified');
            config[message.key] = message.value;
            sendResponse(config[message.key]);
            break;

        // Context
        case 'context:get': // TODO: Remove
            console.log('background.js | Sending ', context)
            sendResponse(context);
            break;

        case 'context:get:url':
            sendResponse(context.url);
            break;

        case 'context:get:path':
            sendResponse(context.path);
            break;

        case 'context:get:pathArray':
            sendResponse(context.pathArray);
            break;

        case 'context:get:color':
            sendResponse(context.color);
            break;

        case 'context:get:tree':
            sendResponse(context.tree);
            break;

        // Tab
        case 'tab:insert':
            break;

        case 'tab:remove':
            break;

        case 'tab:get:schema':
            sendResponse(TabSchema);
            break;

        // Tabs
        case 'context:syncTabs':
            canvasSaveOpenTabs((res) => {
                if (!res || res.status === 'error') return console.error('background.js | Error saving tabs to Canvas')
                console.log('background.js | Tabs saved to Canvas: ', res.data)
                sendResponse(res);
            });
            break;

        case 'context:get:tabs':
            sendResponse(canvasTabs);
            break;

        case 'tabs:get:browserToCanvasDelta':
            sendResponse(index.deltaBrowserToCanvas());
            break;

        case 'tabs:get:canvasToBrowserDelta':
            sendResponse(index.deltaCanvasToBrowser());
            break;

        default:
            console.error(`background.js | Unknown message action: ${message.action}`);
            break;

    }

});
