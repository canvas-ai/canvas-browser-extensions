function browserIsValidTabUrl(tabUrl) {
    return !/^(about|chrome|moz-extension|file|view-source|view-unsafely):/.test(tabUrl);
}

async function browserOpenTab(tab) {
    if (!tab) return false;
    if (!browserIsValidTabUrl(tab.url)) return false;
    console.log(`background.js | Opening tab: `, tab);

    try {
        return await browser.tabs.create({
            url: tab.url,
            title: tab.title,
            discarded: typeof tab.discarded !== 'undefined' ? tab.discarded : true,
            cookieStoreId: tab.cookieStoreId
            //windowId: tab.windowId, // Restore may fail if windowId does not exist, TODO: Handle this case with windows.create()
            //index: tab.index, 
            //active: tab.active,
            //muted: tab.muted,
            //openInReaderMode: tab.openInReaderMode,
            //pinned: tab.pinned,
            //selected: tab.selected            
        });
    } catch (error) {
        console.error('UI | Error creating tab:', error);
        return false;
    }
}


async function browserOpenTabArray(tabArray) {
    if (!tabArray || !tabArray.length) return false;
    console.log(`background.js | Opening tab array: `, tabArray);

    try {
        let windows = await browser.windows.getAll();
        if (windows.length === 0) {
            await browser.windows.create({});
        }

        for (const tab of tabArray) {
            if (!index.hasBrowserTab(tab.url)) {
                console.log(`background.js | Opening tab ${tab.url}`);
                await browserOpenTab(tab);  // assuming browserOpenTab is an async function
            }
        }
    } catch (error) {
        console.error('background.js | Error opening tab array:', error);
    }
}


function browserCloseTab(id) {
    if (!id) return false;
    return browser.tabs.remove(id);
}

function browserCloseTabArray(tabArray) {
    if (!tabArray || !tabArray.length) return false;
    return browser.tabs.remove(tabArray);
}

async function browserCloseNonContextTabs() {
    try {
        let tabs = await browser.tabs.query({});
        let tabsToRemove = tabs.filter(tab => !index.hasCanvasTab(tab.url));
        if (tabsToRemove.length === 0) return;

        if (tabs.length === tabsToRemove.length) {
            // Open a new tab before closing all others to ensure at least one remains
            await browser.tabs.create({});
        }

        for (const tab of tabsToRemove) {
            console.log(`background.js | Removing tab ${tab.id}`);
            await browser.tabs.remove(tab.id);  // Using await here to ensure tab is removed
        }
    } catch (error) {
        console.error('Error in closing non-context tabs:', error);
    }
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


