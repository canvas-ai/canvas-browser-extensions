// Sync Engine module for Canvas Extension
// Coordinates synchronization between browser tabs and Canvas server

import { browserStorage } from './browser-storage.js';
import { apiClient } from './api-client.js';
import { tabManager } from './tab-manager.js';
import { webSocketClient } from './websocket-client.js';

export class SyncEngine {
  constructor() {
    this.isInitialized = false;
    this.syncInProgress = false;
    this.lastSyncTime = null;
    this.syncQueue = [];
    this.autoSyncEnabled = false;
    this.syncInterval = null;
    this.syncIntervalMs = 30000; // 30 seconds
  }

  // Initialize sync engine
  async initialize() {
    try {
      console.log('SyncEngine: Initializing...');

      // Load sync settings
      const syncSettings = await browserStorage.getSyncSettings();
      const connectionSettings = await browserStorage.getConnectionSettings();
      const currentContext = await browserStorage.getCurrentContext();

      // Check if we can initialize
      if (!connectionSettings.connected || !connectionSettings.apiToken) {
        console.log('SyncEngine: Cannot initialize - not connected');
        return false;
      }

      if (!currentContext?.id) {
        console.log('SyncEngine: Cannot initialize - no context bound');
        return false;
      }

      // Initialize API client
      if (!apiClient.apiToken) {
        apiClient.initialize(
          connectionSettings.serverUrl,
          connectionSettings.apiBasePath,
          connectionSettings.apiToken
        );
      }

      // Setup WebSocket event handlers for real-time sync
      this.setupWebSocketHandlers();

      // Perform initial sync
      await this.performFullSync(currentContext.id);

      // Start auto-sync if enabled
      if (syncSettings.autoSyncNewTabs) {
        this.startAutoSync();
      }

      this.isInitialized = true;
      console.log('SyncEngine: Initialized successfully');
      return true;
    } catch (error) {
      console.error('SyncEngine: Failed to initialize:', error);
      return false;
    }
  }

  // Setup WebSocket event handlers
  setupWebSocketHandlers() {
    // Listen for real-time document events
    webSocketClient.on('tab.event', async (eventData) => {
      await this.handleWebSocketEvent(eventData);
    });

    webSocketClient.on('context.changed', async (eventData) => {
      // Re-sync when context changes
      await this.performFullSync(eventData.contextId);
    });
  }

  // Handle WebSocket events
  async handleWebSocketEvent(eventData) {
    try {
      console.log('SyncEngine: Handling WebSocket event:', eventData.type);

      const syncSettings = await browserStorage.getSyncSettings();

      switch (eventData.type) {
        case 'document.inserted':
          await this.handleRemoteDocumentInserted(eventData, syncSettings);
          break;

        case 'document.removed':
        case 'document.removed.batch':
          await this.handleRemoteDocumentRemoved(eventData, syncSettings);
          break;

        case 'document.deleted':
        case 'document.deleted.batch':
          await this.handleRemoteDocumentDeleted(eventData, syncSettings);
          break;
      }
    } catch (error) {
      console.error('SyncEngine: Failed to handle WebSocket event:', error);
    }
  }

  // Handle remote document insertion (tab added from another client)
  async handleRemoteDocumentInserted(eventData, syncSettings) {
    if (!syncSettings.autoOpenNewTabs) {
      console.log('SyncEngine: Auto-open disabled, skipping remote document');
      return;
    }

    const documents = eventData.documents || [eventData.document];

    for (const document of documents) {
      if (document.schema === 'data/abstraction/tab' && document.data?.url) {
        // Check if we should open this tab (filter by browser identity if enabled)
        if (syncSettings.syncOnlyThisBrowser) {
          const browserIdentity = await browserStorage.getBrowserIdentity();
          const hasOurFeature = document.featureArray?.includes(`tag/${browserIdentity}`);

          if (hasOurFeature) {
            console.log('SyncEngine: Skipping tab from same browser instance');
            continue;
          }
        }

        // Check if tab is already open
        const existingTabs = await tabManager.findDuplicateTabs(document.data.url);

        if (existingTabs.length === 0) {
          console.log('SyncEngine: Opening new tab from Canvas:', document.data.title);
          await tabManager.openCanvasDocument(document, { active: false });
        }
      }
    }
  }

