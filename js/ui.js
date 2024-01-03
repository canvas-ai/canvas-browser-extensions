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
        fetchVariable({ action: 'index:get:deltaBrowserToCanvas' }),
        fetchVariable({ action: 'index:get:deltaCanvasToBrowser' })
    ]).then((values) => {

        // TODO: Handle errors
        isConnected = values[0];
        config = values[1];
        context = values[2];
        browserToCanvasTabsDelta = values[3];
        canvasToBrowserTabsDelta = values[4];

        var mTabElements = document.querySelectorAll(".tabs");
        var mTabs = M.Tabs.init(mTabElements, {});

        var mCollapsibleElements = document.querySelectorAll(".collapsible");
        var mCollapsible = M.Collapsible.init(mCollapsibleElements, {
            accordion: false,
        });

        if (!isConnected) {
            console.log('UI | No context URL received from backend')
            updateContextBreadcrumbs('! Canvas backend not connected')
        } else {
            updateContextBreadcrumbs(context.url)
        }

        updateBrowserToCanvasTabList(browserToCanvasTabsDelta);
        updateCanvasToBrowserTabList(canvasToBrowserTabsDelta);

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
        updateContextBreadcrumbs(url)

        Promise.all([
            fetchVariable({ action: 'tabs:get:browserToCanvasDelta' }),
            fetchVariable({ action: 'tabs:get:canvasToBrowserDelta' })
        ]).then((values) => {
            browserToCanvasTabsDelta = values[0];
            canvasToBrowserTabsDelta = values[1];
            updateBrowserToCanvasTabList(browserToCanvasTabsDelta);
            updateCanvasToBrowserTabList(canvasToBrowserTabsDelta);
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

function sanitizeContextUrl(url) {
    console.log('UI | Sanitizing context URL')
    console.log(url)
    if (!url || url == '/' || url == 'universe:///') return 'Universe'
    url = url
        .replace(/^universe/, 'Universe')
        .replace(/\/\//g, '/')
        .replace(/\:/g, '')
        //.replace(/universe/g,'∞')
    return url
}

function updateContextBreadcrumbs(url) {
    console.log('UI | Updating breadcrumbs')
    if (!url) return console.error('UI | No URL provided')
    if (typeof url !== 'string') return console.error('UI | URL is not a string')

    url = sanitizeContextUrl(url)
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

function updateTabCounter(tabs, containerID) {
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

function updateBrowserToCanvasTabList(tabs, containerID = 'browser-to-canvas-tab-list') {
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
        tabItem.style.display = "flex"; // Set display to flex for alignment
        tabItem.style.justifyContent = "space-between"; // Space between elements

        // Create an anchor tag for the tab
        const tabItemLink = document.createElement("a");
        tabItemLink.href = tab.url;
        tabItemLink.className = "tab-title truncate black-text";
        tabItemLink.style.textDecoration = "none"; // Remove underline from links
        tabItemLink.style.flexGrow = "1"; // Allow the link to grow and fill space
        tabItemLink.onclick = function(event) {
            event.preventDefault();
            console.log('UI | Tab clicked: ', tab.url);
        };

        // Create an image element for the favicon
        const favicon = document.createElement("img");
        favicon.src = tab.favIconUrl
        favicon.style.width = '16px';
        favicon.style.height = '16px';
        favicon.style.marginRight = '8px';

        // Append favicon and text to the link
        tabItemLink.appendChild(favicon);
        tabItemLink.appendChild(document.createTextNode(tab.title));

        // Create a delete (trash) icon
        const closeIcon = document.createElement("i");
        closeIcon.className = 'material-icons';
        closeIcon.textContent = 'close'; // The text 'delete' represents the trash icon
        closeIcon.style.cursor = 'pointer'; // Change cursor to indicate it's clickable
        closeIcon.title = 'Close tab';
        closeIcon.onclick = function(event) {
            event.preventDefault(); // Prevent the link from navigating
            // Handle the trash icon click event
            // Example: console.log('Trash icon clicked for tab:', tab);
        };

        // Append the link and trash icon to the list item
        tabItem.appendChild(tabItemLink);
        tabItem.appendChild(closeIcon);
        tabListContainer.appendChild(tabItem);
    });
}


function updateCanvasToBrowserTabList(tabs, containerID = 'canvas-to-browser-tab-list') {
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
        tabItem.style.display = "flex"; // Set display to flex for alignment
        tabItem.style.justifyContent = "space-between"; // Space between elements

        // Create an anchor tag for the tab
        const tabItemLink = document.createElement("a");
        tabItemLink.href = tab.url;
        tabItemLink.className = "tab-title truncate black-text";
        tabItemLink.style.textDecoration = "none"; // Remove underline from links
        tabItemLink.style.flexGrow = "1"; // Allow the link to grow and fill space

        // Create an image element for the favicon
        const favicon = document.createElement("img");
        favicon.src = tab.favIconUrl
        favicon.style.width = '16px';
        favicon.style.height = '16px';
        favicon.style.marginRight = '8px';

        // Append favicon and text to the link
        tabItemLink.appendChild(favicon);
        tabItemLink.appendChild(document.createTextNode(tab.title));

        // Create a delete (trash) icon
        const trashIcon = document.createElement("i");
        trashIcon.className = 'material-icons';
        trashIcon.textContent = 'delete'; // The text 'delete' represents the trash icon
        trashIcon.style.cursor = 'pointer'; // Change cursor to indicate it's clickable
        trashIcon.title = 'Remove tab from Canvas (current context layers only)'; // Tooltip text
        trashIcon.onclick = function(event) {
            event.preventDefault(); // Prevent the link from navigating
            // Handle the trash icon click event
            // Example: console.log('Trash icon clicked for tab:', tab);
        };

        // Append the link and trash icon to the list item
        tabItem.appendChild(tabItemLink);
        tabItem.appendChild(trashIcon);
        tabListContainer.appendChild(tabItem);
    });
}
