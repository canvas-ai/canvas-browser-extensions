class TabIndex {

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

    get browserTabCount() { return this.browserTabs.size; }
    get canvasTabCount() { return this.canvasTabs.size; }
    get browserToCanvasDeltaCount() { return this.deltaBrowserToCanvas().length; }
    get canvasToBrowserDeltaCount() { return this.deltaCanvasToBrowser().length; }

    getBrowserTabArray() {
        return [...this.browserTabs.values()];
    }

    getBrowserTabByID(id) {
        let url = this.browserTabIdToUrl.get(id);
        return this.browserTabs.get(url);
    }

    insertBrowserTab(tab) {
        if (!tab.id || !tab.url) return console.error('background.js | Invalid tab object: ', tab);
        this.browserTabIdToUrl.set(tab.id, tab.url);
        this.browserTabs.set(tab.url, this.#stripTabProperties(tab));
    }

    removeBrowserTab(url) {
        let tab = this.browserTabs.get(url);
        this.browserTabIdToUrl.delete(tab.id);
        this.browserTabs.delete(url);
    }

    insertBrowserTabArray(tabArray, clear = true) {
        if (clear) {
            this.browserTabs.clear();
            this.browserTabIdToUrl.clear();
        }

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
                if (browserIsValidTabUrl(tab.url)) {
                    return this.#stripTabProperties(tab);
                }
            }).filter(tab => tab != undefined);
            this.insertBrowserTabArray(processedTabs);
        });
    }

    insertCanvasTab(tab) {
        this.canvasTabs.set(tab.url, this.#stripTabProperties(tab));
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

    getCanvasTabArray() {
        return [...this.canvasTabs.values()];
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

    #stripTabProperties(tab) {
        return {
            id: tab.id,
            index: tab.index,

            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl ? tab.favIconUrl : browser.runtime.getURL('icons/logo_64x64.png'),

            // Restore may fail if windowId does not exist hence omitted
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