  // Handle remote document removal
  async handleRemoteDocumentRemoved(eventData, syncSettings) {
    if (!syncSettings.autoCloseRemovedTabs) {
      console.log('SyncEngine: Auto-close disabled, skipping remote removal');
      return;
    }

    // Note: This is limited since we don't track document IDs in browser tabs
    // We'd need to enhance tab tracking for full functionality
    console.log('SyncEngine: Would close tabs for removed documents:', eventData.documentIds || [eventData.documentId]);
  }

  // Handle remote document deletion
  async handleRemoteDocumentDeleted(eventData, syncSettings) {
    // Same as removal for now
    await this.handleRemoteDocumentRemoved(eventData, syncSettings);
  }

  // Start automatic synchronization
  startAutoSync() {
    console.log('SyncEngine: Starting auto-sync...');

    this.autoSyncEnabled = true;

    // Clear existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Start periodic sync
    this.syncInterval = setInterval(async () => {
      if (!this.syncInProgress && this.isInitialized) {
        try {
          const currentContext = await browserStorage.getCurrentContext();
          if (currentContext?.id) {
            console.log('SyncEngine: Performing periodic sync...');
            await this.performIncrementalSync(currentContext.id);
          }
        } catch (error) {
          console.error('SyncEngine: Auto-sync failed:', error);
        }
      }
    }, this.syncIntervalMs);
  }

