/**
 * General functions for interacting with the Canvas backend
 */

function canvasFetchData(resource, callback) {
    if (!resource) {
        console.error('background.js | No resource provided');
        return false;
    }

    if (!callback) {
        console.error('background.js | No callback function provided');
        return false;
    }

    socket.emit(resource, (response) => {
        console.log('background.js | Canvas response:', response);
        callback(response)
    });
}

function canvasInsertData(resource, data, callback) {
    if (!resource) {
        console.error('background.js | No resource provided');
        return false;
    }

    if (!data) {
        console.error('background.js | No data provided');
        return false;
    }

    if (!callback) {
        console.error('background.js | No callback function provided');
        return false;
    }

    socket.emit(resource, data, (response) => {
        console.log('background.js | Canvas response:', response);
        callback(response)
    });

}

/**
 * Functions for interacting with the Canvas backend
 */

function canvasFetchContext(cb) {
    socket.emit('context:get', (res) => {
        console.log('background.js | Context fetched: ', res);
        cb(res)
    });
}

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

function canvasFetchTab(id, cb) {
    socket.emit('documents:get', { type: 'data/abstraction/tab', id: id }, (res) => {
        console.log('background.js | Tab fetched: ', res);
        cb(res)
    });
}

function canvasHasTab(id, cb) {}

function canvasInsertTab(tab, cb) {

}

function canvasUpdateTab(tab, cb) {}

// TODO: Rework to use ID instead of the whole tab object
function canvasRemoveTab(tab, cb) {
    socket.emit('documents:remove', tab, (res) => {
        console.log('background.js | Tab removed: ', res);
        cb(res)
    });
}

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

function canvasInsertTabArray(tabArray, cb) {
    if (!tabArray || !tabArray.length) return false;
    tabArray = tabArray.map(tab => formatTabProperties(tab));
    socket.emit('documents:insertDocumentArray', tabArray, (res) => {
        if (cb) cb(res)
    });
}

function canvasCheckConnection() {
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
        type: 'data/abstraction/tab',
        data: tab
    }
}
