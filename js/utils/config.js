/**
 * Main configuration module
 */

const config = {
    sync: {
        autoRestoreSession: getNestedProp(store.get('sync'), 'autoRestoreSession', true),
        autoSaveSession: getNestedProp(store.get('sync'), 'autoSaveSession', true),
        autoOpenTabs: getNestedProp(store.get('sync'), 'autoOpenTabs', true),
        autoCloseTabs: getNestedProp(store.get('sync'), 'autoCloseTabs', true),
        // autoCloseTabsBehavior:
        // - saveToCurrentContext
        // - saveToNewContext
        // - saveToTrash
        // - saveToUniverse
        // - ignore (leave open, do not sync to Canvas)
        autoCloseTabsBehavior: getNestedProp(store.get('sync'), 'autoCloseTabsBehavior', 'ignore')
    },

    session: {},

    transport: {
        protocol: getNestedProp(store.get('transport'), 'protocol', 'http'),
        host: getNestedProp(store.get('transport'), 'host', '127.0.0.1'),
        port: getNestedProp(store.get('transport'), 'port', 8001)
    },

    set: function (key, value) {
        this[key] = value;
        store.set(key, value);
        return this[key];
    },

    get: function (key) {
        return this[key];
    }
};


/**
 * Functions
 */

function getNestedProp(obj, path, defaultValue) {
    const value = path.split('.').reduce((o, k) => (o || {})[k], obj);
    return value === undefined ? defaultValue : value;
}

