console.log('UI | Initializing Canvas Browser Extension menu');


/**
 * Runtime variables
 */

let config = {};
let context = {};
let isConnected = false;

let canvasToBrowserTabsDelta = {};
let browserToCanvasTabsDelta = {};


/**
 * Initialize the UI
 */

document.addEventListener("DOMContentLoaded", () => {
    console.log('UI | DOM loaded');

    // TODO: Rework to use a single request to background.js for initial variables
    Promise.all([
        fetchVariable({ action: 'socket:status' }),
        fetchVariable({ action: 'config:get' }),
        fetchVariable({ action: 'context:get' }),
        fetchVariable({ action: 'tabs:get:browserToCanvasDelta' }),
        fetchVariable({ action: 'tabs:get:canvasToBrowserDelta' })
    ]).then((values) => {

        // TODO: Handle errors
        isConnected = values[0];
        config = values[1];
        context = values[2];
        browserToCanvasTabsDelta = values[3];
        canvasToBrowserTabsDelta = values[4];

        console.log(browserToCanvasTabsDelta)
        console.log(canvasToBrowserTabsDelta)

        var mTabElements = document.querySelectorAll(".tabs");
        var mTabs = M.Tabs.init(mTabElements, {});

        var mCollapsibleElements = document.querySelectorAll(".collapsible");
        var mCollapsible = M.Collapsible.init(mCollapsibleElements, {
            accordion: false,
        });

        if (!isConnected) {
            console.log('UI | No context URL received from backend')
            updateContextBreadcrumbs('> Canvas backend not connected')
        } else {
            updateContextBreadcrumbs(sanitizePath(context.url))
        }

        console.log(browserToCanvasTabsDelta)

        updateTabList(browserToCanvasTabsDelta, 'browser-to-canvas-tab-list');
        updateTabList(canvasToBrowserTabsDelta, 'canvas-to-browser-tab-list');

    }).catch(error => {
        console.error("Error loading variables:", error);
    });

});


/**
 * Listeners
 */

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('UI | Message received: ', message);
    if (message.type === 'context:url') {
        const url = message.data;
        console.log(`UI | Got context URL: "${url}"`)
        updateContextBreadcrumbs(sanitizePath(url))

        Promise.all([
            fetchVariable({ action: 'tabs:get:browserToCanvasDelta' }),
            fetchVariable({ action: 'tabs:get:canvasToBrowserDelta' })
        ]).then((values) => {
            browserToCanvasTabsDelta = values[0];
            canvasToBrowserTabsDelta = values[1];
            updateTabList(browserToCanvasTabsDelta, 'browser-to-canvas-tab-list');
            updateTabList(canvasToBrowserTabsDelta, 'canvas-to-browser-tab-list');
        });

        context.url = url
    }
});


/**
 * UI Controls
 */

let syncTabsToCanvasButton = document.getElementById('sync-all-tabs');
syncTabsToCanvasButton.addEventListener('click', () => {
    console.log('UI | Syncing all tabs to canvas')
    browser.runtime.sendMessage({ action: 'context:syncTabs' });
})

let openTabsFromCanvasButton = document.getElementById('open-all-tabs');
openTabsFromCanvasButton.addEventListener('click', () => {
    console.log('UI | Opening all tabs from canvas')

})

let closeAllBrowserTabsButton = document.getElementById('close-all-tabs');
closeAllBrowserTabsButton.addEventListener('click', () => {
    console.log('UI | Closing all current tabs')

})

/**
 * Utils
 */

function fetchVariable(message) {
    return browser.runtime.sendMessage(message);
}

function sanitizePath(path) {
    if (!path || path == '/') return '∞:///'
    path = path
        .replace(/\/\//g, '/')
        .replace(/\:/g, '')
        .replace(/universe/g,'∞')

    return path
}

function updateContextBreadcrumbs(url) {
    console.log('UI | Updating breadcrumbs')
    if (!url) return console.log('UI | No URL provided')
    if (typeof url !== 'string') return console.log('UI | URL is not a string')

    //url = sanitizePath(url)
    const breadcrumbContainer = document.getElementById("breadcrumb-container");
    if (breadcrumbContainer) {
        breadcrumbContainer.innerHTML = ""; // Clear existing breadcrumbs

        const breadcrumbNames = url.split("/").filter((name) => name !== "");
        breadcrumbNames.forEach((name) => {
            const breadcrumbLink = document.createElement("a");
            breadcrumbLink.href = "#!";
            breadcrumbLink.className = "breadcrumb black-text";
            breadcrumbLink.textContent = name;
            breadcrumbContainer.appendChild(breadcrumbLink);
        });
    }
}

function updateTabCount(tabs, containerID) {
    console.log('UI | Updating tab count')
    if (!tabs || tabs.length < 1) return console.log('UI | No tabs provided')
    let count = 0;
    for (let i = 0; i < tabs.length; i++) {
        if (browserIsValidTabUrl(tabs[i].url)) {
            count++;
        }
    }

    console.log(`UI | Number of open tabs (excluding empty/new tabs): ${count}`);
    document.getElementById(containerID).textContent = count;
}

function updateTabList(tabs, containerID) {
    if (!tabs || tabs.length < 1) return;

    console.log(`UI | Updating tab list: ${containerID}`)
    console.log(tabs)
    
    const tabListContainer = document.getElementById(containerID);

    // Clear the existing tab list
    tabListContainer.innerHTML = '';

    // Generate the updated tab list
    tabs.forEach((tab) => {
        const tabItem = document.createElement("li");
        tabItem.className = "collection-item";

        // Create an anchor tag to make the entire item clickable
        const tabItemLink = document.createElement("a");
        tabItemLink.href = tab.url; 
        tabItemLink.className = "tab-title truncate black-text";
        tabItemLink.style.textDecoration = "none"; // Remove underline from links

        // Create an image element for the favicon
        const favicon = document.createElement("img");
        favicon.src = tab.favIconUrl;
        favicon.style.width = '16px';
        favicon.style.height = '16px';
        favicon.style.marginRight = '8px';

        // Append favicon and text to the link
        tabItemLink.appendChild(favicon);
        tabItemLink.appendChild(document.createTextNode(tab.title)); // Use createTextNode to avoid HTML injection

        // Append the link to the list item
        tabItem.appendChild(tabItemLink);
        tabListContainer.appendChild(tabItem);
    });
}

