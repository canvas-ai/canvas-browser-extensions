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

function canvasFetchTabsForContext(cb) {
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
    if (!tabArray || !tabArray.length) return false;
    tabArray = tabArray.map(tab => formatTabProperties(tab));
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

function formatTabProperties(tab) {
    return {
        ...TabDocumentSchema,
        type: 'data/abstraction/tab',
        data: tab
    }
}
