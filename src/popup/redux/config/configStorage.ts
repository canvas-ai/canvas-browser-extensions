import { browser } from '@/general/utils';
import config, { DEFAULT_CONFIG } from '@/general/config';

// Storage utility functions for config
export const saveConfig = async (configData: IConfigProps): Promise<void> => {
  try {
    await Promise.all([
      browser.storage.local.set({ sync: configData.sync }),
      browser.storage.local.set({ transport: configData.transport }),
      browser.storage.local.set({ session: configData.session }),
      browser.storage.local.set({ browserIdentity: configData.browserIdentity })
    ]);
    
    // Also update the global config object
    await config.setMultiple(configData);
  } catch (error) {
    console.error('Error saving config to storage:', error);
    throw error;
  }
};

export const getConfig = async (): Promise<IConfigProps> => {
  try {
    const result = await browser.storage.local.get(['sync', 'transport', 'session', 'browserIdentity']);
    
    return {
      sync: result.sync || DEFAULT_CONFIG.sync,
      transport: result.transport || DEFAULT_CONFIG.transport,
      session: result.session || DEFAULT_CONFIG.session,
      browserIdentity: result.browserIdentity || DEFAULT_CONFIG.browserIdentity
    };
  } catch (error) {
    console.error('Error retrieving config from storage:', error);
    return DEFAULT_CONFIG;
  }
};

export const saveConfigSync = async (syncData: IConfigProps['sync']): Promise<void> => {
  try {
    await browser.storage.local.set({ sync: syncData });
    await config.set('sync', syncData);
  } catch (error) {
    console.error('Error saving sync config to storage:', error);
    throw error;
  }
};

export const getConfigSync = async (): Promise<IConfigProps['sync']> => {
  try {
    const result = await browser.storage.local.get(['sync']);
    return result.sync || DEFAULT_CONFIG.sync;
  } catch (error) {
    console.error('Error retrieving sync config from storage:', error);
    return DEFAULT_CONFIG.sync;
  }
};

export const saveConfigTransport = async (transportData: IConfigProps['transport']): Promise<void> => {
  try {
    await browser.storage.local.set({ transport: transportData });
    await config.set('transport', transportData);
  } catch (error) {
    console.error('Error saving transport config to storage:', error);
    throw error;
  }
};

export const getConfigTransport = async (): Promise<IConfigProps['transport']> => {
  try {
    const result = await browser.storage.local.get(['transport']);
    return result.transport || DEFAULT_CONFIG.transport;
  } catch (error) {
    console.error('Error retrieving transport config from storage:', error);
    return DEFAULT_CONFIG.transport;
  }
};

export const saveConfigSession = async (sessionData: IConfigProps['session']): Promise<void> => {
  try {
    await browser.storage.local.set({ session: sessionData });
    await config.set('session', sessionData);
  } catch (error) {
    console.error('Error saving session config to storage:', error);
    throw error;
  }
};

export const getConfigSession = async (): Promise<IConfigProps['session']> => {
  try {
    const result = await browser.storage.local.get(['session']);
    return result.session || DEFAULT_CONFIG.session;
  } catch (error) {
    console.error('Error retrieving session config from storage:', error);
    return DEFAULT_CONFIG.session;
  }
};

export const saveConfigBrowserIdentity = async (browserIdentityData: IConfigProps['browserIdentity']): Promise<void> => {
  try {
    await browser.storage.local.set({ browserIdentity: browserIdentityData });
    await config.set('browserIdentity', browserIdentityData);
  } catch (error) {
    console.error('Error saving browser identity config to storage:', error);
    throw error;
  }
};

export const getConfigBrowserIdentity = async (): Promise<IConfigProps['browserIdentity']> => {
  try {
    const result = await browser.storage.local.get(['browserIdentity']);
    return result.browserIdentity || DEFAULT_CONFIG.browserIdentity;
  } catch (error) {
    console.error('Error retrieving browser identity config from storage:', error);
    return DEFAULT_CONFIG.browserIdentity;
  }
};

// Initialize config in storage if not present
export const initializeConfigInStorage = async (): Promise<void> => {
  try {
    await config.load();
    const currentConfig = config.allProps();
    await saveConfig(currentConfig);
  } catch (error) {
    console.error('Error initializing config in storage:', error);
    // Fallback to default config
    await saveConfig(DEFAULT_CONFIG);
  }
}; 