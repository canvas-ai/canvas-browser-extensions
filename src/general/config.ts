import { DEFAULT_SESSION } from "./constants";
import { browser } from "./utils";

const store = browser.storage.local;

export const DEFAULT_CONFIG: {
  sync: IConfig["sync"],
  session: IConfig["session"],
  transport: IConfig["transport"],
  browserIdentity: IConfig["browserIdentity"]
} = {
  sync: {
    tabBehaviorOnContextChange: "Keep",
    autoOpenCanvasTabs: false
  },
  browserIdentity: {
    syncOnlyTaggedTabs: false,
    browserTag: ""
  },
  session: DEFAULT_SESSION,
  transport: {
    protocol: 'http',
    host: '127.0.0.1',
    port: 8001,
    token: 'canvas-server-token',
    pinToContext: '/',
    isApiToken: false,
    contextId: 'default'
  }
};

// Define the connection settings type
interface ConnectionSettings {
  transport?: IConfig["transport"];
  isApiToken?: boolean;
}

class Config {
  sync: IConfig["sync"];
  session: IConfig["session"];
  transport: IConfig["transport"];
  browserIdentity: IConfig["browserIdentity"]
  isLoaded: boolean = false;

  constructor() {
    this.sync = DEFAULT_CONFIG.sync;
    this.session = DEFAULT_CONFIG.session;
    this.transport = DEFAULT_CONFIG.transport;
    this.browserIdentity = DEFAULT_CONFIG.browserIdentity;

    this.load();
  }

  async set(key: string, value: any) {
    try {
      console.log(`Config: Setting ${key} to`, value);
      this[key] = value;
      await store.set({ [key]: value });
      return this[key];
    } catch (error) {
      console.error(`Config: Error setting ${key}:`, error);
      return this[key]; // Return current value even on error
    }
  }

  async setMultiple(cfg: IConfigProps) {
    console.log('Config: Setting multiple values:', cfg);
    try {
      // Merge with current config to ensure all properties are set
      const updatedConfig = {
        ...this.allProps(),
        ...cfg
      };

      // Store each property individually to ensure proper setting
      const items = Object.keys(cfg);
      for (const key of items) {
        await this.set(key, cfg[key]);
      }

      // Also save entire config as backup
      await store.set(updatedConfig);

      return true;
    } catch (error) {
      console.error('Config: Error setting multiple values:', error);
      return false;
    }
  }

  get(key: string) {
    return this[key];
  }

  async load() {
    try {
      console.log('Config: Loading settings from storage');

      // First, try to load the connectionSettings from local storage
      // This is what we save from the ConnectionSettingsForm
      const savedConnection = await new Promise<{ connectionSettings?: ConnectionSettings }>(resolve => {
        store.get('connectionSettings', (result) => {
          resolve(result || {});
        });
      });

      // If we have saved connection settings, apply them first
      if (savedConnection.connectionSettings) {
        console.log('Config: Found saved connection settings:', savedConnection.connectionSettings);
        if (savedConnection.connectionSettings.transport) {
          this.transport = {
            ...this.transport,
            ...savedConnection.connectionSettings.transport
          };
        }
      }

      // Then load the main config
      return new Promise<boolean>((resolve) => {
        store.get(['sync', 'transport', 'session', 'browserIdentity'], (cfg: any) => {
          try {
            console.log('Config: Loaded from storage:', cfg);
            Object.keys(cfg).forEach(key => {
              // Deep merge objects instead of replacing them entirely
              if (typeof cfg[key] === 'object' && cfg[key] !== null) {
                this[key] = {
                  ...this[key], // Start with defaults
                  ...cfg[key]   // Override with stored values
                };
              } else {
                this[key] = cfg[key] || this[key] || DEFAULT_CONFIG[key];
              }
            });

            this.isLoaded = true;
            console.log('Config: Successfully loaded configuration');
            resolve(true);
          } catch (error) {
            console.error('Config: Error parsing config from storage:', error);
            this.isLoaded = true; // Mark as loaded even on error
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error('Config: Error loading from storage:', error);
      this.isLoaded = true; // Mark as loaded even on error
      return false;
    }
  }

  allProps() {
    return {
      sync: this.sync,
      session: this.session,
      browserIdentity: this.browserIdentity,
      transport: this.transport
    }
  }
}

const config = new Config();

export default config;
