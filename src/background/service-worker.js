// Canvas Browser Extension Service Worker
// Handles background operations, API communication, and tab synchronization

import { browserStorage } from './modules/browser-storage.js';
import { apiClient } from './modules/api-client.js';
import { webSocketClient } from './modules/websocket-client.js';
import { tabManager } from './modules/tab-manager.js';
import { syncEngine } from './modules/sync-engine.js';
import { contextIntegration } from './modules/context-integration.js';

console.log('🚀 Canvas Extension Service Worker loaded and starting...');
console.log('🚀 Service Worker: Registering tab event listeners...');

// Service worker installation and activation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);

  // Open settings page on first install
  if (details.reason === 'install') {
    await openSettingsPage();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser startup - initializing Canvas Extension');
  await initializeExtension();
});

// Initialize extension on service worker startup
async function initializeExtension() {
  try {
    console.log('Initializing Canvas Extension...');

    // Load connection settings
    const connectionSettings = await browserStorage.getConnectionSettings();
    console.log('Service Worker Init: Loaded connection settings:', connectionSettings);

    // Check if we have actual saved settings vs defaults
    if (connectionSettings && connectionSettings.apiToken) {
      console.log('Service Worker Init: Found saved API token, extension was previously configured');
    } else {
      console.log('Service Worker Init: No API token found, extension needs configuration');
    }

    // Initialize API client if we have settings
    if (connectionSettings.serverUrl && connectionSettings.apiBasePath) {
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken || ''
      );

      // Test connection if we're supposed to be connected
      if (connectionSettings.connected && connectionSettings.apiToken) {
        console.log('Testing saved connection...');
        const testResult = await apiClient.testConnection();
        if (!testResult.success || !testResult.authenticated) {
          console.warn('Saved connection failed, marking as disconnected');
          await browserStorage.setConnectionSettings({ connected: false });
        } else {
          console.log('Saved connection is valid');

          // Initialize WebSocket connection
          await initializeWebSocket();
        }
      }
    }

    // Generate browser identity if not set
    const browserIdentity = await browserStorage.getBrowserIdentity();
    console.log('Browser identity:', browserIdentity);

    console.log('Canvas Extension initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Canvas Extension:', error);
  }
}

// Initialize WebSocket connection
async function initializeWebSocket() {
  try {
    console.log('Initializing WebSocket connection...');

    const connectionSettings = await browserStorage.getConnectionSettings();
    const currentContext = await browserStorage.getCurrentContext();

    if (!connectionSettings.connected || !connectionSettings.apiToken) {
      console.log('Skipping WebSocket - not connected or no API token');
      return false;
    }

    if (!currentContext?.id) {
      console.log('Skipping WebSocket - no context bound');
      return false;
    }

    // Setup WebSocket event handlers
    setupWebSocketEventHandlers();

    // Initialize context integration
    await contextIntegration.initialize();

    // Connect to WebSocket
    const success = await webSocketClient.connect(
      connectionSettings.serverUrl,
      connectionSettings.apiToken,
      currentContext.id
    );

    if (success) {
      console.log('WebSocket connection established successfully');
      return true;
    } else {
      console.warn('WebSocket connection failed');
      return false;
    }
  } catch (error) {
    console.error('Failed to initialize WebSocket:', error);
    return false;
  }
}

// Setup WebSocket event handlers for real-time sync
function setupWebSocketEventHandlers() {
  console.log('Setting up WebSocket event handlers...');

  // Connection state changes
  webSocketClient.on('connection.state', (data) => {
    console.log('WebSocket connection state changed:', data.state);

    // Broadcast state to popup if open
    broadcastToPopup('websocket.state', data);
  });

  // Authentication success
  webSocketClient.on('authenticated', (data) => {
    console.log('WebSocket authenticated:', data);
    broadcastToPopup('websocket.authenticated', data);
  });

  // Context events
  webSocketClient.on('context.joined', (data) => {
    console.log('Joined WebSocket context:', data.contextId);
    broadcastToPopup('websocket.context.joined', data);
  });

  webSocketClient.on('context.changed', (data) => {
    console.log('Context changed via WebSocket:', data);
    // Refresh tabs when context changes
    refreshTabLists();
    broadcastToPopup('context.changed', data);
  });

  // Context URL set events (from CLI commands like 'context set /path')
  webSocketClient.on('context.url.set', (data) => {
    console.log('Context URL set via WebSocket:', data);
    // Refresh tabs when context URL changes
    refreshTabLists();
    broadcastToPopup('context.url.set', data);
  });

  // Document events (real-time tab sync)
  webSocketClient.on('tab.event', async (data) => {
    console.log('Received tab event via WebSocket:', data.type, data);
    await handleRealtimeTabEvent(data);
  });

  // Connection errors
  webSocketClient.on('connection.error', (data) => {
    console.error('WebSocket connection error:', data.error);
    broadcastToPopup('websocket.error', data);
  });

  // Disconnection
  webSocketClient.on('disconnected', () => {
    console.log('WebSocket disconnected');
    broadcastToPopup('websocket.disconnected', {});
  });
}

