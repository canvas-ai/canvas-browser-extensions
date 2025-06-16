import { RUNTIME_MESSAGES } from "@/general/constants";
import { browserIsValidTabUrl, filterRemovedPinnedTabs, sendRuntimeMessage } from "./utils";
import { browser } from "@/general/utils";


let timeout: any;
let browserUpdateTimeout: any;

export class TabIndex {
	browserTabIdToUrl: Map<any, any>;
	browserTabs: Map<any, any>;
	canvasTabs: Map<any, any>;

	constructor() {
		this.browserTabIdToUrl = new Map();
		this.browserTabs = new Map();
		this.canvasTabs = new Map();
	}

	async initialize() {
		await this.loadCanvasTabsFromStorage();
		console.log('background.js | TabIndex initialized with persisted canvas tabs');
	}

	// Common methods
	counts() {
		return {
			browserTabs: this.browserTabs.size,
			canvasTabs: this.canvasTabs.size,
			browserTabIdToUrl: this.browserTabIdToUrl.size,
		};
	}

	get browserTabCount() {
		return this.browserTabs.size;
	}
	get canvasTabCount() {
		return this.canvasTabs.size;
	}
	get browserToCanvasDeltaCount() {
		return this.deltaBrowserToCanvas().length;
	}
	get canvasToBrowserDeltaCount() {
		return this.deltaCanvasToBrowser().length;
	}

	getCanvasDocumentIdByTabUrl(url: string): number | undefined {
		return this.canvasTabs.get(url)?.docId;
	}

	getBrowserTabArray(): chrome.tabs.Tab[] {
		return [...this.browserTabs.values()];
	}

	getBrowserTabByID(id: number) {
		let url = this.browserTabIdToUrl.get(id);
		return this.browserTabs.get(url);
	}

