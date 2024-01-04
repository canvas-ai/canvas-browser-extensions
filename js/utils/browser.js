function browserIsValidTabUrl(tabUrl) {
    return !/^(about|chrome|moz-extension|file|view-source|view-unsafely):/.test(tabUrl);
}

function browserOpenTab(tab) {
    if (!tab) return false;
    browser.tabs.create({
        url: tab.url,
        title: tab.title,
        discarded: tab.discarded || true, // Defaults to true to conserve memory on restore
        cookieStoreId: tab.cookieStoreId
        //windowId: tab.windowId, // Restore may fail if windowId does not exist, TODO: Handle this case with windows.create()
        //index: tab.index, 
        //active: tab.active,
        //muted: tab.muted,
        //openInReaderMode: tab.openInReaderMode,
        //pinned: tab.pinned,
        //selected: tab.selected
    });
}

function browserOpenTabArray(tabArray) {
    if (!tabArray || !tabArray.length) return false;    
    console.log(`background.js | Opening tab array: `, tabArray)

    browser.windows.getAll().then((windows) => {
        if (windows.length === 0) {
            browser.windows.create({ url: "about:newtab" });
        }

        tabArray.forEach(tab => {
            if (!index.hasBrowserTab(tab.url)) {
                console.log(`background.js | Opening tab ${tab.url}`);
                browserOpenTab(tab);    
            }
        });
    }); 
}

function browserCloseTab(id) {
    if (!id) return false;
    browser.tabs.remove(id);
}

function browserCloseTabArray(tabArray) {
    if (!tabArray || !tabArray.length) return false;
    browser.tabs.remove(tabArray);
}

function browserCloseNonContextTabs() {
    browser.tabs.query({}).then(async (tabs) => {
        let tabsToRemove = tabs.filter(tab => !index.hasCanvasTab(tab.url));
        if (tabsToRemove.length === 0) return;

        if (tabs.length <= tabsToRemove.length) {
            // Ensure we always have at least one tab open
            await browser.tabs.create({});
        }

        await tabsToRemove.forEach(tab => {
            console.log(`background.js | Removing tab ${tab.id}`);
            browser.tabs.remove(tab.id)
        });
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


