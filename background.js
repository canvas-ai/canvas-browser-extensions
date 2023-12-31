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
        this.browserTabIdToUrl = new Map();
        this.browserTabs = new Map();
        this.canvasTabs = new Map();
    }

    // Common methods
    counts() {
        return {            
            browserTabs: this.browserTabs.size,
            canvasTabs: this.canvasTabs.size,
            browserTabIdToUrl: this.browserTabIdToUrl.size
        }
    }

    getBrowserTabArray() {
        return [...this.browserTabs.values()];
    }

    getBrowserTabByID(id) {
        let url = this.browserTabIdToUrl.get(id);
        return this.browserTabs.get(url);
    }

    insertBrowserTab(tab) {
        this.browserTabIdToUrl.set(tab.id, tab.url);
        this.browserTabs.set(tab.url, tab);
    }

    removeBrowserTab(url) {
        let tab = this.browserTabs.get(url);
        this.browserTabIdToUrl.delete(tab.id);
        this.browserTabs.delete(url);
    }

    insertBrowserTabArray(tabArray, clear = true) {
        if (clear) this.browserTabs.clear();
        tabArray.forEach(tab => this.insertBrowserTab(tab));
    }

    hasBrowserTab(url) {
        return this.browserTabs.has(url);
    }

    clearBrowserTabs() {
        this.browserTabIdToUrl.clear();
        this.browserTabs.clear();
    }

    updateBrowserTabs() {
        browser.tabs.query({}).then((tabs) => {            
            const processedTabs = tabs.map(tab => {
                // Assign a default favicon if favIconUrl is not present
                if (!tab.favIconUrl) tab.favIconUrl = browser.runtime.getURL('icons/logo_64x64.png');
                return tab;
            });
    
            this.insertBrowserTabArray(processedTabs);
        });
    }
    

    insertCanvasTab(tab) {
        this.canvasTabs.set(tab.url, tab);
    }

    removeCanvasTab(url) {
        this.canvasTabs.delete(url);
    }

    insertCanvasTabArray(tabArray, clear = true) {
        if (clear) this.canvasTabs.clear();
        tabArray.forEach(tab => this.insertCanvasTab(tab));
    }

    hasCanvasTab(url) {
        return this.canvasTabs.has(url);
    }

    clearCanvasTabs() {
        this.canvasTabs.clear();
    }

    deltaBrowserToCanvas() {
        console.log('background.js | Computing delta browser to canvas')
        return [...this.browserTabs.values()].filter(tab => !this.canvasTabs.has(tab.url));
    }

    deltaCanvasToBrowser() {
        console.log('background.js | Computing delta canvas to browser')
        return [...this.canvasTabs.values()].filter(tab => !this.browserTabs.has(tab.url));
    }

    clearIndex() {
        console.log('background.js | Clearing tab index')
        this.clearBrowserTabs();
        this.clearCanvasTabs();
    }

    #parseTab(tab) {
        let parsed = tab;
        return parsed;
    }

    #stripTabProperties(tab) {}

}

// Custom index module for easier delta comparison
const index = new Index();
console.log('background.js | Index initialized: ', index.counts());

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
        index.insertCanvasTabArray(res.data, false);
        index.updateBrowserTabs();
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

socket.on('context:url', (url) => {
    console.log('background.js | [socket.io] Received context URL update: ', url);
    context.url = url;

    canvasFetchContextTabs((res) => {
        if (!res || res.status !== 'success') return console.error('background.js | Error fetching tabs from Canvas');
        index.updateBrowserTabs();
        index.insertCanvasTabArray(res.data, false);        
    });

    // Automatically close existing tabs if enabled
    //if (config.sync.autoCloseTabs) { browserCloseCurrentTabs(); }

    // Automatically open new canvas tabs if enabled
    //if (config.sync.autoOpenTabs) { browserOpenTabs(canvasTabs); }

    // Try to update the UI (might not be loaded(usually the case))
    browser.runtime.sendMessage({ type: 'context:url', data: url }, (response) => {
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
    if (changeInfo.url && !index.hasBrowserTab(tab.url)) {

        // Ignore non-valid tabs(about:*, empty tabs etc)
        if (!browserIsValidTabUrl(tab.url)) return
        
        // Update the current index
        index.updateBrowserTabs();

        // Update backend
        console.log(`background.js | Tab ID ${tabId} changed, sending update to backend`)
        let tabDocument = formatTabProperties(tab);        
        canvasInsertTab(tabDocument, (res) => {
            if (res.status === "success") {
                console.log(`background.js | Tab ${tabId} inserted: `, res);
                index.insertCanvasTab(tab)
            } else {
                console.error(`background.js | Insert failed for tab ${tabId}:`)
                console.error(res);
            }
        })

    }
}, watchTabProperties)

browser.tabs.onMoved.addListener((tabId, moveInfo) => {
    console.log('background.js | Tab moved: ', tabId, moveInfo);

    // Update the current index
    index.updateBrowserTabs();

    // noop
    //console.log('background.js | TODO: Disabled as we currently do not track move changes');
    //return;
    
    browser.tabs.get(tabId).then(tab => {        
        let tabDocument = TabSchema
        tabDocument.data = stripTabProperties(tab)
    
        // Send update to backend
        canvasUpdateTab(tabDocument, (res) => {
            if (res.status === "success") {
                console.log(`background.js | Tab ${tabId} updated: `, res);
                index.insertCanvasTab(tab)
            } else {
                console.error(`background.js | Update failed for tab ${tabId}:`)
                console.error(res);
            }
        });

    }).catch(error => {
        console.error('background.js | Error retrieving tab data:', error);
    });
});

// TODO: Eval if we need this event at all, as we already have onUpdated
// (which may not trigger on url change, but we can check for that)
browser.browserAction.onClicked.addListener((tab, OnClickData) => {
    console.log('background.js | Browser action clicked: ', tab, OnClickData);

    // Ignore non-valid tabs(about:*, empty tabs etc)
    if (!browserIsValidTabUrl(tab.url)) return

    // Update the current index
    index.updateBrowserTabs();

    // Update our backend
    let tabDocument = TabSchema
    tabDocument.data = stripTabProperties(tab)

    canvasUpdateTab(tabDocument, (res) => {
        if (res.status === "success") {
            console.log(`background.js | Tab ${tabId} updated: `, res);
            index.insertCanvasTab(tab)
        } else {
            console.error(`background.js | Update failed for tab ${tabId}:`)
            console.error(res);
        }
    });

});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log('background.js | Tab removed: ', tabId, removeInfo);
    
    // Lets fetch the tab based on ID from our index
    // This is needed as the tab object is not available after removal
    let tab = index.getBrowserTabByID(tabId);
    console.log('background.js | Tab object URL from index: ', tab.url);

    // Update the current index (remove tab), maybe we should move it in the callback?
    index.updateBrowserTabs()

    // TODO: Will be removed, as internal Index will have a stripTabProperties method
    let tabDocument = TabSchema
    tabDocument.data = stripTabProperties(tab)

    // Send update to backend
    canvasRemoveTab(tabDocument, (res) => {
        if (res.status === "success") {
            console.log(`background.js | Tab ${tabId} removed from Canvas: `, res);
            index.removeCanvasTab(tab.url)
        } else {
            console.error(`background.js | Remove failed for tab ${tabId}:`)
            console.error(res);
        }
    })

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
            canvasSaveTabArray(index.deltaBrowserToCanvas(), (res) => {
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
