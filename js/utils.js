function browserIsValidTabUrl(tabUrl) {
    
    // Ignore empty tabs and URLs starting with "about:"
    if (tabUrl == "" || /^about:/.test(tabUrl)) {
        return false;
    }
    return true;
}

function browserCloseCurrentTabs() {
    browser.tabs.query({}).then((tabs) => {
        let tabsToRemove = tabs.filter(tab => !index.hasCanvasTab(tab.url));
        tabsToRemove.forEach(tab => {
            console.log(`background.js | Removing tab ${tab.id}`);
            browser.tabs.remove(tab.id)
        });
    });
}

function browserOpenTabs(tabArray) {
    tabArray.forEach(newTab => {
        if (!index.hasBrowserTab(newTab.url)) {
            console.log(`background.js | Opening tab ${newTab.id}`);
            browser.tabs.create(newTab);
        }
    });
}

function sanitizeContextPath(path) {
    if (!path || path == '/') return 'universe:///'
    path = path
        //.replace(/\/\//g, '/')
        //.replace(/\:/g, '')
        //.replace(/universe/g,'∞')

    return path
}

function stripTabProperties(tab) {
    return {
        id: tab.id,
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
        title: tab.title,
        favIconUrl: tab.favIconUrl
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
            favIconUrl: tab.favIconUrl,
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

function canvasFetchContextUrl(cb) {
    socket.emit('context:get:url', (res) => {
        console.log('background.js | Context url fetched: ', res);
        cb(res)
    });
}

function canvasFetchTabSchema(cb) {
    socket.emit('schemas:get', { type: 'data/abstraction/tab'}, (res) => {
        console.log('background.js | Tab schema fetched: ', res);
        cb(res)
    });
}

function canvasFetchTab(id, cb) {}

function canvasHasTab(id, cb) {}

function canvasInsertTab(tab, cb) {

}

function canvasUpdateTab(tab, cb) {}

function canvasRemoveTab(id, cb) {}

function canvasFetchContextTabs(cb) {
    // TODO: Rework naming convention, should be context:documents:get
    socket.emit('documents:get', { type: 'data/abstraction/tab'}, (res) => {
        console.log('background.js | Tabs fetched: ', res);
        if (res.status === 'error') {
            console.error('background.js | Error fetching tabs: ', res);
            return false;
        }

        // TODO: Move to a separate function
        // Format of a CanvasDB object is { id: '...', meta: { ... }, data: { ... } }
        // We are only interested in data: { ... }
        const parsed = res.data.filter(tab => tab !== null).map(tab => tab.data);
        res.data = parsed;
        
        cb(res);
    });
}

function canvasSaveTabArray(tabArray, cb) {
    if (!tabArray) return false;
    socket.emit('documents:insertDocumentArray', tabArray, (res) => {
        if (cb) cb(res)
    });
}

function checkCanvasConnection() {
    let intervalId = setInterval(() => {
        if (!isConnected) {
            console.log('background.js | Canvas backend not yet connected');
        } else {
            clearInterval(intervalId);

        }
    }, 1000);
}
