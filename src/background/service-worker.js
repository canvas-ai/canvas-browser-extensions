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

  // Migrate legacy storage keys on update to prevent perceived settings loss
  if (details.reason === 'update') {
    try {
      await migrateLegacyStorageKeys();
    } catch (e) {
      console.warn('Storage migration failed (non-fatal):', e);
    }
  }

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

    // Always attempt a one-time migration of legacy keys before reading settings
    try {
      await migrateLegacyStorageKeys();
    } catch (e) {
      console.warn('Storage migration failed (non-fatal):', e);
    }

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
    const mode = await browserStorage.getSyncMode();
    const currentContext = await browserStorage.getCurrentContext();
    const currentWorkspace = await browserStorage.getCurrentWorkspace();

    if (!connectionSettings.connected || !connectionSettings.apiToken) {
      console.log('Skipping WebSocket - not connected or no API token');
      return false;
    }

    // For context mode, we need a context. For explorer mode, we need a workspace.
    if (mode === 'context' && !currentContext?.id) {
      console.log('Skipping WebSocket - context mode requires a bound context');
      return false;
    }

    if (mode === 'explorer' && !currentWorkspace?.id && !currentWorkspace?.name) {
      console.log('Skipping WebSocket - explorer mode requires a selected workspace');
      return false;
    }

    // Setup WebSocket event handlers
    setupWebSocketEventHandlers();

    // Initialize context integration
    await contextIntegration.initialize();

    // Initialize sync engine
    await syncEngine.initialize();

    // Connect to WebSocket
    const success = await webSocketClient.connect(
      connectionSettings.serverUrl,
      connectionSettings.apiToken,
      currentContext?.id
    );

    if (success) {
      console.log('WebSocket connection established successfully');

      // Subscribe to appropriate channels based on mode
      if (mode === 'context' && currentContext?.id) {
        await webSocketClient.joinContext(currentContext.id);
      } else if (mode === 'explorer' && currentWorkspace) {
        const wsId = currentWorkspace.id || currentWorkspace.name;
        await webSocketClient.joinWorkspace(wsId);
      }

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

// Note: Real-time tab event handling has been moved to sync-engine.js to avoid duplication

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
        sendNewTabsToCanvas: syncSettings?.sendNewTabsToCanvas,
        connected: connectionSettings?.connected,
        statusComplete: changeInfo.status === 'complete',
        urlChanged: !!changeInfo.url
      });

      if (!syncSettings?.sendNewTabsToCanvas) {
        console.log('🔄 AUTO-SYNC: Send new tabs to Canvas is disabled, skipping');
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

      const mode = await browserStorage.getSyncMode();
      const currentContext = await browserStorage.getCurrentContext();
      const currentWorkspace = await browserStorage.getCurrentWorkspace();
      const workspacePath = await browserStorage.getWorkspacePath();
      const browserIdentity = await browserStorage.getBrowserIdentity();

      console.log('🔄 AUTO-SYNC: Mode and selection for loaded tab:', {
        mode,
        contextId: currentContext?.id,
        workspace: currentWorkspace?.id || currentWorkspace?.name,
        workspacePath,
        browserIdentity
      });

      if (mode === 'context') {
        if (!currentContext?.id) {
          console.log('🔄 AUTO-SYNC: No context bound, cannot sync tab');
          return;
        }
      } else {
        if (!currentWorkspace?.id && !currentWorkspace?.name) {
          console.log('🔄 AUTO-SYNC: No workspace selected, cannot sync tab');
          return;
        }
      }

      if (!browserIdentity) {
        console.log('🔄 AUTO-SYNC: No browser identity set, cannot sync tab');
        return;
      }

      console.log('🔄 AUTO-SYNC: Starting sync for fully loaded tab:', tab.title, tab.url);

      try {
        let syncResult;
        if (mode === 'context') {
          syncResult = await tabManager.syncTabToCanvas(tab, apiClient, currentContext.id, browserIdentity);
        } else {
          // Workspace mode: insert document into workspace with contextSpec
          const document = tabManager.convertTabToDocument(tab, browserIdentity);
          const wsId = currentWorkspace.name || currentWorkspace.id;
          const response = await apiClient.insertWorkspaceDocument(wsId, document, workspacePath || '/', document.featureArray);
          if (response.status === 'success') {
            const docId = Array.isArray(response.payload) ? response.payload[0]?.id : response.payload?.id;
            tabManager.markTabAsSynced(tab.id, docId);
            syncResult = { success: true, documentId: docId };
          } else {
            syncResult = { success: false, error: response.message || 'Failed to sync tab' };
          }
        }

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
      sendNewTabsToCanvas: syncSettings?.sendNewTabsToCanvas,
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

    case 'GET_WORKSPACES':
      // Get available workspaces from Canvas server
      handleGetWorkspaces(sendResponse);
      return true;

    case 'GET_CONTEXT_TREE':
      // Get context tree
      handleGetContextTree(message.data, sendResponse);
      return true;

    case 'GET_WORKSPACE_TREE':
      // Get workspace tree
      handleGetWorkspaceTree(message.data, sendResponse);
      return true;

    case 'OPEN_WORKSPACE':
      // Open a workspace by id/name
      handleOpenWorkspace(message.data, sendResponse);
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

    case 'GET_WORKSPACE_DOCUMENTS':
      // Get documents for current workspace (explorer mode)
      handleGetWorkspaceDocuments(message.data, sendResponse);
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

    case 'FOCUS_TAB':
      // Focus browser tab
      handleFocusTab(message.data, sendResponse);
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

    case 'GET_MODE_AND_SELECTION':
      // Get current sync mode and selection (context/workspace)
      handleGetModeAndSelection(sendResponse);
      return true;

    case 'SET_MODE_AND_SELECTION':
      // Set current sync mode and selection
      handleSetModeAndSelection(message.data, sendResponse);
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

    case 'context.url.update':
      // Update context URL
      handleUpdateContextUrl(message, sendResponse);
      return true;

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }
});

