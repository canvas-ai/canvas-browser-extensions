/**
 * Configuration section
 * TODO: To be set in the UI and stored with store.js in local storage
 */

// Default config
/*config = {
    transport: {
        protocol: 'http',
        host: 'localhost',
        port: 3000,
        token: 'canvas-socketio-token'
    },

    // You can add tags to your browser tabs if you want to use multiple browser instances with Canvas
    browserTags: ['test']
}*/

// Logic to load the config from store.js goes here || fetch from canvas backend


/**
 * Runtime variables
 */

// Lets set some defaults
let context = {
    url: 'universe:///',
    color: '#fff',
};

let syncQueue = new Map();

let TabSchema;
let tabs;
let tabUrls = {};   // Workaround for the missing tab info on onRemoved() and onMove()

let watchTabProperties = {
    properties: [
        "url",
        "hidden",
        "pinned",
        "mutedInfo"
    ]
};

TabSchema = {}

/**
 * Socket.io
 */

// TODO: Configure based on config.json || store.js
const socket = io.connect(`${config.transport.protocol}://${config.transport.host}:${config.transport.port}`);

socket.on('connect', () => {
    console.log('[socket.io] Client connected to server');
    fetchContextUrl();
    fetchTabSchema();
    fetchStoredUrls();
});

socket.on('connect_error', function (error) {
    console.log(`[socket.io] Connection to "${config.transport.protocol}://${config.transport.host}:${config.transport.port}" failed`);
    console.error(error.message);
});

socket.on('connect_timeout', function () {
    console.log('[socket.io] Connection Timeout');
});

socket.on('disconnect', () => {
    console.log('[socket.io] Client disconnected from server');
});

socket.on('context:url', (url) => {
    console.log('[socket.io] Received context URL: ', url);
    context.url = url;
    // Try to update the UI (might not be loaded yet)
    browser.runtime.sendMessage({ type: 'context:url', data: url }, function(response) {
        if (browser.runtime.lastError) {
            console.log(`Error: ${browser.runtime.lastError}`);
        } else {
            console.log('Message sent successfully');
        }
    });
});


// Get tabs for the current context from Canvas
// Get current tabs from browser
// Compare and sync




/**
 * Message Handlers
 */

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('background.js | Message received: ', message);

    switch (message.action) {

        // socket.io
        case 'get:socket:status':
            console.log('Got get socket status')
            sendResponse(socket.connected);
            break;

        // Canvas Config
        case 'get:config':
            sendResponse(config);
            break;

        case 'get:config:item':
            if (!message.key) return console.error('No config key specified');
            sendResponse(config[message.key]);
            break;

        case 'set:config:item':
            if (!message.key || !message.value) return console.error('No config key or value specified');
            config[message.key] = message.value;
            sendResponse(config[message.key]);
            break;

        // Context
        case 'get:context':
            sendResponse(context);
            break;

        case 'get:context:url':
            sendResponse(context.url);
            break;

        case 'get:context:path':
            sendResponse(context.path);
            break;

        case 'get:context:color':
            sendResponse(context.color);
            break;

        // Tabs
        case 'get:tab:schema':
            sendResponse(TabSchema);
            break;

        case 'get:tabs':
            try {
                const response = sendTabToCanvas();
                console.log(response);
            } catch (error) {
                console.error(error);
            }
            break;

        case 'sync:tab':
            syncTabToBackend(message.tabID, (res) => {
                if (res.status === "success") {
                    console.log(`Tab ${message.tabID} synced: `, res);
                } else {
                    console.error(`Sync failed for tab ${message.tabID}:`)
                    console.error(res);
                }
            })
            break;

        case 'sync:all-tabs':
            saveTabsToBackend((res) => {
                if (res.status === "success") {
                    console.log('All tabs synced: ', res);
                } else {
                    console.error('Sync failed:')
                    console.error(res);
                }


            })
            break;

        case 'update:tab':
            break;

        case 'remove:tab':
            break;

        default:
            console.error(`Unknown message action: ${message.action}`);
            break;

    }

});


/**
 * Browser event listeners
 */

browser.tabs.onCreated.addListener((tab) => {
    // noop, we need to wait for the onUpdated event to get the url
    console.log(`Tab created: ${tab.id}`);
})

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only trigger if url is set and is different from what we already have cached
    // Assuming we already have the current session stored
    if (changeInfo.url && tabUrls[tabId] !== tab.url) {

        // Ignore empty tabs
        if (tab.url == "about:newtab" || tab.url == "about:blank") return
        tabUrls[tabId] = tab.url;

        let doc = formatTabProperties(tab);

        // Update backend
        console.log(`Tab ID ${tabId} changed, sending update to backend`)
        saveTabToBackend(doc)

        // Update browser
        console.log(`Tab ID ${tabId} changed, sending update to browser extension`)
    }
}, watchTabProperties)

browser.tabs.onMoved.addListener((tabId, moveInfo) => {
    let url = tabUrls[tabId];
    let tab = {
        id: tabId,
        url: url,
        index: moveInfo.toIndex
    };

    // Update backend
    console.log(`Tab ID ${tabId} moved from ${moveInfo.fromIndex} to ${moveInfo.toIndex}, sending update to backend`);
    let doc = TabSchema
    doc.data = stripTabProperties(tab)
    //updateDocument(doc)
    saveTabToBackend(doc)

});

