import { Dispatch } from 'redux';
import configStore, { ConfigData } from '@/general/ConfigStore';
import { ConfigActionTypes, SET_CONFIG } from './configActionTypes';

// Action creator for setting config
export const setConfig = (config: Partial<ConfigData>): ConfigActionTypes => ({
  type: SET_CONFIG,
  payload: config,
});

// Singleton reference to prevent multiple initialization
let initializedConfigListener = false;

/**
 * Thunk action that loads initial config state from the ConfigStore
 * and sets up listeners for future changes
 */
export const loadInitialConfigState = () => async (dispatch: Dispatch<ConfigActionTypes>) => {
  try {
    // Initialize the config store if needed
    await configStore.init();

    // Get the configuration
    const conf = configStore.getAll();

    // Dispatch the action to update Redux state
    dispatch(setConfig(conf));

    // Only set up event listeners once
    if (!initializedConfigListener) {
      // Listen for config changes and update Redux accordingly
      // Remove any existing listeners first to avoid duplicates
      configStore.removeAllListeners('change');

      configStore.on('change', (changeEvent) => {
        // Avoid loops by only updating Redux if change came from outside Redux
        if (changeEvent.source !== 'local') {
          if (changeEvent.newValues) {
            dispatch(setConfig(changeEvent.newValues));
          } else if (changeEvent.key && changeEvent.value) {
            dispatch(setConfig({ [changeEvent.key]: changeEvent.value }));
          }
        }
      });

      initializedConfigListener = true;
      console.log('Redux config state initialized from ConfigStore with event listeners');
    } else {
      console.log('Redux config state initialized from ConfigStore (listeners already active)');
    }
  } catch (error) {
    console.error('Error loading config state from ConfigStore:', error);

    // Try to continue with a default configuration
    dispatch(setConfig(configStore.getAll()));
  }
};

/**
 * Thunk action to update a specific config value
 */
export const updateConfigValue = (key: keyof ConfigData, value: any) => async (dispatch: Dispatch<ConfigActionTypes>) => {
  try {
    // Update the config store
    await configStore.set(key, value);

    // Dispatch will happen via the change listener,
    // so we don't need to dispatch here
  } catch (error) {
    console.error(`Error updating config ${key}:`, error);
  }
};

/**
 * Thunk action to update multiple config values
 */
export const updateConfig = (updates: Partial<ConfigData>) => async (dispatch: Dispatch<ConfigActionTypes>) => {
  try {
    // Update the config store
    await configStore.update(updates);

    // Dispatch will happen via the change listener,
    // so we don't need to dispatch here
  } catch (error) {
    console.error('Error updating config:', error);
  }
};