// Handle real-time tab events from WebSocket
async function handleRealtimeTabEvent(eventData) {
  try {
    console.log('Processing real-time tab event:', eventData.type);

    const syncSettings = await browserStorage.getSyncSettings();

    switch (eventData.type) {
      case 'document.inserted':
        await handleDocumentInserted(eventData, syncSettings);
        break;

      case 'document.updated':
        await handleDocumentUpdated(eventData, syncSettings);
        break;

      case 'document.removed':
      case 'document.removed.batch':
        await handleDocumentRemoved(eventData, syncSettings);
        break;

      case 'document.deleted':
      case 'document.deleted.batch':
        await handleDocumentDeleted(eventData, syncSettings);
        break;

      default:
        console.log('Unknown tab event type:', eventData.type);
    }

    // Refresh popup tab lists
    refreshTabLists();

  } catch (error) {
    console.error('Failed to handle real-time tab event:', error);
  }
}

// Handle document inserted (new tab synced from another client)
async function handleDocumentInserted(eventData, syncSettings) {
  console.log('Handling document inserted:', eventData);

  // Only handle if auto-open is enabled
  if (!syncSettings.autoOpenNewTabs) {
    console.log('Auto-open disabled, skipping document insertion');
    return;
  }

  const documents = eventData.documents || [eventData.document];

  for (const document of documents) {
    if (document.schema === 'data/abstraction/tab' && document.data?.url) {
      // Always check if this tab came from the same browser instance to avoid duplicates
      const browserIdentity = await browserStorage.getBrowserIdentity();
      const hasOurFeature = document.featureArray?.includes(`tag/${browserIdentity}`);

      if (hasOurFeature) {
        console.log('Service Worker: Skipping tab from same browser instance to avoid duplicate opening');
        continue;
      }

      // Check if tab is already open
      const existingTabs = await tabManager.findDuplicateTabs(document.data.url);

      if (existingTabs.length === 0) {
        console.log('Opening new tab from Canvas:', document.data.title);
        await tabManager.openCanvasDocument(document, { active: false });
      } else {
        console.log('Tab already open, skipping:', document.data.url);
      }
    }
  }
}

// Handle document updated
async function handleDocumentUpdated(eventData, syncSettings) {
  console.log('Handling document updated:', eventData);
  // For now, just log - we could update tab titles/URLs in the future
}

// Handle document removed from context
async function handleDocumentRemoved(eventData, syncSettings) {
  console.log('Handling document removed:', eventData);

  // Only handle if auto-close is enabled
  if (!syncSettings.autoCloseRemovedTabs) {
    console.log('Auto-close disabled, skipping document removal');
    return;
  }

  const documentIds = eventData.documentIds || [eventData.documentId];

  for (const documentId of documentIds) {
    // Find and close matching tabs (need to match by URL since we don't store document IDs in tabs)
    // This is a limitation - we'd need to enhance tab tracking to store document IDs
    console.log('Would close tab for removed document:', documentId);
  }
}

// Handle document deleted from database
async function handleDocumentDeleted(eventData, syncSettings) {
  console.log('Handling document deleted:', eventData);

  // Same as removed for now
  await handleDocumentRemoved(eventData, syncSettings);
}

// Broadcast message to popup
function broadcastToPopup(type, data) {
  // Chrome extensions can send messages to popup if it's open
  try {
    chrome.runtime.sendMessage({
      type: 'BACKGROUND_EVENT',
      eventType: type,
      data: data
    }).catch(() => {
      // Popup might not be open, ignore errors
    });
  } catch (error) {
    // Ignore - popup not open
  }
}

// Refresh tab lists (notify popup)
function refreshTabLists() {
  broadcastToPopup('tabs.refresh', {});
}