browser.browserAction.onClicked.addListener((tab, OnClickData) => {

    // Ignore empty tabs
    if (!tab.url || tab.url == "about:newtab" || tab.url == "about:blank") return

    // Update backend
    console.log(`Sending update to backend for tab ${tab.id}`);
    tabUrls[tab.id] = tab.url;

    let doc = TabSchema
    doc.data = stripTabProperties(tab)

    //updateDocument(doc)
    saveTabToBackend(doc)

});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
    let url = tabUrls[tabId];
    let tab = {
        id: tabId,
        url: url
    };

    // Ignore empty tabs
    if (!tab.url || tab.url == "about:newtab" || tab.url == "about:blank") return

    let doc = TabSchema
    doc.data = stripTabProperties(tab)

    // Update backend
    console.log(`Tab ID ${tabId} removed, updating backend`);
    removeDocument(doc)

    // Update browser
    console.log(`Tab ID ${tabId} removed, sending update to browser extension`)
    delete tabUrls[tabId]
});


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
    socket.emit('index:getDocuments', tabID, (res) => {
        console.log(`Tab ${tabID} fetched: `, res);
        if (cb) cb(res)
    });
}

function saveTabsToBackend(cb) {
    browser.tabs.query({}).then((tabs) => {
        let docs = tabs.map(tab => formatTabProperties(tab));
        socket.emit('index:insertDocumentArray', docs, (res) => {
            console.log('Tabs inserted: ', res);
            if (cb) cb(res)
        });
    })
}

function loadTabsFromBackend(cb) {
    socket.emit('index:getDocuments', { type: 'data/abstraction/tab', version: '2' }, (res) => {
        console.log('Tabs fetched: ', res);
        tabs = res;
        if (cb) cb(res)
    });
}



/**
 * Canvas functions
 */

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

async function loadTabsFromCanvas(tagArray) {
    return new Promise((resolve, reject) => {
        socket.emit('sendTabToCanvas', tagArray, (response) => {
            if (response.error) {
                reject(response.error);
            } else {
                resolve(response);
            }
        });
    });
}



/**
 * Functions
 */

function checkConnection() {
    let intervalId = setInterval(() => {
        if (!isConnected) {
            console.log('UI | Canvas backend not yet connected');
        } else {
            clearInterval(intervalId);

        }
    }, 1000); // Check every second
}

// Fetch context URL, Tab schema, and stored URLs from the server
function fetchContextUrl() {
    socket.emit('context:get:url', {}, function (data) {
        context.url = data;
        console.log('Context URL fetched: ', context.url);
    });
}

function fetchTabSchema() {
    socket.emit('db:schema:get', { type: 'data/abstr/tab', version: '2' }, function (res) {
        if (!res || res.status === 'error') {
            console.error('Tab schema not found');
        }
        Tab = res;
        console.log('Tab schema fetched: ', Tab);
    });
}

function fetchStoredUrls() {
    socket.emit('listDocuments', {
        context: context.url,
        type: 'data/abstraction/tab',
    }, (data) => {
        tabUrls = data;
        console.log('Stored URLs fetched: ', tabUrls);
    });
}

/**
 * Browser tab functions
 */

function updateBrowserTabs(tabArray, hideInsteadOfRemove = false) {
    browser.tabs.query({}).then((tabs) => {
        let tabsToRemove = tabs.filter(tab => !tabArray.find(newTab => newTab.id === tab.id));
        tabsToRemove.forEach(tab => {
            console.log(`Removing tab ${tab.id}`);
            browser.tabs.remove(tab.id)
        });

        tabArray.forEach(newTab => {
            if (!tabs.find(tab => tab.id === newTab.id)) {
                console.log(`Creating tab ${tab.id}`);
                browser.tabs.create(newTab);
            }
        });
    });
}

/**
 * Utils
 */

function sanitizeContextPath(path) {
    if (!path || path == '/') return '∞:///'
    path = path
        .replace(/\/\//g, '/')
        .replace(/\:/g, '')
        .replace(/universe/g,'∞')

    return path
}

function stripTabProperties(tab) {
    return {
        //id: tab.id,
        index: tab.index,
        // Restore may fail if windowId does not exist
        // TODO: Handle this case with windows.create()
        // windowId: tab.windowId,
        highlighted: tab.highlighted,
        active: tab.active,
        pinned: tab.pinned,
        hidden: tab.hidden,
        // boolean. Whether the tab is created and made visible in the tab bar without any content
        // loaded into memory, a state known as discarded. The tab's content is loaded when the tab
        // is activated.
        // Defaults to true to conserve memory on restore
        discarded: true, // tab.discarded,
        incognito: tab.incognito,
        //width: 1872,
        //height: 1004,
        //lastAccessed: 1675111332554,
        audible: tab.audible,
        mutedInfo: tab.mutedInfo,
        isArticle: tab.isArticle,
        isInReaderMode: tab.isInReaderMode,
        sharingState: tab.sharingState,
        url: tab.url,
        title: tab.title
    }
}

function formatTabProperties(tab) {
    return {
        ...TabSchema,
        type: 'data/abstraction/tab',
        data: {
            //id: tab.id,
            index: tab.index,
            url: tab.url,
            title: tab.title,
            // Restore may fail if windowId does not exist
            // TODO: Handle this case with windows.create()
            // windowId: tab.windowId,
            highlighted: tab.highlighted,
            active: tab.active,
            pinned: tab.pinned,
            hidden: tab.hidden,
            // boolean. Whether the tab is created and made visible in the tab bar without any content
            // loaded into memory, a state known as discarded. The tab's content is loaded when the tab
            // is activated.
            // Defaults to true to conserve memory on restore
            discarded: true, // tab.discarded,
            incognito: tab.incognito,
            //width: 1872,
            //height: 1004,
            //lastAccessed: 1675111332554,
            audible: tab.audible,
            mutedInfo: tab.mutedInfo,
            isArticle: tab.isArticle,
            isInReaderMode: tab.isInReaderMode,
            sharingState: tab.sharingState,
        }

    }

}
