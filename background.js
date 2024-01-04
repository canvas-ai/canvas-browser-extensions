console.log('background.js | Initializing Canvas Browser Extension background worker');

// Extension config @js/utils/config.js
// TabIndex @js/utils/TabIndex.js

// Runtime defaults
let context = {
    url: 'universe:///',
    color: '#fff',
};

let TabDocumentSchema = {
    type: 'data/abstraction/tab',
    meta: {},
    data: {}
};

let watchTabProperties = {
    properties: [
        "url",
        "hidden",
        "pinned",
        "mutedInfo"
    ]
};

// Custom index module for easier delta comparison
const index = new TabIndex();
console.log('background.js | Index initialized: ', index.counts());


/**
 * Initialize Socket.io
 */

const socket = io.connect(`${config.transport.protocol}://${config.transport.host}:${config.transport.port}`);
socket.on('connect', () => {
    console.log('background.js | [socket.io] Browser Client connected to Canvas');
    
    canvasFetchContext().then((res) => {
        console.log('background.js | [socket.io] Received context object: ', res.data);
        context = res.data;    
    });

    canvasFetchTabsForContext().then((res) => {
        if (!res || res.status !== 'success') return console.error('background.js | Error fetching tabs from Canvas')
        index.insertCanvasTabArray(res.data);        
    }).then(() => {
        index.updateBrowserTabs().then(() => {
            console.log('background.js | Index updated: ', index.counts());
        })    
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

    let res = await canvasFetchTabsForContext();
    await index.updateBrowserTabs();
    
    index.insertCanvasTabArray(res.data);

    // Automatically close existing tabs if enabled
    if (config.sync.autoCloseTabs) await browserCloseNonContextTabs();

    // Automatically open new canvas tabs if enabled
    if (config.sync.autoOpenTabs) await browserOpenTabArray(index.getCanvasTabArray());

    // Try to update the UI (might not be loaded(usually the case))
    browser.runtime.sendMessage({ type: 'context:url', data: url }, (response) => {
        if (browser.runtime.lastError) {
            console.log(`background.js | Unable to connect to UI, error: ${browser.runtime.lastError}`);
        } else {
            console.log('background.js | Message to UI sent successfully');
        }
    });

});


/**
 * Browser event listeners
 */

browser.tabs.onCreated.addListener((tab) => {
    // noop, we need to wait for the onUpdated event to get the url
    console.log(`background.js | Tab created: ${tab.id}`);
})

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log('background.js | Tab updated: ', tabId, changeInfo, tab);

    // Trigger on url change if the tab url is valid
    if (changeInfo.url && browserIsValidTabUrl(changeInfo.url)) {

        // Update the current index
        index.updateBrowserTabs().then(() => {
            console.log('background.js | Index updated: ', index.counts());
        });

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

browser.tabs.onMoved.addListener( (tabId, moveInfo) => {
    console.log('background.js | Tab moved: ', tabId, moveInfo);

    // Update the current index
    index.updateBrowserTabs().then(() => {
        console.log('background.js | Index updated: ', index.counts());
    });

    // noop
    //console.log('background.js | TODO: Disabled as we currently do not track move changes');
    //return;

    browser.tabs.get(tabId).then(tab => {
        let tabDocument = TabDocumentSchema
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
browser.browserAction.onClicked.addListener( (tab, OnClickData) => {
    console.log('background.js | Browser action clicked: ', tab, OnClickData);

    // Ignore non-valid tabs(about:*, empty tabs etc)
    if (!browserIsValidTabUrl(tab.url)) return

    // Update the current index
    index.updateBrowserTabs().then(() => {
        console.log('background.js | Index updated: ', index.counts());
    });

    // Update our backend
    let tabDocument = TabDocumentSchema
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

browser.tabs.onRemoved.addListener( (tabId, removeInfo) => {
    console.log('background.js | Tab removed: ', tabId, removeInfo);

    // Lets fetch the tab based on ID from our index
    // This is needed as the tab object is not available after removal
    let tab = index.getBrowserTabByID(tabId);
    if (!tab) return console.log(`background.js | Tab ${tabId} not found in index`);

    console.log('background.js | Tab object URL from index: ', tab.url);

    // Update the current index (remove tab), maybe we should move it in the callback?
    index.updateBrowserTabs().then(() => {
        console.log('background.js | Index updated: ', index.counts());
    });

    // TODO: Will be removed, as internal Index will have a stripTabProperties method
    let tabDocument = TabDocumentSchema
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

        // Config
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
        case 'context:get':
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

        case 'context:set:url':
            if (!message.url) return console.error('background.js | No context url specified');
            canvasInsertData('context:set:url', message.url, (res) => {
                if (!res || res.status === 'error') return console.error('background.js | Error setting context url')
                console.log('background.js | Context url set: ', res.data)
                sendResponse(res);
            });
            break;

        case 'context:tab:remove':
            if (!message.tab) return console.error('background.js | No tab specified');
            canvasRemoveTab(message.tab, (res) => {
                if (!res || res.status === 'error') return console.error('background.js | Error removing tab from Canvas')
                console.log('background.js | Tab removed from the current context in Canvas: ', res.data)
                sendResponse(res);
            });
            break;

        // Browser
        case 'browser:tabs:update':
            return Promise.resulve(index.updateBrowserTabs());
            break;

        case 'browser:tabs:open':
            if (message.tabs) {
                console.log('background.js | Tabs to sync: ' + message.tabs.length);
            } else {
                console.log('background.js | No tabs specified, using current browser tabs');
                message.tabs = index.getBrowserTabArray();
            }
            
            browserOpenTabArray(message.tabs);
            break;

        case 'browser:tabs:close':
            if (!message.tabs) return console.error('background.js | No tabs specified');
            browserCloseTabArray(message.tabs);
            break;

        // Canvas
        case 'canvas:tabs:fetch':
            canvasFetchTabsForContext((res) => {
                if (!res || res.status === 'error') return console.error('background.js | Error fetching tabs from Canvas')
                console.log('background.js | Tabs fetched from Canvas: ', res.data)
                index.insertCanvasTabArray(res.data);
                sendResponse(res);
            });
            break;

        case 'canvas:tabs:openInBrowser':
            if (message.tabs) {
                console.log('background.js | Tabs to open: ' + message.tabs.length);
            } else {
                console.log('background.js | No tabs specified, using indexed canvas tabs');
                message.tabs = index.getCanvasTabArray();
            }

            browserOpenTabArray(message.tabs)
            index.updateBrowserTabs().then(() => {
                sendResponse(index.counts());
            }).catch((error) => {
                console.error('background.js | Error updating browser tabs:', error);
            });
            break;

        case 'canvas:tabs:insert':
            let tabs;
            if (message.tabs) {
                console.log('background.js | Tabs to sync: ' + message.tabs.length);
                tabs = message.tabs;
            } else {
                console.log('background.js | No tabs specified, using current browser tabs');
                tabs = index.getBrowserTabArray();
            }

            
            canvasInsertTabArray(tabs, (res) => {
                if (!res || res.status === 'error') return console.error('background.js | Error inserting tabs to Canvas')
                console.log('background.js | Tabs inserted to Canvas: ', res)                
            }).then(() => {
                index.insertCanvasTabArray(tabs);
                console.log('background.js | Index updated: ', index.counts());
            }).catch((error) => {
                console.error('background.js | Error updating browser tabs:', error);
            })

            break;

        case 'canvas:tab:delete':
            if (!message.tab) return console.error('background.js | No tab specified');
            canvasRemoveTab(message.tabs, (res) => {
                if (!res || res.status === 'error') return console.error('background.js | Error removing tabs from Canvas')
                console.log('background.js | Tabs removed from Canvas: ', res.data)
                sendResponse(res);
            });
            break;

        // Index
        case 'index:get:counts':
            sendResponse(index.counts());
            break;

        case 'index:get:browserTabArray':
            sendResponse(index.getBrowserTabArray());
            break;

        case 'index:get:canvasTabArray':
            sendResponse(index.getCanvasTabArray());
            break;

        case 'index:get:deltaBrowserToCanvas':
            index.updateBrowserTabs().then(() => {
                console.log('background.js | Index updated: ', index.counts());
                sendResponse(index.counts());
            });            
            sendResponse(index.deltaBrowserToCanvas());
            break;

        case 'index:get:deltaCanvasToBrowser':
            index.updateBrowserTabs().then(() => {
                console.log('background.js | Index updated: ', index.counts());
                sendResponse(index.counts());
            });            
            sendResponse(index.deltaCanvasToBrowser());
            break;

        case 'index:updateBrowserTabs':

            break;

        case 'index:clear':
            sendResponse(index.clearIndex());
            break;

        default:
            console.error(`background.js | Unknown message action: ${message.action}`);
            break;

    }

});