	insertBrowserTab(tab: ICanvasTab) {
		if (!tab.id || !tab.url)
			return console.error("background.js | Invalid tab object: ", tab);
		this.browserTabIdToUrl.set(tab.id, tab.url);
		this.browserTabs.set(tab.url, this.#stripTabProperties(tab));
	}

	removeBrowserTab(url: string) {
		let tab = this.browserTabs.get(url);
		this.browserTabIdToUrl.delete(tab.id);
		this.browserTabs.delete(url);
	}

	insertBrowserTabArray(tabArray: ICanvasTab[], clear = true) {
		if (clear) {
			this.browserTabs.clear();
			this.browserTabIdToUrl.clear();
		}

		tabArray.forEach((tab) => this.insertBrowserTab(tab));
	}

	hasBrowserTab(url: string) {
		return this.browserTabs.has(url);
	}

	clearBrowserTabs() {
		this.browserTabIdToUrl.clear();
		this.browserTabs.clear();
	}

	sendAllTabInfoMessages() {
		sendRuntimeMessage({ type: RUNTIME_MESSAGES.index_get_deltaCanvasToBrowser, payload: this.deltaCanvasToBrowser() });
		sendRuntimeMessage({ type: RUNTIME_MESSAGES.index_get_deltaBrowserToCanvas, payload: this.deltaBrowserToCanvas() });
		sendRuntimeMessage({ type: RUNTIME_MESSAGES.opened_canvas_tabs, payload: this.getOpenedCanvasTabs() });
		sendRuntimeMessage({ type: RUNTIME_MESSAGES.synced_browser_tabs, payload: this.getSyncedBrowserTabs() });
	}

	async updateBrowserTabs() {
		console.log("background.js | Updating browser tabs in index");
		try {
			const tabs = await browser.tabs.query({});
			console.log(
				`background.js | Found ${tabs.length} open browser tabs, updating index`
			);

			const processedTabs = tabs.reduce((acc, tab) => {
				if (tab.url && browserIsValidTabUrl(tab.url)) {
					acc.push(this.#stripTabProperties(tab) as never);
				}
				return acc;
			}, []);

			this.insertBrowserTabArray(processedTabs);

			this.sendAllTabInfoMessages();
		} catch (error) {
			console.error("background.js | Error updating browser tabs:", error);
			throw error; // Or handle it as you see fit
		}
	}

	updatePopupTabsWithDelay() {
		clearTimeout(timeout);
		timeout = setTimeout(() => {
			this.sendAllTabInfoMessages();
		}, 100);
	}

	updateBrowserTabsWithDelay() {
		clearTimeout(browserUpdateTimeout);
		browserUpdateTimeout = setTimeout(() => {
			this.updateBrowserTabs();
		}, 150);
	}

	insertCanvasTab(tab: ICanvasTab) {
		this.canvasTabs.set(tab.url, this.#stripTabProperties(tab));
		this.updatePopupTabsWithDelay();
		this.saveCanvasTabsToStorage();
	}

	insertCanvasTabSilent(tab: ICanvasTab) {
		this.canvasTabs.set(tab.url, this.#stripTabProperties(tab));
		// No UI update triggered
		this.saveCanvasTabsToStorage();
	}

	removeCanvasTab(url: string) {
		this.canvasTabs.delete(url);
		this.updatePopupTabsWithDelay();
		this.saveCanvasTabsToStorage();
	}

	insertCanvasTabArray(tabArray: ICanvasTab[], clear = true) {
		if (clear) this.canvasTabs.clear();
		console.log(
			"background.js | Inserting canvas tab array in index: ",
			tabArray.length
		);
		tabArray.forEach((tab) => {
			this.canvasTabs.set(tab.url, this.#stripTabProperties(tab));
		});
		this.updatePopupTabsWithDelay();
		this.saveCanvasTabsToStorage();
	}

	insertCanvasTabArraySilent(tabArray: ICanvasTab[], clear = true) {
		if (clear) this.canvasTabs.clear();
		console.log(
			"background.js | Inserting canvas tab array in index (silent): ",
			tabArray.length
		);
		tabArray.forEach((tab) => {
			this.canvasTabs.set(tab.url, this.#stripTabProperties(tab));
		});
		// No UI update triggered
		this.saveCanvasTabsToStorage();
	}

	hasCanvasTab(url: string) {
		return this.canvasTabs.has(url);
	}

	getCanvasTabArray() {
		return [...this.canvasTabs.values()];
	}

	clearCanvasTabs() {
		this.canvasTabs.clear();
		this.saveCanvasTabsToStorage();
	}

	deltaBrowserToCanvas() {
		console.log("background.js | Computing delta browser to canvas");
		return [...this.browserTabs.values()].filter(
			(tab) => !this.canvasTabs.has(tab.url)
		);
	}

	deltaCanvasToBrowser() {
		console.log("background.js | Computing delta canvas to browser");
		return [...this.canvasTabs.values()].filter(
			(tab) => !this.browserTabs.has(tab.url)
		);
	}

	getSyncedBrowserTabs() {
		return [...this.browserTabs.values()].filter(
			(tab) => this.canvasTabs.has(tab.url)
		);
	}

	getOpenedCanvasTabs() {
		return [...this.canvasTabs.values()].filter(
			(tab) => this.browserTabs.has(tab.url)
		);
	}

	clearIndex() {
		console.log("background.js | Clearing tab index");
		this.clearBrowserTabs();
		this.clearCanvasTabs();
	}

	// Persistence methods for canvas tabs
	async saveCanvasTabsToStorage() {
		try {
			const canvasTabsArray = this.getCanvasTabArray();
			await browser.storage.local.set({ 'CNVS_CANVAS_TABS': canvasTabsArray });
			console.log(`background.js | Saved ${canvasTabsArray.length} canvas tabs to storage`);
		} catch (error) {
			console.error('background.js | Error saving canvas tabs to storage:', error);
		}
	}

	async loadCanvasTabsFromStorage() {
		try {
			const result = await browser.storage.local.get(['CNVS_CANVAS_TABS']);
			const canvasTabsArray = result.CNVS_CANVAS_TABS || [];

			if (canvasTabsArray.length > 0) {
				console.log(`background.js | Loading ${canvasTabsArray.length} canvas tabs from storage`);
				// Don't save to storage again during loading to avoid recursion
				canvasTabsArray.forEach((tab) => {
					this.canvasTabs.set(tab.url, this.#stripTabProperties(tab));
				});
			} else {
				console.log('background.js | No canvas tabs found in storage');
			}
		} catch (error) {
			console.error('background.js | Error loading canvas tabs from storage:', error);
		}
	}

	#stripTabProperties(tab: ICanvasTab) {
		return {
			id: tab.id,
			docId: tab.docId,
			index: tab.index,

			url: tab.url,
			title: tab.title,
			favIconUrl: tab.favIconUrl ? tab.favIconUrl : browser.runtime.getURL('icons/logo_64x64.png'),

			highlighted: tab.highlighted,
			active: tab.active,
			pinned: tab.pinned,

			// boolean. Whether the tab is created and made visible in the tab bar without any content
			// loaded into memory, a state known as discarded. The tab's content is loaded when the tab
			// is activated.
			// Defaults to true to conserve memory on restore
			discarded: true, // tab.discarded,

			incognito: tab.incognito,
			audible: tab.audible,
			mutedInfo: tab.mutedInfo,
		};
	}

	// Debugging method to check docId status
	logCanvasTabsWithDocIds() {
		console.log('background.js | Canvas tabs in index with docIds:');
		for (const [url, tab] of this.canvasTabs) {
			console.log(`  - ${url}: docId=${tab.docId}, id=${tab.id}`);
		}
		console.log(`background.js | Total canvas tabs: ${this.canvasTabs.size}`);
	}
}

const index = new TabIndex();
export default index;
