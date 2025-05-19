/**
 * Canvas Browser Extension Configuration Initialization
 *
 * This module provides a clean way to initialize the configuration
 * system for the browser extension.
 */

import configStore from './general/ConfigStore';
import { browser } from './general/utils';
import { RUNTIME_MESSAGES } from './general/constants';

// Track background sync state
let bgSyncRequested = false;
let bgSyncRetryTimer: NodeJS.Timeout | null = null;
let lastSyncTime = 0;
const SYNC_THROTTLE_MS = 2000; // Minimum time between sync attempts

/**
 * Detect if the current context is a service worker
 */
function isServiceWorkerContext(): boolean {
  return typeof self !== 'undefined' &&
         typeof window === 'undefined' &&
         typeof self.clients !== 'undefined';
}

/**
 * Detect if the current context is a background page
 * Only works after DOM is ready in a non-service worker context
 */
function isBackgroundPageContext(): boolean {
  try {
    return typeof browser.extension?.getBackgroundPage === 'function' &&
           browser.extension.getBackgroundPage() === window;
  } catch (e) {
    // In service workers or other contexts, this might throw
    return false;
  }
}

/**
 * Initialize the configuration system
 *
 * This function loads the configuration, sets up listeners, and
 * ensures the background script has the latest configuration.
 */
export async function initializeConfig(): Promise<void> {
  try {
    console.log('Initializing Canvas extension configuration...');

    // Initialize the config store
    await configStore.init();
    console.log('Configuration loaded successfully');

    // Determine our context
    const isSW = isServiceWorkerContext();
    const isBackground = isSW || isBackgroundPageContext();

    console.log(`Initializing config in ${isSW ? 'service worker' : (isBackground ? 'background page' : 'foreground')} context`);

    if (!isBackground) {
      // Only sync to background if we're not the background script
      await syncConfigToBackground();

      // Set up a listener for config changes to sync them to the background
      configStore.on('change', async (changeEvent) => {
        // Only sync changes originating locally (not from storage sync or background)
        if (changeEvent.source === 'local') {
          await syncConfigToBackground();
        }
      });

      // Set up a listener for background responses
      browser.runtime.onMessage.addListener((message) => {
        if (message?.type === RUNTIME_MESSAGES.config_get && message?.payload) {
          // Background is responding with its config
          // If we requested a sync, update our sync state
          if (bgSyncRequested) {
            bgSyncRequested = false;
            if (bgSyncRetryTimer) {
              clearTimeout(bgSyncRetryTimer);
              bgSyncRetryTimer = null;
            }
            console.log('Configuration sync with background confirmed');
          }
        }
      });
    }

    return Promise.resolve();
  } catch (error) {
    console.error('Failed to initialize configuration:', error);
    return Promise.reject(error);
  }
}

/**
 * Synchronize the current configuration to the background script
 * with proper error handling and retry logic
 */
async function syncConfigToBackground(): Promise<void> {
  // Throttle frequent sync requests
  const now = Date.now();
  if (now - lastSyncTime < SYNC_THROTTLE_MS) {
    console.log('Configuration sync throttled - too many requests');
    return;
  }

  lastSyncTime = now;

  try {
    // Check if a sync is already in progress
    if (bgSyncRequested) {
      console.log('Configuration sync already in progress, skipping duplicate request');
      return;
    }

    const config = configStore.getAll();
    bgSyncRequested = true;

    // Set a timeout to retry if we don't get confirmation
    if (bgSyncRetryTimer) {
      clearTimeout(bgSyncRetryTimer);
    }

    bgSyncRetryTimer = setTimeout(() => {
      if (bgSyncRequested) {
        console.log('Configuration sync timed out, will retry on next change');
        bgSyncRequested = false;
        bgSyncRetryTimer = null;
      }
    }, 5000);

    // First check if the background page is available
    if (!browser.runtime) {
      throw new Error('Browser runtime not available for sending messages');
    }

    // Send the config to the background script
    await browser.runtime.sendMessage({
      action: RUNTIME_MESSAGES.config_set,
      value: config
    });

    console.log('Configuration sync message sent to background');
  } catch (error) {
    // Reset sync state on error
    bgSyncRequested = false;
    if (bgSyncRetryTimer) {
      clearTimeout(bgSyncRetryTimer);
      bgSyncRetryTimer = null;
    }

    // Don't show error for expected cases like when popup is closed
    const isConnectionError = error &&
      (error.message?.includes('Could not establish connection') ||
       error.message?.includes('Receiving end does not exist'));

    if (!isConnectionError) {
      console.error('Failed to sync configuration to background:', error);
    } else {
      console.log('Background page not available for config sync (normal if popup closed)');
    }
  }
}

/**
 * Reload configuration from background
 */
export async function refreshConfigFromBackground(): Promise<void> {
  try {
    const response = await browser.runtime.sendMessage({
      action: RUNTIME_MESSAGES.config_get
    });

    if (response && response.payload) {
      await configStore.update(response.payload, { silent: true, source: 'background' });
      console.log('Configuration refreshed from background');
    }
  } catch (error) {
    // Don't show error for expected cases
    const isConnectionError = error &&
      (error.message?.includes('Could not establish connection') ||
       error.message?.includes('Receiving end does not exist'));

    if (!isConnectionError) {
      console.error('Failed to refresh config from background:', error);
    }
  }
}

// Default export the initialization function
export default initializeConfig;