  // Stop automatic synchronization
  stopAutoSync() {
    console.log('SyncEngine: Stopping auto-sync...');

    this.autoSyncEnabled = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Sync a single tab to Canvas
  async syncTabToCanvas(tabId, contextId) {
    try {
      console.log('SyncEngine: Syncing single tab to Canvas:', tabId);

      const tab = await tabManager.getTab(tabId);
      if (!tab) {
        throw new Error('Tab not found');
      }

      const browserIdentity = await browserStorage.getBrowserIdentity();
      const result = await tabManager.syncTabToCanvas(tab, apiClient, contextId, browserIdentity);

      if (result.success) {
        this.lastSyncTime = new Date().toISOString();
      }

      return result;
    } catch (error) {
      console.error('SyncEngine: Failed to sync tab to Canvas:', error);
      return { success: false, error: error.message };
    }
  }

  // Sync multiple tabs to Canvas
  async syncTabsToCanvas(tabIds, contextId) {
    try {
      console.log('SyncEngine: Syncing multiple tabs to Canvas:', tabIds.length);

      const tabs = [];
      for (const tabId of tabIds) {
        const tab = await tabManager.getTab(tabId);
        if (tab) {
          tabs.push(tab);
        }
      }

      if (tabs.length === 0) {
        throw new Error('No valid tabs found');
      }

      const browserIdentity = await browserStorage.getBrowserIdentity();
      const result = await tabManager.syncMultipleTabs(tabs, apiClient, contextId, browserIdentity);

      if (result.success) {
        this.lastSyncTime = new Date().toISOString();
      }

      return result;
    } catch (error) {
      console.error('SyncEngine: Failed to sync multiple tabs to Canvas:', error);
      return { success: false, error: error.message };
    }
  }

  // Open Canvas document as browser tab
  async openCanvasTabInBrowser(documentId) {
    try {
      console.log('SyncEngine: Opening Canvas tab in browser:', documentId);

      const currentContext = await browserStorage.getCurrentContext();
      if (!currentContext?.id) {
        throw new Error('No context selected');
      }

      // Get Canvas documents to find the one we want
      const response = await apiClient.getContextDocuments(currentContext.id, ['data/abstraction/tab']);
      if (!response.success) {
        throw new Error('Failed to get Canvas documents');
      }

      const document = response.payload.find(doc => doc.id === documentId);
      if (!document) {
        throw new Error('Canvas document not found');
      }

      const result = await tabManager.openCanvasDocument(document);
      return result;
    } catch (error) {
      console.error('SyncEngine: Failed to open Canvas tab in browser:', error);
      return { success: false, error: error.message };
    }
  }

  // Open multiple Canvas documents as browser tabs
  async openCanvasTabsInBrowser(documentIds) {
    try {
      console.log('SyncEngine: Opening multiple Canvas tabs in browser:', documentIds.length);

      const results = [];

      for (const documentId of documentIds) {
        const result = await this.openCanvasTabInBrowser(documentId);
        results.push({ documentId, result });
      }

      const successful = results.filter(r => r.result.success).length;

      return {
        success: successful > 0,
        total: documentIds.length,
        successful,
        failed: documentIds.length - successful,
        results
      };
    } catch (error) {
      console.error('SyncEngine: Failed to open multiple Canvas tabs:', error);
      return { success: false, error: error.message };
    }
  }

  // Remove tab from Canvas context
  async removeTabFromContext(documentId, contextId) {
    try {
      console.log('SyncEngine: Removing tab from context:', documentId);

      const response = await apiClient.removeDocument(contextId, documentId);

      if (response.success) {
        this.lastSyncTime = new Date().toISOString();
      }

      return response;
    } catch (error) {
      console.error('SyncEngine: Failed to remove tab from context:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete tab from Canvas database
  async deleteTabFromDatabase(documentId, contextId) {
    try {
      console.log('SyncEngine: Deleting tab from database:', documentId);

      const response = await apiClient.deleteDocument(contextId, documentId);

      if (response.success) {
        this.lastSyncTime = new Date().toISOString();
      }

      return response;
    } catch (error) {
      console.error('SyncEngine: Failed to delete tab from database:', error);
      return { success: false, error: error.message };
    }
  }

  // Full synchronization between browser and Canvas
  async performFullSync(contextId) {
    try {
      console.log('SyncEngine: Performing full synchronization...');

      this.syncInProgress = true;

      // Get browser tabs
      const browserTabs = await tabManager.getSyncableTabs();
      console.log('SyncEngine: Found browser tabs:', browserTabs.length);

      // Get Canvas documents
      const syncSettings = await browserStorage.getSyncSettings();
      let featureArray = ['data/abstraction/tab'];

      // Filter by browser identity if enabled
      if (syncSettings.syncOnlyThisBrowser) {
        const browserIdentity = await browserStorage.getBrowserIdentity();
        featureArray.push(`tag/${browserIdentity}`);
      }

      const response = await apiClient.getContextDocuments(contextId, featureArray);
      const canvasDocuments = response.success ? response.payload : [];
      console.log('SyncEngine: Found Canvas documents:', canvasDocuments.length);

      // Compare and identify sync needs
      const comparison = tabManager.compareWithCanvasDocuments(browserTabs, canvasDocuments);

      console.log('SyncEngine: Sync comparison:', {
        browserToCanvas: comparison.browserToCanvas.length,
        canvasToBrowser: comparison.canvasToBrowser.length,
        synced: comparison.synced.length
      });

      // Sync browser tabs to Canvas (if auto-sync enabled)
      if (syncSettings.autoSyncNewTabs && comparison.browserToCanvas.length > 0) {
        console.log('SyncEngine: Auto-syncing browser tabs to Canvas...');
        const browserIdentity = await browserStorage.getBrowserIdentity();
        await tabManager.syncMultipleTabs(comparison.browserToCanvas, apiClient, contextId, browserIdentity);
      }

      // Open Canvas tabs in browser (if auto-open enabled)
      if (syncSettings.autoOpenNewTabs && comparison.canvasToBrowser.length > 0) {
        console.log('SyncEngine: Auto-opening Canvas tabs in browser...');
        for (const document of comparison.canvasToBrowser) {
          await tabManager.openCanvasDocument(document, { active: false });
        }
      }

      this.lastSyncTime = new Date().toISOString();
      console.log('SyncEngine: Full synchronization completed');

      return {
        success: true,
        browserToCanvas: comparison.browserToCanvas.length,
        canvasToBrowser: comparison.canvasToBrowser.length,
        synced: comparison.synced.length
      };

    } catch (error) {
      console.error('SyncEngine: Full sync failed:', error);
      return { success: false, error: error.message };
    } finally {
      this.syncInProgress = false;
    }
  }

  // Incremental synchronization (lighter than full sync)
  async performIncrementalSync(contextId) {
    try {
      console.log('SyncEngine: Performing incremental synchronization...');

      // For now, incremental sync is the same as full sync
      // In the future, we could optimize this by tracking changes since last sync
      return await this.performFullSync(contextId);

    } catch (error) {
      console.error('SyncEngine: Incremental sync failed:', error);
      return { success: false, error: error.message };
    }
  }



  // Handle tab removal
  async handleTabRemoved(tabId) {
    try {
      console.log('SyncEngine: Handling tab removal:', tabId);

      // Clean up tracking
      tabManager.unmarkTabAsSynced(tabId);

    } catch (error) {
      console.error('SyncEngine: Failed to handle tab removal:', error);
    }
  }

  // Handle context change
  async handleContextChange(oldContextId, newContextId) {
    try {
      console.log('SyncEngine: Handling context change:', oldContextId, '->', newContextId);

      const syncSettings = await browserStorage.getSyncSettings();

      await this._executeContextChangeBehavior(syncSettings.contextChangeBehavior, oldContextId, newContextId);

    } catch (error) {
      console.error('SyncEngine: Failed to handle context change:', error);
    }
  }

  // Handle context URL change (treat as context change)
  async handleContextUrlChange(contextId, newUrl) {
    try {
      console.log('SyncEngine: Handling context URL change for context:', contextId, 'to URL:', newUrl);

      const syncSettings = await browserStorage.getSyncSettings();

      // For URL changes, we pass the same contextId as both old and new
      // since it's the same context but with different content
      await this._executeContextChangeBehavior(syncSettings.contextChangeBehavior, contextId, contextId);

    } catch (error) {
      console.error('SyncEngine: Failed to handle context URL change:', error);
    }
  }

  // Execute context change behavior based on settings
  async _executeContextChangeBehavior(behavior, oldContextId, newContextId) {
    try {
      console.log('SyncEngine: Executing context change behavior:', behavior);

      switch (behavior) {
        case 'close-open-new':
          await this.closeTabsNotInContext(newContextId);
          await this.performFullSync(newContextId);
          break;

        case 'save-close-open-new':
          if (oldContextId) {
            await this.syncAllBrowserTabs(oldContextId);
          }
          await this.closeTabsNotInContext(newContextId);
          await this.performFullSync(newContextId);
          break;

        case 'keep-open-new':
          await this.performFullSync(newContextId);
          break;

        case 'keep-only':
          // Do nothing - keep current tabs, don't open new ones
          break;

        default:
          console.warn('SyncEngine: Unknown context change behavior:', behavior);
          // Fallback to keep-open-new
          await this.performFullSync(newContextId);
      }

    } catch (error) {
      console.error('SyncEngine: Failed to execute context change behavior:', error);
    }
  }

  // Helper: Close all browser tabs
  async closeAllBrowserTabs() {
    const browserTabs = await tabManager.getSyncableTabs();
    for (const tab of browserTabs) {
      await tabManager.closeTab(tab.id);
    }
  }

  // Helper: Close tabs that are not in the specified context
  async closeTabsNotInContext(contextId) {
    try {
      console.log('SyncEngine: Closing tabs not in context:', contextId);

      // Get current browser tabs
      const browserTabs = await tabManager.getSyncableTabs();
      console.log('SyncEngine: Found browser tabs:', browserTabs.length);

      if (browserTabs.length === 0) {
        console.log('SyncEngine: No browser tabs to check');
        return;
      }

      // Get Canvas documents for the new context
      const syncSettings = await browserStorage.getSyncSettings();
      let featureArray = ['data/abstraction/tab'];

      // Filter by browser identity if enabled
      if (syncSettings.syncOnlyThisBrowser) {
        const browserIdentity = await browserStorage.getBrowserIdentity();
        featureArray.push(`tag/${browserIdentity}`);
      }

      const response = await apiClient.getContextDocuments(contextId, featureArray);
      const canvasDocuments = response.success ? response.payload : [];
      console.log('SyncEngine: Found Canvas documents in new context:', canvasDocuments.length);

      // Create a set of URLs that exist in the new context for fast lookup
      const contextUrls = new Set();
      canvasDocuments.forEach(doc => {
        if (doc.data && doc.data.url) {
          contextUrls.add(doc.data.url);
        }
      });

      console.log('SyncEngine: Context URLs:', Array.from(contextUrls));

      // Close tabs that are not in the new context
      let closedCount = 0;
      for (const tab of browserTabs) {
        if (!contextUrls.has(tab.url)) {
          console.log('SyncEngine: Closing tab not in context:', tab.title, tab.url);
          await tabManager.closeTab(tab.id);
          closedCount++;
        } else {
          console.log('SyncEngine: Keeping tab in context:', tab.title, tab.url);
        }
      }

      console.log('SyncEngine: Closed', closedCount, 'tabs not in context');

    } catch (error) {
      console.error('SyncEngine: Failed to close tabs not in context:', error);
      // Fallback to closing all tabs if we can't determine which ones to keep
      console.log('SyncEngine: Falling back to closing all tabs');
      await this.closeAllBrowserTabs();
    }
  }

  // Helper: Sync all browser tabs
  async syncAllBrowserTabs(contextId) {
    const browserTabs = await tabManager.getSyncableTabs();
    if (browserTabs.length > 0) {
      const browserIdentity = await browserStorage.getBrowserIdentity();
      await tabManager.syncMultipleTabs(browserTabs, apiClient, contextId, browserIdentity);
    }
  }

  // Get sync status
  getSyncStatus() {
    return {
      isInitialized: this.isInitialized,
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      queueSize: this.syncQueue.length,
      autoSyncEnabled: this.autoSyncEnabled,
      webSocketConnected: webSocketClient.isConnected()
    };
  }

  // Add item to sync queue
  addToSyncQueue(item) {
    this.syncQueue.push({
      ...item,
      timestamp: new Date().toISOString()
    });
  }

  // Process sync queue
  async processSyncQueue() {
    if (this.syncQueue.length === 0 || this.syncInProgress) {
      return;
    }

    console.log('SyncEngine: Processing sync queue:', this.syncQueue.length, 'items');

    const items = [...this.syncQueue];
    this.syncQueue = [];

    for (const item of items) {
      try {
        switch (item.type) {
          case 'sync-tab':
            await this.syncTabToCanvas(item.tabId, item.contextId);
            break;
          case 'open-document':
            await this.openCanvasTabInBrowser(item.documentId);
            break;
          default:
            console.warn('SyncEngine: Unknown queue item type:', item.type);
        }
      } catch (error) {
        console.error('SyncEngine: Failed to process queue item:', error);
      }
    }
  }

  // Clear sync queue
  clearSyncQueue() {
    this.syncQueue = [];
  }
}

// Create singleton instance
export const syncEngine = new SyncEngine();
export default syncEngine;
