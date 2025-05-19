import { browser } from "./utils";
import { EventEmitter } from 'events';
import { DEFAULT_SESSION } from "./constants";

/**
 * ConfigStore - A simplified, focused browser extension configuration manager
 */

// Type definitions
export type TabBehavior = "Close" | "Save and Close" | "Keep";
export type Protocol = "http" | "https";

export interface ConfigData {
  sync: {
    tabBehaviorOnContextChange: TabBehavior;
    autoOpenCanvasTabs: boolean;
  };
  browserIdentity: {
    syncOnlyTaggedTabs: boolean;
    browserTag: string;
  };
  session: {
    id: string;
    baseUrl: string;
  };
  transport: {
    protocol: Protocol;
    host: string;
    port: number | "";
    token: string;
    pinToContext: string;
    isApiToken: boolean;
    contextId: string;
  };
  version: number;
}

export interface UpdateOptions {
  silent?: boolean;
  source?: 'local' | 'sync' | 'background';
}

// Default configuration values
export const DEFAULT_CONFIG: ConfigData = {
  sync: {
    tabBehaviorOnContextChange: "Keep",
    autoOpenCanvasTabs: false
  },
  browserIdentity: {
    syncOnlyTaggedTabs: false,
    browserTag: ""
  },
  session: {
    id: "",
    baseUrl: ""
  },
  transport: {
    protocol: 'http',
    host: '127.0.0.1',
    port: 8001,
    token: 'canvas-server-token',
    pinToContext: '/',
    isApiToken: false,
    contextId: 'default'
  },
  version: 1
};

// Single key for storing the entire config to minimize operations
const CONFIG_STORAGE_KEY = 'canvas_config';

/**
 * ConfigStore class for managing extension configuration
 * - Handles local browser storage
 * - Provides event-based notification of changes
 * - Validates configuration values
 * - Migrates from older config formats
 */
class ConfigStore extends EventEmitter {
  private config: ConfigData;
  private store: browser.storage.StorageArea;
  private initialized: boolean = false;
  private pendingWrite: NodeJS.Timeout | null = null;
  private writeDebounceMs = 250;
  private isLoading = false;
  private storageChangedByUs = false;

  constructor() {
    super();
    this.setMaxListeners(25);
    this.config = structuredClone(DEFAULT_CONFIG);
    this.store = browser.storage.local;
  }

  /**
   * Initialize the config store
   */
  async init(): Promise<ConfigData> {
    if (this.initialized) {
      console.log('ConfigStore: Already initialized, returning current config');
      return this.config;
    }

    try {
      // Load configuration
      await this.load();

      // Setup storage change listener
      browser.storage.onChanged.addListener(this.handleStorageChanges);

      this.initialized = true;
      this.emit('ready', this.getAll());
      return this.config;
    } catch (error) {
      console.error('ConfigStore: Init failed', error);
      throw error;
    }
  }

