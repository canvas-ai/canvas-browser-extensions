// Browser-compatible storage system for Canvas Extension
// Works with both Chrome and Firefox using storage API directly

// Browser compatibility shim
const browserAPI = (() => {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return chrome;
  }
  if (typeof browser !== 'undefined' && browser.storage) {
    return browser;
  }
  throw new Error('Browser storage API not available');
})();

export class BrowserStorage {
  constructor() {
    this.storage = browserAPI.storage.local;
    this.setupChangeListeners();

    // Storage keys
    this.KEYS = {
      CONNECTION_SETTINGS: 'canvasConnectionSettings',
      CURRENT_CONTEXT: 'canvasCurrentContext',
      CURRENT_WORKSPACE: 'canvasCurrentWorkspace',
      SYNC_MODE: 'canvasSyncMode',
      WORKSPACE_PATH: 'canvasWorkspacePath',
      SYNC_SETTINGS: 'canvasSyncSettings',
      BROWSER_IDENTITY: 'canvasBrowserIdentity',
      PINNED_TABS: 'canvasPinnedTabs',
      CONTEXT_MENU_TAB: 'canvasContextMenuTab'
    };

    // Default values
    this.DEFAULTS = {
      [this.KEYS.CONNECTION_SETTINGS]: {
        serverUrl: 'http://127.0.0.1:8001',
        apiBasePath: '/rest/v2',
        apiToken: '',
        connected: false
      },
      [this.KEYS.SYNC_SETTINGS]: {
        autoSyncNewTabs: false,
        autoOpenNewTabs: false,
        autoCloseRemovedTabs: false,
        syncOnlyThisBrowser: false,
        contextChangeBehavior: 'keep-open-new',
        tabOpeningMaxConcurrent: 3, // Max tabs to open concurrently
        tabOpeningDelayMs: 200 // Delay between batches in milliseconds
      },
      [this.KEYS.SYNC_MODE]: 'explorer', // 'explorer' | 'context'
      [this.KEYS.WORKSPACE_PATH]: '/',
      [this.KEYS.CURRENT_CONTEXT]: null,
      [this.KEYS.CURRENT_WORKSPACE]: null, // { id, name, label, path }
      [this.KEYS.BROWSER_IDENTITY]: '',
      [this.KEYS.PINNED_TABS]: new Set(),
      [this.KEYS.CONTEXT_MENU_TAB]: null
    };
  }