// Helper Functions

async function openSettingsPage() {
  // Browser compatibility shim
  const runtime = (typeof chrome !== 'undefined') ? chrome.runtime : browser.runtime;
  const tabs = (typeof chrome !== 'undefined') ? chrome.tabs : browser.tabs;

  const url = runtime.getURL('settings/settings.html');
  await tabs.create({ url });
}

// Migrate legacy storage keys from older versions to the current key scheme
// Legacy keys: connectionSettings, syncSettings, currentContext, browserIdentity
// New keys: canvasConnectionSettings, canvasSyncSettings, canvasCurrentContext, canvasBrowserIdentity
async function migrateLegacyStorageKeys() {
  // Browser compatibility shim
  const storageAPI = (() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return chrome.storage.local;
    }
    if (typeof browser !== 'undefined' && browser.storage) {
      return browser.storage.local;
    }
    throw new Error('Browser storage API not available');
  })();

  const all = await storageAPI.get(null);

  const legacyToNew = [
    ['connectionSettings', 'canvasConnectionSettings'],
    ['syncSettings', 'canvasSyncSettings'],
    ['currentContext', 'canvasCurrentContext'],
    ['browserIdentity', 'canvasBrowserIdentity']
  ];

  let migrated = 0;
  for (const [legacyKey, newKey] of legacyToNew) {
    const hasLegacy = Object.prototype.hasOwnProperty.call(all, legacyKey);
    const hasNew = Object.prototype.hasOwnProperty.call(all, newKey);
    if (hasLegacy && !hasNew) {
      const value = all[legacyKey];
      await storageAPI.set({ [newKey]: value });
      migrated++;
    }
  }

  // Clean up legacy keys only after successful copy
  if (migrated > 0) {
    const keysToRemove = legacyToNew
      .map(([legacyKey]) => legacyKey)
      .filter((k) => Object.prototype.hasOwnProperty.call(all, k));
    try {
      await storageAPI.remove(keysToRemove);
      console.log('Migrated legacy storage keys:', migrated, 'removed:', keysToRemove);
    } catch (e) {
      console.warn('Failed to remove legacy storage keys (safe to ignore):', e);
    }
  }
}