  /**
   * Load configuration from storage
   */
  async load(): Promise<ConfigData> {
    this.isLoading = true;
    console.log('ConfigStore: Loading configuration');

    try {
      // Get config using single key approach
      const result = await this.getFromStorage();

      if (!result) {
        console.log('ConfigStore: No stored configuration found, using defaults');
      } else {
        console.log('ConfigStore: Loaded stored configuration');

        // Deep merge with defaults to ensure we have all required properties
        this.config = this.deepMerge(structuredClone(DEFAULT_CONFIG), result);

        // Ensure valid enum values for tabBehaviorOnContextChange
        if (!["Close", "Save and Close", "Keep"].includes(this.config.sync.tabBehaviorOnContextChange)) {
          this.config.sync.tabBehaviorOnContextChange = DEFAULT_CONFIG.sync.tabBehaviorOnContextChange;
        }

        // Ensure valid enum values for protocol
        if (!["http", "https"].includes(this.config.transport.protocol)) {
          this.config.transport.protocol = DEFAULT_CONFIG.transport.protocol;
        }
      }

      // Clean up legacy settings if they exist
      await this.cleanupLegacySettings();

      // Save all changes to ensure consistent state
      await this.saveToStorage(this.config);

      this.isLoading = false;
      this.emit('loaded', this.getAll());
      return this.config;
    } catch (error) {
      this.isLoading = false;
      console.error('ConfigStore: Error loading configuration:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get all configuration values
   */
  getAll(): ConfigData {
    return structuredClone(this.config);
  }

  /**
   * Get a specific configuration value
   */
  get<K extends keyof ConfigData>(key: K): ConfigData[K] {
    return structuredClone(this.config[key]);
  }

  /**
   * Get a nested configuration value using a dot-notation path
   */
  getByPath(path: string): any {
    const parts = path.split('.');
    let current: any = this.config;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }

    return structuredClone(current);
  }

  /**
   * Set a specific configuration value
   */
  async set<K extends keyof ConfigData>(key: K, value: ConfigData[K], options: UpdateOptions = {}): Promise<void> {
    if (JSON.stringify(this.config[key]) === JSON.stringify(value)) {
      return; // No change
    }

    // Update the local config
    this.config[key] = structuredClone(value as any);

    // Save to storage (debounced)
    await this.debouncedSave();

    // Emit change event if not silent
    if (!options.silent) {
      this.emit('change', {
        key,
        value: structuredClone(value),
        source: options.source || 'local'
      });
    }
  }

  /**
   * Set a nested configuration value using a dot-notation path
   */
  async setByPath(path: string, value: any, options: UpdateOptions = {}): Promise<void> {
    const parts = path.split('.');
    const key = parts[0] as keyof ConfigData;

    if (parts.length === 1) {
      // Direct property of config
      return this.set(key, value, options);
    }

    // Handle nested properties
    const objCopy = structuredClone(this.config[key]);
    let current: any = objCopy;

    // Navigate to the nested property, creating objects as needed
    for (let i = 1; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current[part] === undefined) {
        current[part] = {};
      }
      current = current[part];
    }

    // Set the value
    const lastPart = parts[parts.length - 1];
    if (JSON.stringify(current[lastPart]) === JSON.stringify(value)) {
      return; // No change
    }

    current[lastPart] = structuredClone(value);
    return this.set(key, objCopy, options);
  }

  /**
   * Update multiple configuration values at once
   */
  async update(newValues: Partial<ConfigData>, options: UpdateOptions = {}): Promise<void> {
    console.log('ConfigStore: Starting update with values:', JSON.stringify(newValues));

    let hasChanges = false;
    const updatedKeys: Array<keyof ConfigData> = [];

    // Check if there are actual changes
    for (const key of Object.keys(newValues) as Array<keyof ConfigData>) {
      console.log(`ConfigStore: Checking key "${key}" for changes`);
      console.log(`  Current: ${JSON.stringify(this.config[key])}`);
      console.log(`  New: ${JSON.stringify(newValues[key])}`);

      if (JSON.stringify(this.config[key]) !== JSON.stringify(newValues[key])) {
        hasChanges = true;
        updatedKeys.push(key);
        this.config[key] = structuredClone(newValues[key] as any);
        console.log(`ConfigStore: Updated key "${key}" with new value`);
      } else {
        console.log(`ConfigStore: No change detected for key "${key}"`);
      }
    }

    if (!hasChanges) {
      console.log('ConfigStore: No changes to apply, skipping update');
      return; // No changes to apply
    }

    console.log(`ConfigStore: Changes detected for keys: ${updatedKeys.join(', ')}, saving to storage`);

    // Force immediate save without debouncing for this critical operation
    try {
      await this.saveToStorage(this.config);
      console.log('ConfigStore: Storage update successful');
    } catch (error) {
      console.error('ConfigStore: Error saving configuration:', error);
      // Don't throw, just log the error and continue
      // This way the UI won't freeze if there's a storage issue
    }

    // Emit change event if not silent
    if (!options.silent) {
      this.emit('change', {
        newValues: structuredClone(newValues),
        updatedKeys,
        source: options.source || 'local'
      });
      console.log('ConfigStore: Change event emitted');
    }
  }

  /**
   * Reset configuration to defaults
   */
  async reset(options: UpdateOptions = {}): Promise<void> {
    this.config = structuredClone(DEFAULT_CONFIG);
    await this.saveToStorage(this.config);

    if (!options.silent) {
      this.emit('reset', { source: options.source || 'local' });
      this.emit('change', {
        newValues: structuredClone(this.config),
        source: options.source || 'local'
      });
    }
  }

  /**
   * Clean up legacy configuration settings
   */
  private async cleanupLegacySettings(): Promise<void> {
    try {
      // List of known legacy keys
      const legacyKeys = [
        'contextId',
        'contextUrl',
        'host',
        'port',
        'protocol',
        'token',
        'connectionSettings' // Old formatted object
      ];

      // Get all keys in storage
      const allStorageData = await new Promise<any>((resolve) => {
        this.store.get(null, (result) => {
          resolve(result || {});
        });
      });

      // Check if we have legacy keys to migrate
      const foundLegacyKeys = legacyKeys.filter(key => key in allStorageData);

      if (foundLegacyKeys.length === 0) {
        return; // No legacy keys found
      }

      console.log('ConfigStore: Found legacy settings to clean up', foundLegacyKeys);

      // Migrate any legacy values (that haven't already been handled by deep merge)
      if ('connectionSettings' in allStorageData && allStorageData.connectionSettings) {
        const connSettings = allStorageData.connectionSettings;
        if (connSettings.host) this.config.transport.host = connSettings.host;
        if (connSettings.port) this.config.transport.port = connSettings.port;
        if (connSettings.protocol) this.config.transport.protocol = connSettings.protocol;
        if (connSettings.token) this.config.transport.token = connSettings.token;
      }

      // Now remove the legacy keys
      await new Promise<void>((resolve) => {
        this.store.remove(foundLegacyKeys, () => {
          console.log('ConfigStore: Legacy settings removed');
          resolve();
        });
      });
    } catch (error) {
      console.error('ConfigStore: Error cleaning up legacy settings', error);
    }
  }

  /**
   * Save all configuration to storage
   */
  private async saveToStorage(config: ConfigData): Promise<void> {
    console.log('ConfigStore: Saving to storage...');

    try {
      // We're about to cause a storage change, mark it as coming from us
      this.storageChangedByUs = true;

      // Use a single storage object with our key to reduce fragmentation
      await new Promise<void>((resolve, reject) => {
        // Create a safety timeout for browser API issues
        const timeoutId = setTimeout(() => {
          console.error('ConfigStore: saveToStorage timed out after 5 seconds');
          this.storageChangedByUs = false;
          resolve(); // Resolve anyway to prevent UI from freezing
        }, 5000);

        try {
          // Actually perform the storage operation
          this.store.set({ [CONFIG_STORAGE_KEY]: config }, () => {
            clearTimeout(timeoutId);

            if (browser.runtime.lastError) {
              console.error('ConfigStore: Error in storage.set:', browser.runtime.lastError);
              this.storageChangedByUs = false;
              reject(browser.runtime.lastError);
            } else {
              console.log('ConfigStore: Successfully saved to storage');
              setTimeout(() => {
                this.storageChangedByUs = false;
              }, 100); // Reset the flag after a short delay
              resolve();
            }
          });
        } catch (err) {
          clearTimeout(timeoutId);
          console.error('ConfigStore: Exception during storage.set:', err);
          this.storageChangedByUs = false;
          reject(err);
        }
      });

      console.log('ConfigStore: Storage operation completed');
    } catch (error) {
      this.storageChangedByUs = false;
      console.error('ConfigStore: Error saving to storage', error);
      // Don't throw - it creates UI issues
      console.warn('ConfigStore: Suppressing storage error to prevent UI freeze');
    }
  }

  /**
   * Handle browser storage changes
   */
  private handleStorageChanges = (changes: {[key: string]: browser.storage.StorageChange}, areaName: string) => {
    // Ignore changes we triggered ourselves
    if (this.storageChangedByUs || this.isLoading) {
      return;
    }

    // Check if our config key changed
    if (changes[CONFIG_STORAGE_KEY] && changes[CONFIG_STORAGE_KEY].newValue) {
      console.log('ConfigStore: External storage change detected for config');

      const newConfig = changes[CONFIG_STORAGE_KEY].newValue;

      // Compare with current config to find what changed
      const changedKeys: Array<keyof ConfigData> = [];
      for (const key of Object.keys(newConfig) as Array<keyof ConfigData>) {
        if (JSON.stringify(this.config[key]) !== JSON.stringify(newConfig[key])) {
          changedKeys.push(key);
          this.config[key] = structuredClone(newConfig[key]);
        }
      }

      if (changedKeys.length > 0) {
        this.emit('change', {
          externalChange: true,
          keys: changedKeys,
          source: 'sync'
        });
      }
    }
  };

  /**
   * Save configuration to storage with debouncing
   */
  private async debouncedSave(): Promise<void> {
    // Cancel any pending write
    if (this.pendingWrite) {
      clearTimeout(this.pendingWrite);
      this.pendingWrite = null;
    }

    // Set a debounced write
    return new Promise((resolve) => {
      this.pendingWrite = setTimeout(async () => {
        try {
          await this.saveToStorage(this.config);
          this.pendingWrite = null;
          resolve();
        } catch (error) {
          console.error('ConfigStore: Error in debounced save', error);
          this.pendingWrite = null;
          resolve(); // Resolve anyway to prevent hanging promises
        }
      }, this.writeDebounceMs);
    });
  }

  /**
   * Get config from storage
   */
  private async getFromStorage(): Promise<ConfigData | null> {
    return new Promise((resolve, reject) => {
      this.store.get(CONFIG_STORAGE_KEY, (result) => {
        if (browser.runtime.lastError) {
          reject(browser.runtime.lastError);
        } else {
          if (result && result[CONFIG_STORAGE_KEY]) {
            resolve(result[CONFIG_STORAGE_KEY] as ConfigData);
          } else {
            resolve(null);
          }
        }
      });
    });
  }

  /**
   * Deep merge two objects
   */
  private deepMerge<T>(target: T, source: Partial<T>): T {
    if (!source) return target;
    if (!target) return source as T;

    const output = { ...target };

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  }

  /**
   * Check if a value is an object (not array, null, etc.)
   */
  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item) && item !== null;
  }
}

// Export singleton
const configStore = new ConfigStore();
export default configStore;