  // Setup storage change listeners
  setupChangeListeners() {
    browserAPI.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        console.log('Storage changed:', changes);

        // Notify other parts of the extension about changes
        if (changes[this.KEYS.CONNECTION_SETTINGS]) {
          console.log('Connection settings changed:', changes[this.KEYS.CONNECTION_SETTINGS].newValue);
        }

        if (changes[this.KEYS.CURRENT_CONTEXT]) {
          console.log('Current context changed:', changes[this.KEYS.CURRENT_CONTEXT].newValue);
        }
      }
    });
  }

  // Generic get method
  async get(key) {
    try {
      console.log('BrowserStorage: Getting key:', key);
      const result = await this.storage.get(key);
      const value = result[key];

      console.log('BrowserStorage: Retrieved value for', key, ':', value);

      // Return actual value if exists, otherwise return default
      if (value !== undefined && value !== null) {
        return value;
      }

      const defaultValue = this.DEFAULTS[key];
      console.log('BrowserStorage: Using default value for', key, ':', defaultValue);
      return defaultValue;
    } catch (error) {
      console.error('BrowserStorage: Error getting', key, ':', error);
      return this.DEFAULTS[key];
    }
  }

  // Generic set method
  async set(key, value) {
    try {
      console.log('BrowserStorage: Setting key:', key, 'to value:', value);
      await this.storage.set({ [key]: value });
      console.log('BrowserStorage: Successfully set', key);
      return true;
    } catch (error) {
      console.error('BrowserStorage: Error setting', key, ':', error);
      return false;
    }
  }

  // Get multiple keys at once
  async getMultiple(keys) {
    try {
      console.log('BrowserStorage: Getting multiple keys:', keys);
      const result = await this.storage.get(keys);

      // Apply defaults for missing keys
      const output = {};
      for (const key of keys) {
        output[key] = result[key] !== undefined ? result[key] : this.DEFAULTS[key];
      }

      console.log('BrowserStorage: Retrieved multiple values:', output);
      return output;
    } catch (error) {
      console.error('BrowserStorage: Error getting multiple keys:', error);
      // Return defaults for all requested keys
      const output = {};
      for (const key of keys) {
        output[key] = this.DEFAULTS[key];
      }
      return output;
    }
  }

  // Connection Settings
  async getConnectionSettings() {
    return await this.get(this.KEYS.CONNECTION_SETTINGS);
  }

  async setConnectionSettings(settings) {
    const current = await this.getConnectionSettings();
    const updated = { ...current, ...settings };
    return await this.set(this.KEYS.CONNECTION_SETTINGS, updated);
  }

  // Current Context
  async getCurrentContext() {
    return await this.get(this.KEYS.CURRENT_CONTEXT);
  }

  async setCurrentContext(context) {
    return await this.set(this.KEYS.CURRENT_CONTEXT, context);
  }

  // Sync Settings
  async getSyncSettings() {
    return await this.get(this.KEYS.SYNC_SETTINGS);
  }

  async setSyncSettings(settings) {
    const current = await this.getSyncSettings();
    const updated = { ...current, ...settings };
    return await this.set(this.KEYS.SYNC_SETTINGS, updated);
  }

  // Browser Identity
  async getBrowserIdentity() {
    let identity = await this.get(this.KEYS.BROWSER_IDENTITY);

    if (!identity) {
      // Generate browser identity if not set
      const userAgent = navigator.userAgent;
      const timestamp = Date.now();

      if (userAgent.includes('Firefox')) {
        identity = `firefox-${timestamp}`;
      } else if (userAgent.includes('Chrome')) {
        identity = `chrome-${timestamp}`;
      } else {
        identity = `browser-${timestamp}`;
      }

      await this.set(this.KEYS.BROWSER_IDENTITY, identity);
      console.log('Generated new browser identity:', identity);
    }

    return identity;
  }

  // Current workspace methods
  async getCurrentWorkspace() {
    return await this.get(this.KEYS.CURRENT_WORKSPACE);
  }

  async setCurrentWorkspace(workspace) {
    return await this.set(this.KEYS.CURRENT_WORKSPACE, workspace);
  }

  // Sync mode methods
  async getSyncMode() {
    return await this.get(this.KEYS.SYNC_MODE);
  }

  async setSyncMode(mode) {
    return await this.set(this.KEYS.SYNC_MODE, mode);
  }

  // Workspace path methods
  async getWorkspacePath() {
    return await this.get(this.KEYS.WORKSPACE_PATH);
  }

  async setWorkspacePath(path) {
    return await this.set(this.KEYS.WORKSPACE_PATH, path);
  }

  // Pinned tabs methods
  async getPinnedTabs() {
    const pinned = await this.get(this.KEYS.PINNED_TABS);
    return pinned instanceof Set ? pinned : new Set(pinned || []);
  }

  async setPinnedTabs(pinnedSet) {
    const pinnedArray = Array.from(pinnedSet);
    return await this.set(this.KEYS.PINNED_TABS, pinnedArray);
  }

  async pinTab(tabId) {
    const pinned = await this.getPinnedTabs();
    pinned.add(tabId);
    await this.setPinnedTabs(pinned);
  }

  async unpinTab(tabId) {
    const pinned = await this.getPinnedTabs();
    if (pinned.has(tabId)) {
      pinned.delete(tabId);
      await this.setPinnedTabs(pinned);
    }
  }

  // Clear all extension data
  async clearAll() {
    try {
      await this.storage.clear();
      console.log('BrowserStorage: Cleared all data');
      return true;
    } catch (error) {
      console.error('BrowserStorage: Error clearing data:', error);
      return false;
    }
  }

  // Check if extension is configured
  async isConfigured() {
    const connectionSettings = await this.getConnectionSettings();
    const currentContext = await this.getCurrentContext();

    return !!(
      connectionSettings.apiToken &&
      connectionSettings.serverUrl &&
      currentContext?.id
    );
  }

  // Context menu tab methods
  async getContextMenuTab() {
    return await this.get(this.KEYS.CONTEXT_MENU_TAB);
  }

  async setContextMenuTab(tab) {
    return await this.set(this.KEYS.CONTEXT_MENU_TAB, tab);
  }

  async clearContextMenuTab() {
    return await this.set(this.KEYS.CONTEXT_MENU_TAB, null);
  }
}

// Create singleton instance
export const browserStorage = new BrowserStorage();
export default browserStorage;
