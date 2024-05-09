/**
 * Canvas backend functions
 */

function saveTabToBackend(tab, cb) {
    let doc = formatTabProperties(tab);
    socket.emit('index:insertDocument', doc, (res) => {
        console.log('Tab inserted: ', res);
        if (cb) cb(res)
    });
}

function loadTabFromBackend(tabID, cb) {
    socket.emit('document:get', tabID, (res) => {
        console.log(`Tab ${tabID} fetched: `, res);
        if (cb) cb(res)
    });
}

async function sendTabToCanvas(tab, tagArray) {
    return new Promise((resolve, reject) => {
        socket.emit('sendTabToCanvas', { tab, tagArray }, (response) => {
            if (response.error) {
                reject(response.error);
            } else {
                resolve(response);
            }
        });
    });
}

async function sendTabsToCanvas(tabArray, tagArray) {
    return new Promise((resolve, reject) => {
        socket.emit('sendTabToCanvas', { tabArray, tagArray }, (response) => {
            if (response.error) {
                reject(response.error);
            } else {
                resolve(response);
            }
        });
    });
}



// Fetch context URL, Tab schema, and stored URLs from the server
function fetchContextUrl() {
    socket.emit('context:get:url', {}, (url) => {
        context.url = url;
        console.log('background.js | Context URL fetched: ', url);
    });
}

function fetchTabSchema() {
    socket.emit('db:schema:get', { type: genFeatureArray(), version: '2' }, function (res) {
        if (!res || res.status === 'error') {
            console.error('background.js | Tab schema not found');
        }
        Tab = res;
        console.log('background.js | Tab schema fetched: ', Tab);
    });
}


function fetchStoredUrls() {
    socket.emit('listDocuments', {
        context: context.url,
        type: genFeatureArray(),
    }, (data) => {
        tabUrls = data;
        console.log('background.js | Stored URLs fetched: ', tabUrls);
    });
}
