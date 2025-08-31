// Storage utility module for Canvas Extension
// Handles all storage operations using cross-browser storage API

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

export class StorageManager {
  constructor() {
    this.STORAGE_KEYS = {
      CONNECTION_SETTINGS: 'connectionSettings',
      SYNC_SETTINGS: 'syncSettings',
      CURRENT_CONTEXT: 'currentContext',
      TAB_SYNC_STATE: 'tabSyncState',
      BROWSER_IDENTITY: 'browserIdentity'
    };

    this.DEFAULT_SETTINGS = {
      connectionSettings: {
        serverUrl: 'https://my.cnvs.ai',
        apiBasePath: '/rest/v2',
        apiToken: '',
        connected: false
      },
      syncSettings: {
        openTabsAddedToCanvas: false,
        closeTabsRemovedFromCanvas: false,
        sendNewTabsToCanvas: false,
        removeClosedTabsFromCanvas: false
      },
      currentContext: null,
      tabSyncState: {},
      browserIdentity: ''
    };
  }

  // Generic storage operations
  async get(key) {
    try {
      const result = await browserAPI.storage.local.get(key);
      const value = result[key];

      // Return actual value if it exists, otherwise return default
      if (value !== undefined) {
        return value;
      }

      // Return default setting for this key
      return this.DEFAULT_SETTINGS[key] || null;
    } catch (error) {
      console.error('Storage get error:', error);
      return this.DEFAULT_SETTINGS[key] || null;
    }
  }

  async set(key, value) {
    try {
      await browserAPI.storage.local.set({ [key]: value });
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  }

  async remove(key) {
    try {
      await browserAPI.storage.local.remove(key);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  }

  async clear() {
    try {
      await browserAPI.storage.local.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }

  // Connection settings
  async getConnectionSettings() {
    console.log('StorageManager: Getting connection settings with key:', this.STORAGE_KEYS.CONNECTION_SETTINGS);
    const settings = await this.get(this.STORAGE_KEYS.CONNECTION_SETTINGS);
    console.log('StorageManager: Retrieved connection settings:', settings);
    return settings;
  }

  async setConnectionSettings(settings) {
    console.log('StorageManager: Setting connection settings:', settings);
    const currentSettings = await this.getConnectionSettings();
    console.log('StorageManager: Current settings before merge:', currentSettings);
    const updatedSettings = { ...currentSettings, ...settings };
    console.log('StorageManager: Updated settings after merge:', updatedSettings);

    const result = await this.set(this.STORAGE_KEYS.CONNECTION_SETTINGS, updatedSettings);
    console.log('StorageManager: Set result:', result);

    // Verify by reading back
    const verifySettings = await this.getConnectionSettings();
    console.log('StorageManager: Verified settings after save:', verifySettings);

    return result;
  }

  async isConnected() {
    const settings = await this.getConnectionSettings();
    return settings.connected || false;
  }

  async setConnected(connected) {
    return await this.setConnectionSettings({ connected });
  }

  // Sync settings
  async getSyncSettings() {
    return await this.get(this.STORAGE_KEYS.SYNC_SETTINGS);
  }

  async setSyncSettings(settings) {
    const currentSettings = await this.getSyncSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    return await this.set(this.STORAGE_KEYS.SYNC_SETTINGS, updatedSettings);
  }

  // Current context
  async getCurrentContext() {
    return await this.get(this.STORAGE_KEYS.CURRENT_CONTEXT);
  }

  async setCurrentContext(context) {
    return await this.set(this.STORAGE_KEYS.CURRENT_CONTEXT, context);
  }

  async clearCurrentContext() {
    return await this.remove(this.STORAGE_KEYS.CURRENT_CONTEXT);
  }

  // Browser identity
  async getBrowserIdentity() {
    return await this.get(this.STORAGE_KEYS.BROWSER_IDENTITY);
  }

  async setBrowserIdentity(identity) {
    return await this.set(this.STORAGE_KEYS.BROWSER_IDENTITY, identity);
  }

  // Tab sync state tracking
  async getTabSyncState() {
    return await this.get(this.STORAGE_KEYS.TAB_SYNC_STATE);
  }

  async setTabSyncState(state) {
    return await this.set(this.STORAGE_KEYS.TAB_SYNC_STATE, state);
  }

  async updateTabSyncState(tabId, syncData) {
    const currentState = await this.getTabSyncState();
    currentState[tabId] = syncData;
    return await this.setTabSyncState(currentState);
  }

  async removeTabFromSyncState(tabId) {
    const currentState = await this.getTabSyncState();
    delete currentState[tabId];
    return await this.setTabSyncState(currentState);
  }

  // Utility methods
  async getAllSettings() {
    try {
      const result = await browserAPI.storage.local.get(null);
      return {
        ...this.DEFAULT_SETTINGS,
        ...result
      };
    } catch (error) {
      console.error('Failed to get all settings:', error);
      return this.DEFAULT_SETTINGS;
    }
  }

  async resetToDefaults() {
    try {
      await browserAPI.storage.local.clear();
      await browserAPI.storage.local.set(this.DEFAULT_SETTINGS);
      return true;
    } catch (error) {
      console.error('Failed to reset to defaults:', error);
      return false;
    }
  }

  // Generate browser identity if not set
  async generateBrowserIdentity() {
    let identity = await this.getBrowserIdentity();

    if (!identity) {
      // Detect browser type
      const userAgent = navigator.userAgent;
      let browserType = 'unknown';

      if (userAgent.includes('Chrome')) {
        browserType = 'chrome';
      } else if (userAgent.includes('Firefox')) {
        browserType = 'firefox';
      } else if (userAgent.includes('Edge')) {
        browserType = 'edge';
      } else if (userAgent.includes('Safari')) {
        browserType = 'safari';
      }

      // Generate random suffix
      const suffix = Math.random().toString(36).substring(2, 8);
      identity = `${browserType}@${suffix}`;

      await this.setBrowserIdentity(identity);
    }

    return identity;
  }
}

// Create singleton instance
export const storageManager = new StorageManager();
export default storageManager;