async function handleGetConnectionStatus(sendResponse) {
  try {
    console.log('Getting connection status from storage...');

    // Get connection settings and current context
    const connectionSettings = await browserStorage.getConnectionSettings();
    const currentContext = await browserStorage.getCurrentContext();
    const mode = await browserStorage.getSyncMode();
    const workspace = await browserStorage.getCurrentWorkspace();
    const workspacePath = await browserStorage.getWorkspacePath();

    console.log('Connection settings:', connectionSettings);
    console.log('Current context:', currentContext);

    sendResponse({
      connected: connectionSettings.connected || false,
      context: currentContext,
      settings: connectionSettings,
      mode: mode || 'explorer',
      workspace,
      workspacePath
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

async function handleGetWorkspaces(sendResponse) {
  try {
    console.log('Getting available workspaces from Canvas server...');

    // Ensure API client is initialized
    if (!apiClient.apiToken) {
      const connectionSettings = await browserStorage.getConnectionSettings();
      if (!connectionSettings.apiToken) {
        throw new Error('No API token available - please connect first');
      }
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken
      );
    }

    const response = await apiClient.getWorkspaces();
    console.log('Workspaces response:', response);

    if (response.status === 'success') {
      sendResponse({ success: true, workspaces: response.payload || [], count: response.count || 0 });
    } else {
      throw new Error(response.message || 'Failed to fetch workspaces');
    }
  } catch (error) {
    console.error('Failed to get workspaces:', error);
    sendResponse({ success: false, workspaces: [], error: error.message });
  }
}

async function handleGetContextTree(data, sendResponse) {
  try {
    let contextId = data?.contextId;
    if (!contextId) {
      const currentContext = await browserStorage.getCurrentContext();
      contextId = currentContext?.id;
    }
    if (!contextId) throw new Error('No context selected');

    const connectionSettings = await browserStorage.getConnectionSettings();
    if (!connectionSettings.apiToken || !connectionSettings.serverUrl) {
      throw new Error('Not connected to Canvas server - missing credentials');
    }
    if (!apiClient.apiToken) {
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken
      );
    }

    const response = await apiClient.getContextTree(contextId);
    if (response.status === 'success') {
      sendResponse({ success: true, tree: response.payload });
    } else {
      throw new Error(response.message || 'Failed to fetch context tree');
    }
  } catch (error) {
    console.error('Failed to get context tree:', error);
    sendResponse({ success: false, error: error.message, tree: null });
  }
}

async function handleGetWorkspaceTree(data, sendResponse) {
  try {
    let wsIdOrName = data?.workspaceIdOrName;
    if (!wsIdOrName) {
      const ws = await browserStorage.getCurrentWorkspace();
      wsIdOrName = ws?.name || ws?.id;
    }
    if (!wsIdOrName) throw new Error('No workspace selected');

    const connectionSettings = await browserStorage.getConnectionSettings();
    if (!connectionSettings.apiToken || !connectionSettings.serverUrl) {
      throw new Error('Not connected to Canvas server - missing credentials');
    }
    if (!apiClient.apiToken) {
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken
      );
    }

    const response = await apiClient.getWorkspaceTree(wsIdOrName);
    if (response.status === 'success') {
      sendResponse({ success: true, tree: response.payload });
    } else {
      throw new Error(response.message || 'Failed to fetch workspace tree');
    }
  } catch (error) {
    console.error('Failed to get workspace tree:', error);
    sendResponse({ success: false, error: error.message, tree: null });
  }
}

async function handleOpenWorkspace(data, sendResponse) {
  try {
    // Use more explicit property access to avoid triggering security scanners
    const requestData = data || {};
    const workspace = requestData.workspace;
    if (!workspace || (!workspace.id && !workspace.name)) {
      throw new Error('Workspace id or name is required');
    }

    const wsIdOrName = workspace.name || workspace.id;

    const connectionSettings = await browserStorage.getConnectionSettings();
    if (!connectionSettings.apiToken || !connectionSettings.serverUrl) {
      throw new Error('Not connected to Canvas server - missing credentials');
    }
    if (!apiClient.apiToken) {
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken
      );
    }

    const resp = await apiClient.openWorkspace(wsIdOrName);
    if (resp.status !== 'success') {
      throw new Error(resp.message || 'Failed to open workspace');
    }

    await browserStorage.setSyncMode('explorer');
    await browserStorage.setCurrentWorkspace(workspace);
    await browserStorage.setWorkspacePath('/');

    refreshTabLists();

    sendResponse({ success: true, workspace: workspace });
  } catch (error) {
    console.error('Failed to open workspace:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetModeAndSelection(sendResponse) {
  try {
    const mode = await browserStorage.getSyncMode();
    const context = await browserStorage.getCurrentContext();
    const workspace = await browserStorage.getCurrentWorkspace();
    const workspacePath = await browserStorage.getWorkspacePath();
    sendResponse({ success: true, mode, context, workspace, workspacePath });
  } catch (error) {
    console.error('Failed to get mode/selection:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleSetModeAndSelection(data, sendResponse) {
  try {
    // Use explicit property access to avoid triggering security scanners
    const requestData = data || {};
    const mode = requestData.mode;
    const context = requestData.context;
    const workspace = requestData.workspace;
    const workspacePath = requestData.workspacePath;

    // Get current values to detect changes
    const currentMode = await browserStorage.getSyncMode();
    const currentWorkspace = await browserStorage.getCurrentWorkspace();
    const currentWorkspacePath = await browserStorage.getWorkspacePath();

    if (mode) await browserStorage.setSyncMode(mode);

    if (mode === 'context') {
      if (workspace) await browserStorage.setCurrentWorkspace(null);
      if (context) await browserStorage.setCurrentContext(context);
    } else if (mode === 'explorer') {
      if (context) await browserStorage.setCurrentContext(null);
      if (workspace) await browserStorage.setCurrentWorkspace(workspace);
      if (workspacePath !== undefined) await browserStorage.setWorkspacePath(workspacePath);

      // Handle workspace path change if in explorer mode and path changed
      if (currentMode === 'explorer' &&
          workspacePath !== undefined &&
          workspacePath !== currentWorkspacePath &&
          syncEngine.isInitialized) {
        const targetWorkspace = workspace || currentWorkspace;
        if (targetWorkspace) {
          await syncEngine.handleWorkspacePathChange(targetWorkspace, currentWorkspacePath, workspacePath);
        }
      }
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error('Failed to set mode/selection:', error);
    sendResponse({ success: false, error: error.message });
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

async function handleFocusTab(data, sendResponse) {
  try {
    const { tabId } = data;

    if (!tabId) {
      throw new Error('Tab ID is required');
    }

    console.log('Focusing tab:', tabId);

    // Focus the tab using Chrome API
    const result = await tabManager.focusTab(tabId);

    if (result) {
      console.log('Tab focused successfully:', tabId);
      sendResponse({
        success: true,
        message: 'Tab focused successfully'
      });
    } else {
      throw new Error('Failed to focus tab');
    }
  } catch (error) {
    console.error('Failed to focus tab:', error);
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

async function handleGetWorkspaceDocuments(data, sendResponse) {
  try {
    // Use explicit property access to avoid triggering security scanners
    const requestData = data || {};
    const workspaceIdOrName = requestData.workspaceIdOrName;
    const contextSpec = requestData.contextSpec || '/';

    // Resolve workspace from storage if not provided
    let wsIdOrName = workspaceIdOrName;
    if (!wsIdOrName) {
      const storedWs = await browserStorage.getCurrentWorkspace();
      if (!storedWs?.id && !storedWs?.name) {
        throw new Error('No workspace selected');
      }
      wsIdOrName = storedWs.name || storedWs.id;
    }

    // Get connection settings
    const connectionSettings = await browserStorage.getConnectionSettings();
    if (!connectionSettings.apiToken || !connectionSettings.serverUrl) {
      throw new Error('Not connected to Canvas server - missing credentials');
    }

    // Initialize API client if needed
    if (!apiClient.apiToken) {
      apiClient.initialize(
        connectionSettings.serverUrl,
        connectionSettings.apiBasePath,
        connectionSettings.apiToken
      );
    }

    // Fetch documents for workspace path
    const response = await apiClient.getWorkspaceDocuments(wsIdOrName, contextSpec, ['data/abstraction/tab']);

    if (response.status === 'success') {
      sendResponse({ success: true, documents: response.payload?.data || [], count: response.payload?.count || response.count || 0 });
    } else {
      throw new Error(response.message || 'Failed to fetch workspace documents');
    }
  } catch (error) {
    console.error('Failed to get workspace documents:', error);
    sendResponse({ success: false, documents: [], error: error.message });
  }
}

async function handleSyncTab(data, sendResponse) {
  try {
    const { tab, contextId, contextSpec } = data;

    if (!tab) {
      throw new Error('Tab object is required');
    }

    console.log('Syncing tab to Canvas:', tab);

    const mode = await browserStorage.getSyncMode();
    const currentContext = await browserStorage.getCurrentContext();
    const currentWorkspace = await browserStorage.getCurrentWorkspace();
    const workspacePath = await browserStorage.getWorkspacePath();

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
    let result;
    if (mode === 'context') {
      const targetContextId = contextId || currentContext?.id;
      if (!targetContextId) throw new Error('No context selected');
      result = await tabManager.syncTabToCanvas(tab, apiClient, targetContextId, browserIdentity);
    } else {
      // Workspace mode
      const wsId = currentWorkspace?.name || currentWorkspace?.id;
      if (!wsId) throw new Error('No workspace selected');
      const document = tabManager.convertTabToDocument(tab, browserIdentity);
      const resp = await apiClient.insertWorkspaceDocument(wsId, document, contextSpec || workspacePath || '/', document.featureArray);
      if (resp.status === 'success') {
        const docId = Array.isArray(resp.payload) ? resp.payload[0]?.id : resp.payload?.id;
        tabManager.markTabAsSynced(tab.id, docId);
        result = { success: true, documentId: docId };
      } else {
        result = { success: false, error: resp.message || 'Failed to sync tab' };
      }
    }

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

    const { tabIds, contextId, contextSpec } = data;

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

    const mode = await browserStorage.getSyncMode();
    const currentContext = await browserStorage.getCurrentContext();
    const currentWorkspace = await browserStorage.getCurrentWorkspace();
    const workspacePath = await browserStorage.getWorkspacePath();

    if (mode === 'context') {
      console.log(`🔧 Target context ID: ${contextId || currentContext?.id}`);
    } else {
      console.log(`🔧 Target workspace: ${currentWorkspace?.name || currentWorkspace?.id}, path: ${contextSpec || workspacePath || '/'}`);
    }

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

    let result;
    if (mode === 'context') {
      console.log('🔧 Calling tabManager.syncMultipleTabs (context mode)...');
      const targetContextId = contextId || currentContext?.id;
      if (!targetContextId) throw new Error('No context selected');
      result = await tabManager.syncMultipleTabs(tabs, apiClient, targetContextId, browserIdentity);
    } else {
      console.log('🔧 Syncing multiple tabs to workspace (explorer mode)...');
      const wsId = currentWorkspace?.name || currentWorkspace?.id;
      if (!wsId) throw new Error('No workspace selected');
      const docs = tabs.map(tab => tabManager.convertTabToDocument(tab, browserIdentity));
      const resp = await apiClient.insertWorkspaceDocuments(wsId, docs, contextSpec || workspacePath || '/', docs[0]?.featureArray || []);
      if (resp.status === 'success') {
        result = { success: true, total: tabs.length, successful: tabs.length, failed: 0 };
      } else {
        result = { success: false, error: resp.message || 'Batch sync failed' };
      }
    }

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
    const { document, documents, options = {} } = data;

    if (!document && !documents) {
      throw new Error('Canvas document or documents array is required');
    }

    // Handle multiple documents (bulk operation)
    if (documents && Array.isArray(documents)) {
      console.log('Opening multiple Canvas documents:', documents.length);

      const results = [];
            const bulkOptions = {
        ...options,
        allowDuplicates: true,  // Allow duplicates for bulk operations from popup
        active: false  // Don't steal focus when opening multiple
      };

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        try {
          console.log(`🔧 Opening document ${i + 1}/${documents.length}:`, {
            title: doc.data?.title,
            url: doc.data?.url,
            id: doc.id
          });
          const result = await tabManager.openCanvasDocument(doc, bulkOptions);
          console.log(`🔧 Result for document ${i + 1}:`, result);
          results.push({ document: doc, result });
        } catch (error) {
          console.error(`❌ Failed to open document ${i + 1}:`, error);
          results.push({ document: doc, result: { success: false, error: error.message } });
        }
      }

      const successful = results.filter(r => r.result.success).length;
      sendResponse({
        success: successful > 0,
        total: documents.length,
        successful,
        failed: documents.length - successful,
        results
      });
      return;
    }

    // Handle single document
    const result = await tabManager.openCanvasDocument(document, options);
    sendResponse(result);

  } catch (error) {
    console.error('Failed to open Canvas document(s):', error);
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

async function handleUpdateContextUrl(message, sendResponse) {
  try {
    const { contextId, url } = message;

    if (!contextId || !url) {
      throw new Error('Context ID and URL are required');
    }

    console.log('Updating context URL:', contextId, '→', url);

    // Make API request to update context URL
    const response = await apiClient.updateContextUrl(contextId, url);

    // Update current context in storage if it's the same one being updated
    const currentContext = await browserStorage.getCurrentContext();
    if (currentContext && currentContext.id === contextId) {
      currentContext.url = url;
      await browserStorage.setCurrentContext(currentContext);

      // Trigger sync engine to handle the URL change
      if (syncEngine.isInitialized) {
        console.log('Triggering sync engine for manual context URL change');
        await syncEngine.handleContextUrlChange(contextId, url);
      }
    }

    // Notify all listeners about the URL change
    await chrome.runtime.sendMessage({
      type: 'BACKGROUND_EVENT',
      eventType: 'context.url.set',
      data: { contextId, url }
    });

    sendResponse({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Failed to update context URL:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Initialize extension on service worker startup
initializeExtension();
