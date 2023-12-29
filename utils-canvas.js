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
function canvasInsertTab(tab, cb) {}
function canvasUpdateTab(tab, cb) {}
function canvasRemoveTab(id, cb) {}

function canvasFetchContextTabs(cb) {
    // TODO: Rework naming convention, should be context:documents:get
    socket.emit('documents:get', { type: 'data/abstraction/tab'}, (res) => {
        console.log('background.js | Tabs fetched: ', res);
        // TODO: Move to a separate function
        const parsed = res.data.filter(tab => tab !== null).map(tab => tab.data);
        res.data = parsed;
        cb(res);
    });
}

function canvasSaveOpenTabs(cb) {
    browser.tabs.query({}).then((tabs) => {
        let documentArray = tabs.map(tab => formatTabProperties(tab));
        socket.emit('documents:insertDocumentArray', documentArray, (res) => {
            cb(res)
        });
    })
}

/**
 * Functions
 */

function checkCanvasConnection() {
    let intervalId = setInterval(() => {
        if (!isConnected) {
            console.log('background.js | Canvas backend not yet connected');
        } else {
            clearInterval(intervalId);

        }
    }, 1000); // Check every second
}