// Tab event listeners for synchronization
chrome.tabs.onCreated.addListener(async (tab) => {
  console.log('🆕 TAB EVENT: Tab created detected!', tab.id, tab.url);
  // Note: Auto-sync logic moved to onUpdated listener for reliable page load detection
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  console.log('🔄 TAB EVENT: Tab updated detected!', tabId, changeInfo);

  // Handle auto-sync when page is fully loaded OR when URL changes
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('🔄 AUTO-SYNC: Tab page loaded completely:', tabId, tab.url, 'changeInfo:', changeInfo);

    try {
      // Check if auto-sync is enabled and we're connected
      const syncSettings = await browserStorage.getSyncSettings();
      const connectionSettings = await browserStorage.getConnectionSettings();

      console.log('🔄 AUTO-SYNC: Loaded settings for updated tab:', {
        autoSyncNewTabs: syncSettings?.autoSyncNewTabs,
        connected: connectionSettings?.connected,
        statusComplete: changeInfo.status === 'complete',
        urlChanged: !!changeInfo.url
      });

      if (!syncSettings?.autoSyncNewTabs) {
        console.log('🔄 AUTO-SYNC: Auto-sync is disabled, skipping');
        return;
      }

      if (!connectionSettings?.connected) {
        console.log('🔄 AUTO-SYNC: Not connected to Canvas, skipping');
        return;
      }

      // Check if this tab should be synced
      if (!tabManager.shouldSyncTab(tab)) {
        console.log('🔄 AUTO-SYNC: Tab not suitable for sync (internal page, etc.):', tab.url);
        return;
      }

      console.log('🔄 AUTO-SYNC: Page loaded completely, checking if should sync:', tab.title, tab.url);

      // CRITICAL: Check if tab is already synced to prevent cascading sync loops
      if (tabManager.isTabSynced(tab.id)) {
        console.log('🔄 AUTO-SYNC: Tab already synced (opened from Canvas), skipping auto-sync:', tab.title);
        return;
      }

      // CRITICAL: Check if URL is pending from Canvas to prevent race conditions
      if (tabManager.isUrlPendingFromCanvas(tab.url)) {
        console.log('🔄 AUTO-SYNC: Tab URL is pending from Canvas document, skipping auto-sync:', tab.title);
        return;
      }

      const currentContext = await browserStorage.getCurrentContext();
      const browserIdentity = await browserStorage.getBrowserIdentity();

      console.log('🔄 AUTO-SYNC: Context and identity for loaded tab:', {
        contextId: currentContext?.id,
        contextUrl: currentContext?.url,
        browserIdentity: browserIdentity
      });

      if (!currentContext?.id) {
        console.log('🔄 AUTO-SYNC: No context bound, cannot sync tab');
        return;
      }

      if (!browserIdentity) {
        console.log('🔄 AUTO-SYNC: No browser identity set, cannot sync tab');
        return;
      }

      console.log('🔄 AUTO-SYNC: Starting sync for fully loaded tab:', tab.title, tab.url);

      try {
        const syncResult = await tabManager.syncTabToCanvas(tab, apiClient, currentContext.id, browserIdentity);

        console.log('🔄 AUTO-SYNC: Loaded tab sync result:', syncResult);

        if (syncResult.success) {
          console.log('✅ AUTO-SYNC: Successfully synced fully loaded tab:', tab.title);
        } else {
          console.error('❌ AUTO-SYNC: Failed to sync loaded tab:', syncResult.error || 'Unknown error');
        }
      } catch (error) {
        console.error('❌ AUTO-SYNC: Exception syncing loaded tab:', error);
      }
    } catch (error) {
      console.error('❌ AUTO-SYNC: Exception processing loaded tab:', error);
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log('❌ TAB EVENT: Tab removed detected!', tabId, removeInfo);
  console.log('Tab removed:', tabId);

  // Clean up tracking
  tabManager.unmarkTabAsSynced(tabId);
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('Tab activated:', activeInfo.tabId);
  // Handle tab activation
});

// Window event listeners
chrome.windows.onCreated.addListener(async (window) => {
  console.log('Window created:', window.id);
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  console.log('Window removed:', windowId);
});

console.log('✅ Service Worker: All tab and window event listeners registered successfully');

// Test basic functionality on startup
setTimeout(async () => {
  console.log('🔧 Service Worker: Testing basic functionality...');
  try {
    const status = await debugAutoSyncStatus();
    console.log('🔧 Service Worker: Initial auto-sync status check completed');
  } catch (error) {
    console.error('🔧 Service Worker: Failed to check initial status:', error);
  }
}, 1000);

// Debug helper function for checking auto-sync status
async function debugAutoSyncStatus() {
  try {
    const syncSettings = await browserStorage.getSyncSettings();
    const connectionSettings = await browserStorage.getConnectionSettings();
    const currentContext = await browserStorage.getCurrentContext();
    const browserIdentity = await browserStorage.getBrowserIdentity();

    const status = {
      autoSyncNewTabs: syncSettings?.autoSyncNewTabs,
      connected: connectionSettings?.connected,
      hasApiToken: !!connectionSettings?.apiToken,
      serverUrl: connectionSettings?.serverUrl,
      contextId: currentContext?.id,
      contextUrl: currentContext?.url,
      browserIdentity: browserIdentity,
      apiClientInitialized: !!apiClient?.apiToken
    };

    console.log('🔍 AUTO-SYNC DEBUG STATUS:', status);
    return status;
  } catch (error) {
    console.error('🔍 AUTO-SYNC DEBUG ERROR:', error);
    return { error: error.message };
  }
}

// Message handling for popup/settings communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message.type, message);

  // Add debug command
  if (message.type === 'DEBUG_AUTO_SYNC_STATUS') {
    debugAutoSyncStatus().then(status => {
      sendResponse({ success: true, status });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // Add ping test
  if (message.type === 'PING') {
    console.log('🏓 Service Worker: PING received');
    sendResponse({ success: true, message: 'PONG from service worker' });
    return true;
  }

  switch (message.type) {
    case 'GET_CONNECTION_STATUS':
      // Return current connection status from storage
      handleGetConnectionStatus(sendResponse);
      return true;

    case 'TEST_CONNECTION':
      // Test connection to Canvas server
      handleTestConnection(message.data, sendResponse);
      return true; // Keep message channel open for async response

    case 'CONNECT':
      // Connect to Canvas server
      handleConnect(message.data, sendResponse);
      return true;

    case 'DISCONNECT':
      // Disconnect from Canvas server
      handleDisconnect(sendResponse);
      return true;

    case 'GET_CONTEXTS':
      // Get available contexts from Canvas server
      handleGetContexts(sendResponse);
      return true;

    case 'BIND_CONTEXT':
      // Bind to a specific context
      handleBindContext(message.data, sendResponse);
      return true;

    case 'SAVE_SETTINGS':
      // Save all extension settings
      handleSaveSettings(message.data, sendResponse);
      return true;

    case 'GET_SYNC_SETTINGS':
      // Get sync settings only
      handleGetSyncSettings(sendResponse);
      return true;

    case 'SET_SYNC_SETTINGS':
      // Set sync settings only
      handleSetSyncSettings(message.data, sendResponse);
      return true;

    case 'GET_TABS':
      // Get browser tabs or canvas tabs
      handleGetTabs(message.data, sendResponse);
      return true;

    case 'GET_ALL_TABS':
      // Get all browser tabs (both synced and unsynced)
      handleGetAllTabs(message.data, sendResponse);
      return true;

    case 'GET_CANVAS_DOCUMENTS':
      // Get Canvas documents for current context
      handleGetCanvasDocuments(message.data, sendResponse);
      return true;

    case 'SYNC_TAB':
      // Sync a single tab to Canvas
      handleSyncTab(message.data, sendResponse);
      return true;

    case 'SYNC_MULTIPLE_TABS':
      // Sync multiple tabs to Canvas
      handleSyncMultipleTabs(message.data, sendResponse);
      return true;

    case 'OPEN_CANVAS_DOCUMENT':
      // Open Canvas document as browser tab
      handleOpenCanvasDocument(message.data, sendResponse);
      return true;

    case 'REMOVE_CANVAS_DOCUMENT':
      // Remove Canvas document
      handleRemoveCanvasDocument(message.data, sendResponse);
      return true;

    case 'CLOSE_TAB':
      // Close browser tab
      handleCloseTab(message.data, sendResponse);
      return true;

    case 'TOGGLE_PIN_TAB':
      // Toggle pin state of a tab
      handleTogglePinTab(message.data, sendResponse);
      return true;

    case 'GET_PINNED_TABS':
      // Get list of pinned tab IDs
      handleGetPinnedTabs(message.data, sendResponse);
      return true;

    case 'GET_CONNECTION_SETTINGS':
      // Get connection settings
      handleGetConnectionSettings(message.data, sendResponse);
      return true;

    case 'OPEN_TAB':
      // Open a Canvas tab in browser
      handleOpenTab(message.data, sendResponse);
      return true;

    case 'REMOVE_FROM_CONTEXT':
      // Remove tab from context
      handleRemoveFromContext(message.data, sendResponse);
      return true;

    case 'DELETE_FROM_DATABASE':
      // Delete tab from database completely
      handleDeleteFromDatabase(message.data, sendResponse);
      return true;

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }
});

// Helper Functions

async function openSettingsPage() {
  const url = chrome.runtime.getURL('settings/settings.html');
  await chrome.tabs.create({ url });
}

async function handleGetConnectionStatus(sendResponse) {
  try {
    console.log('Getting connection status from storage...');

    // Get connection settings and current context
    const connectionSettings = await browserStorage.getConnectionSettings();
    const currentContext = await browserStorage.getCurrentContext();

    console.log('Connection settings:', connectionSettings);
    console.log('Current context:', currentContext);

    sendResponse({
      connected: connectionSettings.connected || false,
      context: currentContext,
      settings: connectionSettings
    });
  } catch (error) {
    console.error('Failed to get connection status:', error);
    sendResponse({
      connected: false,
      context: null,
      error: error.message
    });
  }
}

async function handleTestConnection(data, sendResponse) {
  try {
    console.log('Testing connection with data:', data);

    // Initialize API client with provided settings
    if (data.serverUrl && data.apiBasePath) {
      apiClient.initialize(data.serverUrl, data.apiBasePath, data.apiToken || '');
    }

    // Test the connection
    const result = await apiClient.testConnection();

    console.log('Connection test result:', result);
    sendResponse(result);
  } catch (error) {
    console.error('Connection test failed:', error);
    sendResponse({
      success: false,
      connected: false,
      authenticated: false,
      error: error.message,
      message: 'Connection test failed'
    });
  }
}

async function handleConnect(data, sendResponse) {
  try {
    console.log('Connecting with data:', data);

    // Validate required fields
    if (!data.serverUrl || !data.apiBasePath || !data.apiToken) {
      throw new Error('Missing required connection parameters');
    }

    // Initialize API client
    apiClient.initialize(data.serverUrl, data.apiBasePath, data.apiToken);

    // Test the connection first
    const testResult = await apiClient.testConnection();
    if (!testResult.success || !testResult.authenticated) {
      throw new Error(testResult.message || 'Connection test failed');
    }

    // Save connection settings to storage
    const connectionSettings = {
      serverUrl: data.serverUrl,
      apiBasePath: data.apiBasePath,
      apiToken: data.apiToken,
      connected: true
    };

    console.log('Saving connection settings:', connectionSettings);
    await browserStorage.setConnectionSettings(connectionSettings);

    // Verify settings were saved
    const savedSettings = await browserStorage.getConnectionSettings();
    console.log('Verified saved settings:', savedSettings);

    // Save browser identity if provided
    if (data.browserIdentity) {
      await browserStorage.set(browserStorage.KEYS.BROWSER_IDENTITY, data.browserIdentity);
    }

    // Initialize WebSocket connection if we have a context
    const currentContext = await browserStorage.getCurrentContext();
    if (currentContext?.id) {
      console.log('Initializing WebSocket connection after connect...');
      await initializeWebSocket();
    }

    console.log('Connection saved successfully');

    sendResponse({
      success: true,
      connected: true,
      authenticated: true,
      user: testResult.user,
      message: 'Connected and settings saved successfully'
    });
  } catch (error) {
    console.error('Connection failed:', error);

    // Make sure we clear any connected state on failure
      await browserStorage.setConnectionSettings({
      serverUrl: 'http://127.0.0.1:8001',
      apiBasePath: '/rest/v2',
      apiToken: '',
      connected: false
    });

    sendResponse({
      success: false,
      connected: false,
      authenticated: false,
      error: error.message,
      message: 'Connection failed'
    });
  }
}

async function handleDisconnect(sendResponse) {
  try {
    console.log('Disconnecting from Canvas server...');

    // Clear connection settings
    await browserStorage.setConnectionSettings({
      serverUrl: 'http://127.0.0.1:8001',
      apiBasePath: '/rest/v2',
      apiToken: '',
      connected: false
    });

    // Clear current context
    await browserStorage.setCurrentContext(null);

    // Disconnect WebSocket if connected
    if (webSocketClient.isConnected()) {
      webSocketClient.disconnect();
    }

    // Clear API client
    apiClient.connected = false;

    console.log('Disconnected successfully');

    sendResponse({
      success: true,
      connected: false,
      message: 'Disconnected successfully'
    });
  } catch (error) {
    console.error('Disconnection failed:', error);
    sendResponse({
      success: false,
      error: error.message,
      message: 'Disconnection failed'
    });
  }
}

async function handleGetContexts(sendResponse) {
  try {
    console.log('Getting available contexts from Canvas server...');

    // Check if API client is initialized and has a token
    if (!apiClient.apiToken) {
      // Try to load from storage if API client isn't initialized
      const connectionSettings = await browserStorage.getConnectionSettings();
      if (!connectionSettings.apiToken) {
        throw new Error('No API token available - please connect first');
      }

      // Initialize API client with stored settings
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken
      );
    }

    console.log('API client initialized, fetching contexts...');

    // Fetch contexts from Canvas server
    const response = await apiClient.getContexts();

    console.log('Contexts response:', response);

    if (response.status === 'success') {
      sendResponse({
        success: true,
        contexts: response.payload || [],
        count: response.count || 0
      });
    } else {
      throw new Error(response.message || 'Failed to fetch contexts');
    }
  } catch (error) {
    console.error('Failed to get contexts:', error);
    sendResponse({
      success: false,
      contexts: [],
      error: error.message
    });
  }
}

async function handleGetTabs(data, sendResponse) {
  try {
    console.log('Getting tabs with type:', data?.type);

    if (data?.type === 'browser') {
      // Get browser tabs that are unsynced (should be synced but aren't yet)
      const tabs = await tabManager.getUnsyncedTabs();
      console.log('Unsynced browser tabs:', tabs.length);

      sendResponse({
        success: true,
        tabs: tabs,
        type: 'browser'
      });
    } else if (data?.type === 'canvas') {
      // Get Canvas context tabs - TODO: implement when we have context binding
      console.log('Canvas tabs not implemented yet');
      sendResponse({
        success: true,
        tabs: [],
        type: 'canvas'
      });
    } else {
      throw new Error('Invalid tab type requested');
    }
  } catch (error) {
    console.error('Failed to get tabs:', error);
    sendResponse({
      success: false,
      tabs: [],
      error: error.message
    });
  }
}

async function handleGetAllTabs(data, sendResponse) {
  try {
    console.log('Getting all browser tabs...');

    // Get all browser tabs
    const tabs = await tabManager.getAllTabs();
    console.log('All browser tabs:', tabs.length);

    sendResponse({
      success: true,
      tabs: tabs,
      type: 'browser'
    });
  } catch (error) {
    console.error('Failed to get all tabs:', error);
    sendResponse({
      success: false,
      tabs: [],
      error: error.message
    });
  }
}

async function handleOpenTab(data, sendResponse) {
  try {
    // TODO: Implement tab opening
    sendResponse({ success: true, message: 'Tab opened successfully' });
  } catch (error) {
    console.error('Failed to open tab:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleCloseTab(data, sendResponse) {
  try {
    const { tabId } = data;

    if (!tabId) {
      throw new Error('Tab ID is required');
    }

    console.log('Closing tab:', tabId);

    // Close the tab using Chrome API
    const result = await tabManager.closeTab(tabId);

    if (result) {
      console.log('Tab closed successfully:', tabId);
      sendResponse({
        success: true,
        message: 'Tab closed successfully'
      });
    } else {
      throw new Error('Failed to close tab');
    }
  } catch (error) {
    console.error('Failed to close tab:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleTogglePinTab(data, sendResponse) {
  try {
    const { tabId } = data;

    if (!tabId) {
      throw new Error('Tab ID is required');
    }

    console.log('Toggling pin state for tab:', tabId);

    // Check current pin state
    const isPinned = await browserStorage.isTabPinned(tabId);

    if (isPinned) {
      await browserStorage.unpinTab(tabId);
      console.log('Tab unpinned:', tabId);
    } else {
      await browserStorage.pinTab(tabId);
      console.log('Tab pinned:', tabId);
    }

    sendResponse({
      success: true,
      isPinned: !isPinned,
      message: `Tab ${!isPinned ? 'pinned' : 'unpinned'} successfully`
    });
  } catch (error) {
    console.error('Failed to toggle pin tab:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleGetPinnedTabs(data, sendResponse) {
  try {
    console.log('Getting pinned tabs');

    const pinnedTabs = await browserStorage.getPinnedTabs();
    const pinnedTabsArray = Array.from(pinnedTabs);

    console.log('Retrieved pinned tabs:', pinnedTabsArray);

    sendResponse({
      success: true,
      pinnedTabs: pinnedTabsArray
    });
  } catch (error) {
    console.error('Failed to get pinned tabs:', error);
    sendResponse({
      success: false,
      error: error.message,
      pinnedTabs: []
    });
  }
}

async function handleGetConnectionSettings(data, sendResponse) {
  try {
    console.log('Getting connection settings');

    const connectionSettings = await browserStorage.getConnectionSettings();

    console.log('Retrieved connection settings:', connectionSettings);

    sendResponse({
      success: true,
      settings: connectionSettings
    });
  } catch (error) {
    console.error('Failed to get connection settings:', error);
    sendResponse({
      success: false,
      error: error.message,
      settings: null
    });
  }
}

async function handleRemoveFromContext(data, sendResponse) {
  try {
    // TODO: Implement context removal
    sendResponse({ success: true, message: 'Tab removed from context' });
  } catch (error) {
    console.error('Failed to remove from context:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleDeleteFromDatabase(data, sendResponse) {
  try {
    // TODO: Implement database deletion
    sendResponse({ success: true, message: 'Tab deleted from database' });
  } catch (error) {
    console.error('Failed to delete from database:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// New Tab Management Handlers

async function handleBindContext(data, sendResponse) {
  try {
    const { context } = data;

    if (!context || !context.id) {
      throw new Error('Valid context is required');
    }

    console.log('Binding to context:', context);

    // Get old context for context switching
    const oldContext = await browserStorage.getCurrentContext();
    const oldContextId = oldContext?.id;

    // Save context to storage
    await browserStorage.setCurrentContext(context);

    // Notify context integration of context switch
    if (contextIntegration.isInitialized) {
      await contextIntegration.switchContext(context.id);
    }

    // Initialize WebSocket connection now that we have a context
    const connectionSettings = await browserStorage.getConnectionSettings();
    if (connectionSettings.connected && connectionSettings.apiToken) {
      console.log('Initializing WebSocket connection after context bind...');
      await initializeWebSocket();
    }

    console.log('Context bound successfully:', context.id);

    sendResponse({
      success: true,
      context: context,
      message: `Bound to context: ${context.id}`
    });
  } catch (error) {
    console.error('Failed to bind context:', error);
    sendResponse({
      success: false,
      error: error.message,
      message: 'Failed to bind context'
    });
  }
}

async function handleSaveSettings(data, sendResponse) {
  try {
    console.log('Saving all extension settings:', data);

    // Save connection settings
    if (data.connectionSettings) {
      await browserStorage.setConnectionSettings(data.connectionSettings);
      console.log('Connection settings saved');
    }

    // Save sync settings
    if (data.syncSettings) {
      await browserStorage.setSyncSettings(data.syncSettings);
      console.log('Sync settings saved');
    }

    // Save browser identity
    if (data.browserIdentity) {
      await browserStorage.set(browserStorage.KEYS.BROWSER_IDENTITY, data.browserIdentity);
      console.log('Browser identity saved');
    }

    // Verify all settings were saved correctly
    const verifyConnection = await browserStorage.getConnectionSettings();
    const verifySync = await browserStorage.getSyncSettings();
    const verifyIdentity = await browserStorage.getBrowserIdentity();
    const verifyContext = await browserStorage.getCurrentContext();

    console.log('Settings verification:', {
      connection: verifyConnection,
      sync: verifySync,
      identity: verifyIdentity,
      context: verifyContext
    });

    sendResponse({
      success: true,
      message: 'All settings saved successfully',
      savedSettings: {
        connection: verifyConnection,
        sync: verifySync,
        identity: verifyIdentity,
        context: verifyContext
      }
    });
  } catch (error) {
    console.error('Failed to save settings:', error);
    sendResponse({
      success: false,
      error: error.message,
      message: 'Failed to save settings'
    });
  }
}

async function handleGetSyncSettings(sendResponse) {
  try {
    console.log('Getting sync settings from storage...');

    // Get sync settings from storage
    const syncSettings = await browserStorage.getSyncSettings();

    console.log('Sync settings:', syncSettings);

    sendResponse({
      success: true,
      settings: syncSettings
    });
  } catch (error) {
    console.error('Failed to get sync settings:', error);
    sendResponse({
      success: false,
      settings: null,
      error: error.message
    });
  }
}

async function handleSetSyncSettings(data, sendResponse) {
  try {
    console.log('Setting sync settings:', data);

    // Save sync settings to storage (data is the partial settings object)
    await browserStorage.setSyncSettings(data);

    // Verify settings were saved
    const verifySettings = await browserStorage.getSyncSettings();
    console.log('Sync settings saved and verified:', verifySettings);

    sendResponse({
      success: true,
      message: 'Sync settings saved successfully',
      settings: verifySettings
    });
  } catch (error) {
    console.error('Failed to set sync settings:', error);
    sendResponse({
      success: false,
      error: error.message,
      message: 'Failed to set sync settings'
    });
  }
}

async function handleGetCanvasDocuments(data, sendResponse) {
  try {
    console.log('Getting Canvas documents for context:', data?.contextId);

    // Get current context if not provided
    let contextId = data?.contextId;
    if (!contextId) {
      const currentContext = await browserStorage.getCurrentContext();
      if (!currentContext?.id) {
        throw new Error('No context selected');
      }
      contextId = currentContext.id;
    }

    // Get connection settings
    const connectionSettings = await browserStorage.getConnectionSettings();
    console.log('Canvas Documents: connection settings check:', connectionSettings);

    // Check if we have essential connection info (prioritize API token over connected flag)
    if (!connectionSettings.apiToken || !connectionSettings.serverUrl) {
      console.error('Canvas Documents: Missing API token or server URL');
      throw new Error('Not connected to Canvas server - missing credentials');
    }

    if (!connectionSettings.connected) {
      console.warn('Canvas Documents: Connected flag is false, but we have API token - attempting operation');
    }

    // Initialize API client if needed
    if (!apiClient.apiToken) {
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken
      );
    }

    // Fetch Canvas documents with tab schema filter
    const featureArray = ['data/abstraction/tab'];
    const response = await apiClient.getContextDocuments(contextId, featureArray);

    if (response.status === 'success') {
      sendResponse({
        success: true,
        documents: response.payload || [],
        count: response.count || 0
      });
    } else {
      throw new Error(response.message || 'Failed to fetch Canvas documents');
    }
  } catch (error) {
    console.error('Failed to get Canvas documents:', error);
    sendResponse({
      success: false,
      documents: [],
      error: error.message
    });
  }
}

async function handleSyncTab(data, sendResponse) {
  try {
    const { tab, contextId } = data;

    if (!tab) {
      throw new Error('Tab object is required');
    }

    console.log('Syncing tab to Canvas:', tab);

    // Get current context if not provided
    let targetContextId = contextId;
    if (!targetContextId) {
      const currentContext = await browserStorage.getCurrentContext();
      if (!currentContext?.id) {
        throw new Error('No context selected');
      }
      targetContextId = currentContext.id;
    }

    // Get connection settings
    const connectionSettings = await browserStorage.getConnectionSettings();
    console.log('Sync Tab: connection settings check:', connectionSettings);

    // Check if we have essential connection info (prioritize API token over connected flag)
    if (!connectionSettings.apiToken || !connectionSettings.serverUrl) {
      console.error('Sync Tab: Missing API token or server URL');
      throw new Error('Not connected to Canvas server - missing credentials');
    }

    if (!connectionSettings.connected) {
      console.warn('Sync Tab: Connected flag is false, but we have API token - attempting operation');
    }

    // Get browser identity
    const browserIdentity = await browserStorage.getBrowserIdentity();

    // Initialize API client if needed
    if (!apiClient.apiToken) {
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken
      );
    }

    // Sync the tab
    const result = await tabManager.syncTabToCanvas(tab, apiClient, targetContextId, browserIdentity);

    console.log('Tab sync result:', result);
    sendResponse(result);
  } catch (error) {
    console.error('Failed to sync tab:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleSyncMultipleTabs(data, sendResponse) {
  try {
    console.log('🔧 handleSyncMultipleTabs called with data:', data);

    const { tabIds, contextId } = data;

    if (!tabIds || !Array.isArray(tabIds)) {
      console.error('❌ Tab IDs validation failed:', { tabIds, isArray: Array.isArray(tabIds) });
      throw new Error('Tab IDs array is required');
    }

    console.log(`🔧 Processing ${tabIds.length} tab IDs:`, tabIds);

    // Get the tabs
    const tabs = [];
    for (const tabId of tabIds) {
      const tab = await tabManager.getTab(tabId);
      if (tab) {
        tabs.push(tab);
        console.log(`✅ Found tab ${tabId}: ${tab.title}`, {
          id: tab.id,
          url: tab.url,
          title: tab.title,
          status: tab.status,
          discarded: tab.discarded,
          windowId: tab.windowId
        });
      } else {
        console.warn(`⚠️ Tab ${tabId} not found`);
      }
    }

    if (tabs.length === 0) {
      console.error('❌ No valid tabs found after lookup');
      throw new Error('No valid tabs found');
    }

    console.log(`🔧 Found ${tabs.length} valid tabs to sync`);

    // Get current context if not provided
    let targetContextId = contextId;
    if (!targetContextId) {
      const currentContext = await browserStorage.getCurrentContext();
      if (!currentContext?.id) {
        console.error('❌ No context selected');
        throw new Error('No context selected');
      }
      targetContextId = currentContext.id;
    }

    console.log(`🔧 Target context ID: ${targetContextId}`);

    // Get connection settings
    const connectionSettings = await browserStorage.getConnectionSettings();
    console.log('🔧 Connection settings:', connectionSettings);

    if (!connectionSettings.connected || !connectionSettings.apiToken) {
      console.error('❌ Not connected to Canvas server:', {
        connected: connectionSettings.connected,
        hasToken: !!connectionSettings.apiToken
      });
      throw new Error('Not connected to Canvas server');
    }

    // Get browser identity
    const browserIdentity = await browserStorage.getBrowserIdentity();
    console.log('🔧 Browser identity:', browserIdentity);

    // Initialize API client if needed
    if (!apiClient.apiToken) {
      console.log('🔧 Initializing API client...');
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken
      );
    }

    console.log('🔧 Calling tabManager.syncMultipleTabs...');

    // Sync multiple tabs
    const result = await tabManager.syncMultipleTabs(tabs, apiClient, targetContextId, browserIdentity);

    console.log('✅ tabManager.syncMultipleTabs completed with result:', result);
    sendResponse(result);
  } catch (error) {
    console.error('❌ handleSyncMultipleTabs failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleOpenCanvasDocument(data, sendResponse) {
  try {
    const { document, options = {} } = data;

    if (!document) {
      throw new Error('Canvas document is required');
    }

    // Open the Canvas document as a browser tab
    const result = await tabManager.openCanvasDocument(document, options);

    sendResponse(result);
  } catch (error) {
    console.error('Failed to open Canvas document:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleRemoveCanvasDocument(data, sendResponse) {
  try {
    const { document, contextId, closeTab = false } = data;

    if (!document) {
      throw new Error('Canvas document is required');
    }

    // Get current context if not provided
    let targetContextId = contextId;
    if (!targetContextId) {
      const currentContext = await browserStorage.getCurrentContext();
      if (!currentContext?.id) {
        throw new Error('No context selected');
      }
      targetContextId = currentContext.id;
    }

    // Get connection settings
    const connectionSettings = await browserStorage.getConnectionSettings();
    if (!connectionSettings.connected || !connectionSettings.apiToken) {
      throw new Error('Not connected to Canvas server');
    }

    // Initialize API client if needed
    if (!apiClient.apiToken) {
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken
      );
    }

    // Remove the Canvas document
    const result = await tabManager.removeCanvasDocument(document, apiClient, targetContextId, closeTab);

    sendResponse(result);
  } catch (error) {
    console.error('Failed to remove Canvas document:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Initialize extension on service worker startup
initializeExtension();
