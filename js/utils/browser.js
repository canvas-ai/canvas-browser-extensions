function browserIsValidTabUrl(tabUrl) {
    // Ignore empty tabs and URLs starting with "about:"
    if (tabUrl == "" || /^about:/.test(tabUrl)) {
        return false;
    }
    return true;
}

function browserCloseTab(id) {

}

function browserOpenTab(url) {

}

function browserOpenTabArray(tabArray) {

}

function browserCloseTabArray(tabArray) {

}

function browserSendTabToCanvas(tab) {}


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
            console.log(`background.js | Opening tab ${newTab.url}`);
            browser.tabs.create(newTab.url);
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

