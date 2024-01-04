console.log('UI | Initializing Canvas Browser Extension menu');


/**
 * Runtime variables
 */

let config = {};
let context = {};
let isConnected = false;

let canvasToBrowserTabsDelta = {};
let browserToCanvasTabsDelta = {};
let counts = {};


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

        // Update counters
        document.getElementById('browser-tab-delta-count').textContent = browserToCanvasTabsDelta.length;
        document.getElementById('canvas-tab-delta-count').textContent = canvasToBrowserTabsDelta.length;

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

        // Update context variable
        context.url = url

        // Update UI
        updateUI();
    }
});

function updateUI() {
    console.log('UI | Updating UI')
    Promise.all([
        fetchVariable({ action: 'index:get:deltaBrowserToCanvas' }),
        fetchVariable({ action: 'index:get:deltaCanvasToBrowser' })
    ]).then((values) => {
        // Update tab lists
        browserToCanvasTabsDelta = values[0];
        canvasToBrowserTabsDelta = values[1];
        updateBrowserToCanvasTabList(browserToCanvasTabsDelta);
        updateCanvasToBrowserTabList(canvasToBrowserTabsDelta);
        // Update counters
        document.getElementById('browser-tab-delta-count').textContent = browserToCanvasTabsDelta.length;
        document.getElementById('canvas-tab-delta-count').textContent = canvasToBrowserTabsDelta.length;
    }).catch(error => {
        console.error('UI | Error updating UI:', error);       
    });;
}


/**
 * UI Controls
 */

let syncTabsToCanvasButton = document.getElementById('sync-all-tabs');
syncTabsToCanvasButton.addEventListener('click', () => {
    console.log('UI | Syncing all tabs to canvas');
    browser.runtime.sendMessage({ action: 'canvas:tabs:insert' }).then((res) => {
        console.log('UI | Res: ' + res)
        updateUI().then(() => {
            console.log('UI | UI updated')
        });
    }).catch((error) => {
        console.error('UI | Error syncing tabs to canvas:', error);
    });
});

let openTabsFromCanvasButton = document.getElementById('open-all-tabs');
openTabsFromCanvasButton.addEventListener('click', () => {
    console.log('UI | Opening all tabs from canvas');
    browser.runtime.sendMessage({ action: 'canvas:tabs:openInBrowser' }).then((res) => {
        console.log(res)
        browser.runtime.sendMessage({ action: 'index:updateBrowserTabs' });
        updateUI();
    }).catch((error) => {
        console.error('UI | Error opening tabs from canvas:', error);
    });
});


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
            event.preventDefault();
            console.log('UI | Close icon clicked: ', tab.url);
            browser.tabs.remove(tab.id);
            
            // Remove the tab from the list
            tabItem.remove();

            // If count of tabListContainer is 0, show a message
            if (tabListContainer.childElementCount === 0) {
                const emptyMessage = document.createElement("li");
                emptyMessage.className = "collection-item";
                emptyMessage.textContent = 'No browser tabs to sync';
                tabListContainer.appendChild(emptyMessage);
            }
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

        // Create a remove from context icon
        const removeIcon = document.createElement("i");
        removeIcon.className = 'material-icons';
        removeIcon.textContent = 'delete';
        removeIcon.style.cursor = 'pointer';
        removeIcon.title = 'Remove tab from the current Canvas context';
        removeIcon.onclick = function(event) {
            event.preventDefault();
            console.log('UI | Removing tab from Canvas context: ', tab.url);
            browser.runtime.sendMessage({ action: 'context:tabs:remove', id: tab.id });
        };


        // Create a delete (trash) icon
        const deleteIcon= document.createElement("i");
        deleteIcon.className = 'material-icons';
        deleteIcon.textContent = 'delete_forever';
        deleteIcon.style.cursor = 'pointer';
        deleteIcon.style.color = 'red';
        deleteIcon.title = 'Delete tab from Canvas (removes the document from Canvas DB)';
        deleteIcon.onclick = function(event) {
            event.preventDefault();
            console.log('UI | Deleting tab from Canvas DB: ', tab.url);
            browser.runtime.sendMessage({ action: 'canvas:tabs:remove', id: tab.id });
        };

        // Append the link and trash icon to the list item
        tabItem.appendChild(tabItemLink);
        tabItem.appendChild(removeIcon);
        tabItem.appendChild(deleteIcon);

        tabListContainer.appendChild(tabItem);
    });
}
