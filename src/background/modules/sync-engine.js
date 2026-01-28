// Sync Engine module for Canvas Extension
// Coordinates synchronization between browser tabs and Canvas server
//
// BROWSER EXIT PREVENTION:
// This module includes a simple safety mechanism to prevent the browser from closing
// when context changes result in all tabs being closed:
// - wouldLeaveEmptyBrowser(): Checks if tab closures would leave browser empty
// - All tab closing methods open a new empty tab before closing if needed
// - Simple approach: just add a new tab if we'd end up with zero tabs

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
    this.pendingTabOpens = new Set(); // Track URLs being opened to prevent duplicates
    this.pendingFetches = new Map(); // Track pending document fetches to prevent duplicates
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
      if (syncSettings.sendNewTabsToCanvas) {
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

    // Listen for all workspace and context document events
    webSocketClient.on('document.inserted', async (eventData) => {
      await this.handleWebSocketEvent({ type: 'document.inserted', ...eventData });
    });

    webSocketClient.on('document.updated', async (eventData) => {
      await this.handleWebSocketEvent({ type: 'document.updated', ...eventData });
    });

    webSocketClient.on('document.removed', async (eventData) => {
      await this.handleWebSocketEvent({ type: 'document.removed', ...eventData });
    });

    webSocketClient.on('document.deleted', async (eventData) => {
      await this.handleWebSocketEvent({ type: 'document.deleted', ...eventData });
    });

    webSocketClient.on('document.removed.batch', async (eventData) => {
      await this.handleWebSocketEvent({ type: 'document.removed.batch', ...eventData });
    });

    webSocketClient.on('document.deleted.batch', async (eventData) => {
      await this.handleWebSocketEvent({ type: 'document.deleted.batch', ...eventData });
    });

    // Tree events (include contextSpec for workspace mode)
    webSocketClient.on('tree.document.inserted', async (eventData) => {
      await this.handleWebSocketEvent({ type: 'tree.document.inserted', ...eventData });
    });

    webSocketClient.on('tree.document.inserted.batch', async (eventData) => {
      await this.handleWebSocketEvent({ type: 'tree.document.inserted.batch', ...eventData });
    });

    webSocketClient.on('tree.document.updated', async (eventData) => {
      await this.handleWebSocketEvent({ type: 'tree.document.updated', ...eventData });
    });

    webSocketClient.on('tree.document.updated.batch', async (eventData) => {
      await this.handleWebSocketEvent({ type: 'tree.document.updated.batch', ...eventData });
    });

    webSocketClient.on('tree.document.removed', async (eventData) => {
      await this.handleWebSocketEvent({ type: 'tree.document.removed', ...eventData });
    });

    webSocketClient.on('tree.document.removed.batch', async (eventData) => {
      await this.handleWebSocketEvent({ type: 'tree.document.removed.batch', ...eventData });
    });

    webSocketClient.on('tree.document.deleted', async (eventData) => {
      await this.handleWebSocketEvent({ type: 'tree.document.deleted', ...eventData });
    });

    webSocketClient.on('tree.document.deleted.batch', async (eventData) => {
      await this.handleWebSocketEvent({ type: 'tree.document.deleted.batch', ...eventData });
    });

    // Context path change (when URL changes)
    webSocketClient.on('context.url.set', async (eventData) => {
      await this.handleContextUrlChanged(eventData);
    });

    // Context change (when switched to different context)
    webSocketClient.on('context.changed', async (eventData) => {
      await this.handleContextSwitched(eventData);
    });
  }

  // Handle WebSocket events
  async handleWebSocketEvent(eventData) {
    try {
      console.log('SyncEngine: Handling WebSocket event:', eventData.type, 'at', new Date().toISOString());
      console.log('SyncEngine: Event details:', {
        type: eventData.type,
        contextId: eventData.contextId,
        workspaceId: eventData.workspaceId,
        documentIds: eventData.documentIds || (eventData.document ? [eventData.document.id] : []),
        documentsCount: eventData.documents?.length || (eventData.document ? 1 : 0)
      });

      const syncSettings = await browserStorage.getSyncSettings();
      const mode = await browserStorage.getSyncMode();
      const currentContext = await browserStorage.getCurrentContext();
      const currentWorkspace = await browserStorage.getCurrentWorkspace();
      const workspacePath = await browserStorage.getWorkspacePath();

      // Check if this event is relevant to our current context/workspace
      const isRelevant = await this.isEventRelevant(eventData, mode, currentContext, currentWorkspace, workspacePath);
      if (!isRelevant) {
        console.log('SyncEngine: Event not relevant to current context/workspace, skipping');
        return;
      }

      console.log('SyncEngine: Event is relevant, processing...');

      switch (eventData.type) {
      case 'document.inserted':
      case 'tree.document.inserted':
      case 'tree.document.inserted.batch':
        await this.handleRemoteDocumentInserted(eventData, syncSettings);
        break;

      case 'document.updated':
      case 'tree.document.updated':
      case 'tree.document.updated.batch':
        await this.handleRemoteDocumentUpdated(eventData, syncSettings);
        break;

      case 'document.removed':
      case 'document.removed.batch':
      case 'tree.document.removed':
      case 'tree.document.removed.batch':
        await this.handleRemoteDocumentRemoved(eventData, syncSettings);
        break;

      case 'document.deleted':
      case 'document.deleted.batch':
      case 'tree.document.deleted':
      case 'tree.document.deleted.batch':
        await this.handleRemoteDocumentDeleted(eventData, syncSettings);
        break;
      }
    } catch (error) {
      console.error('SyncEngine: Failed to handle WebSocket event:', error);
    }
  }

  // Handle remote document insertion (tab added from another client)
  async handleRemoteDocumentInserted(eventData, syncSettings) {
    if (!syncSettings.openTabsAddedToCanvas) {
      console.log('SyncEngine: Auto-open disabled, skipping remote document');
      return;
    }

    console.log('SyncEngine: Processing document insertion event:', eventData.type, eventData);

    // Handle tree events differently - they have documentId(s) instead of full document
    if (eventData.type === 'tree.document.inserted' || eventData.type === 'tree.document.inserted.batch') {
      await this.handleTreeDocumentInserted(eventData, syncSettings);
      return;
    }

    // Handle regular document.inserted events
    const documents = eventData.documents || [eventData.document];
    const documentsToOpen = [];

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

        // Check if tab is already open or pending
        const existingTabs = await tabManager.findDuplicateTabs(document.data.url);
        const isPending = this.isPendingTabOpen(document.data.url);

        if (existingTabs.length === 0 && !isPending) {
          console.log('SyncEngine: Queuing tab for opening:', document.data.title);
          documentsToOpen.push(document);
          this.markPendingTabOpen(document.data.url);
        } else {
          console.log('SyncEngine: Tab already exists or pending:', document.data.url);
        }
      }
    }

    // Open all valid documents with rate limiting
    if (documentsToOpen.length > 0) {
      await this.openTabsWithRateLimit(documentsToOpen);

      // Clear pending flags after opening
      for (const document of documentsToOpen) {
        this.clearPendingTabOpen(document.data.url);
      }
    }
  }

  // Handle tree document insertion events (these have documentId/documentIds and contextSpec)
  async handleTreeDocumentInserted(eventData, syncSettings) {
    try {
      console.log('SyncEngine: Handling tree document insertion:', eventData);

      // Handle both single and batch tree events
      const isBatch = eventData.type === 'tree.document.inserted.batch';
      const documentIds = isBatch ? (eventData.documentIds || []) : [eventData.documentId];

      if (documentIds.length === 0) {
        console.log('SyncEngine: No documentId(s) in tree event, skipping');
        return;
      }

      console.log(`SyncEngine: Processing ${isBatch ? 'batch' : 'single'} tree event with ${documentIds.length} document(s)`);

      // We need to fetch the documents to check if they're tab documents
      const mode = await browserStorage.getSyncMode();
      const currentWorkspace = await browserStorage.getCurrentWorkspace();
      const workspacePath = await browserStorage.getWorkspacePath();

      if (mode === 'explorer' && currentWorkspace) {
        console.log('SyncEngine: Fetching documents for tree event in explorer mode');

        // Fetch documents from the workspace
        const wsId = currentWorkspace.name || currentWorkspace.id;
        const response = await apiClient.getWorkspaceDocuments(wsId, eventData.contextSpec || '/', ['data/abstraction/tab']);

        if (response.status === 'success') {
          const documents = response.payload || [];
          const documentsToOpen = [];

          // Process each document ID from the tree event
          for (const documentId of documentIds) {
            const document = documents.find(doc => doc.id === documentId);

            if (document && document.schema === 'data/abstraction/tab' && document.data?.url) {
              console.log('SyncEngine: Found tab document from tree event:', document.data.title);

              // Check if we should open this tab (filter by browser identity if enabled)
              if (syncSettings.syncOnlyThisBrowser) {
                const browserIdentity = await browserStorage.getBrowserIdentity();
                const hasOurFeature = document.featureArray?.includes(`tag/${browserIdentity}`);

                if (hasOurFeature) {
                  console.log('SyncEngine: Skipping tab from same browser instance (tree event)');
                  continue;
                }
              }

              // Check if tab is already open or pending
              const existingTabs = await tabManager.findDuplicateTabs(document.data.url);
              const isPending = this.isPendingTabOpen(document.data.url);

              if (existingTabs.length === 0 && !isPending) {
                console.log('SyncEngine: Queuing tab for opening from tree event:', document.data.title);
                documentsToOpen.push(document);
                this.markPendingTabOpen(document.data.url);
              } else {
                console.log('SyncEngine: Tab already exists or pending (tree event):', document.data.url);
              }
            } else {
              console.log('SyncEngine: Document from tree event is not a tab document:', documentId);
            }
          }

          // Open all valid documents with rate limiting
          if (documentsToOpen.length > 0) {
            console.log(`SyncEngine: Auto-opening ${documentsToOpen.length} tabs from tree event`);

            try {
              await this.openTabsWithRateLimit(documentsToOpen);
            } finally {
              // Clear pending flags after opening
              for (const document of documentsToOpen) {
                this.clearPendingTabOpen(document.data.url);
              }
            }
          }
        } else {
          console.log('SyncEngine: Failed to fetch documents for tree event:', response);
        }
      }
    } catch (error) {
      console.error('SyncEngine: Error handling tree document insertion:', error);
    }
  }

  // Handle remote document removal
  async handleRemoteDocumentRemoved(eventData, syncSettings) {
    if (!syncSettings.closeTabsRemovedFromCanvas) {
      console.log('SyncEngine: Auto-close disabled, skipping remote removal');
      return;
    }

    try {
      console.log('SyncEngine: Processing document removal:', eventData);

      // Get document IDs to remove
      const documentIds = eventData.documentIds ||
                         (eventData.documentId ? [eventData.documentId] : []) ||
                         (eventData.documents ? eventData.documents.map(d => d.id) : []);

      // Get documents with URLs if available
      const documents = eventData.documents ||
                       (eventData.document ? [eventData.document] : []);

      // Collect URLs to close
      const urlsToClose = new Set();

      // Add URLs from document data if available
      for (const doc of documents) {
        if (doc.data?.url) {
          urlsToClose.add(doc.data.url);
        }
      }

      // If we have URLs, close matching tabs
      if (urlsToClose.size > 0) {
        console.log('SyncEngine: Closing tabs for removed documents:', Array.from(urlsToClose));

        // Get all browser tabs
        const browserTabs = await tabManager.getAllTabs();

        // Find and close tabs matching the removed document URLs
        for (const tab of browserTabs) {
          if (urlsToClose.has(tab.url)) {
            console.log('SyncEngine: Closing tab:', tab.title, tab.url);
            await tabManager.closeTab(tab.id);
          }
        }
      } else {
        console.log('SyncEngine: No URLs found in removal event, cannot close tabs');
      }
    } catch (error) {
      console.error('SyncEngine: Failed to handle document removal:', error);
    }
  }

  // Handle remote document updated
  async handleRemoteDocumentUpdated(eventData, syncSettings) {
    console.log('SyncEngine: Document updated:', eventData);
    // For now, just log - we could update tab titles/URLs in the future
  }

  // Handle remote document deletion
  async handleRemoteDocumentDeleted(eventData, syncSettings) {
    // Same as removal for now
    await this.handleRemoteDocumentRemoved(eventData, syncSettings);
  }

  // Check if an event is relevant to our current context/workspace
  async isEventRelevant(eventData, mode, currentContext, currentWorkspace, workspacePath) {
    try {
      if (mode === 'context') {
        // Context mode: check if event relates to our current context
        const eventContextId = eventData.contextId || eventData.id;
        return eventContextId === currentContext?.id;
      } else {
        // Workspace mode: check if event relates to our current workspace and path
        const eventWorkspaceId = eventData.workspaceId || eventData.id;

        // For tree events, contextSpec is directly in the event data
        // For regular document events, it might be nested or default to '/'
        const eventContextSpec = eventData.contextSpec || '/';

        // Check workspace match
        const workspaceMatch = eventWorkspaceId === (currentWorkspace?.id || currentWorkspace?.name);

        // Check path match (document events should include contextSpec)
        // For tree events, we get exact contextSpec, so we can do precise matching
        const pathMatch = workspacePath ? eventContextSpec === workspacePath : true;

        console.log('SyncEngine: Event relevance check:', {
          eventType: eventData.type,
          eventWorkspaceId,
          currentWorkspaceId: currentWorkspace?.id,
          currentWorkspaceName: currentWorkspace?.name,
          eventContextSpec,
          workspacePath,
          workspaceMatch,
          pathMatch,
          relevant: workspaceMatch && pathMatch
        });

        return workspaceMatch && pathMatch;
      }
    } catch (error) {
      console.error('SyncEngine: Error checking event relevance:', error);
      return false;
    }
  }

  // Handle context URL change
  async handleContextUrlChanged(eventData) {
    try {
      console.log('SyncEngine: Context URL changed:', eventData);

      const currentContext = await browserStorage.getCurrentContext();
      if (currentContext?.id === eventData.id) {
        console.log('SyncEngine: Our context URL changed from', currentContext.url, 'to', eventData.url);

        // Update stored context
        currentContext.url = eventData.url;
        await browserStorage.setCurrentContext(currentContext);

        // Handle as context path change
        await this.handleContextUrlChange(eventData.id, eventData.url);
      }
    } catch (error) {
      console.error('SyncEngine: Failed to handle context URL change:', error);
    }
  }

  // Handle context switch
  async handleContextSwitched(eventData) {
    try {
      console.log('SyncEngine: Context switched:', eventData);

      const currentContext = await browserStorage.getCurrentContext();
      if (currentContext?.id !== eventData.contextId) {
        // This is a new context, handle the switch
        await this.handleContextChange(currentContext?.id, eventData.contextId);
      }
    } catch (error) {
      console.error('SyncEngine: Failed to handle context switch:', error);
    }
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
      const syncSettings = await browserStorage.getSyncSettings();
      const result = await tabManager.syncMultipleTabs(tabs, apiClient, contextId, browserIdentity, syncSettings);

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
      if (response.status !== 'success') {
        throw new Error('Failed to get Canvas documents');
      }

      const documents = response.payload || [];
      const document = documents.find(doc => doc.id === documentId);
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

      if (response.status === 'success') {
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

      if (response.status === 'success') {
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
      const featureArray = ['data/abstraction/tab'];

      // Filter by browser identity if enabled
      if (syncSettings.syncOnlyThisBrowser) {
        const browserIdentity = await browserStorage.getBrowserIdentity();
        featureArray.push(`tag/${browserIdentity}`);
      }

      const response = await apiClient.getContextDocuments(contextId, featureArray);
      const canvasDocuments = (response.status === 'success') ? (response.payload || []) : [];
      console.log('SyncEngine: Found Canvas documents:', canvasDocuments.length, 'total:', response.totalCount || 'unknown');

      // Check for pagination - warn if we might have incomplete data
      if (response.totalCount && response.count && response.totalCount > response.count) {
        console.warn('SyncEngine: Pagination detected - only got', response.count, 'of', response.totalCount, 'documents. Full sync may be incomplete.');
      }

      // Compare and identify sync needs
      const comparison = tabManager.compareWithCanvasDocuments(browserTabs, canvasDocuments, syncSettings);

      console.log('SyncEngine: Sync comparison:', {
        browserToCanvas: comparison.browserToCanvas.length,
        canvasToBrowser: comparison.canvasToBrowser.length,
        synced: comparison.synced.length
      });

      // Sync browser tabs to Canvas (if auto-sync enabled)
      if (syncSettings.sendNewTabsToCanvas && comparison.browserToCanvas.length > 0) {
        console.log('SyncEngine: Auto-syncing browser tabs to Canvas...');
        const browserIdentity = await browserStorage.getBrowserIdentity();
        await tabManager.syncMultipleTabs(comparison.browserToCanvas, apiClient, contextId, browserIdentity, syncSettings);
      }

      // Open Canvas tabs in browser (if auto-open enabled)
      if (syncSettings.openTabsAddedToCanvas && comparison.canvasToBrowser.length > 0) {
        console.log('SyncEngine: Auto-opening Canvas tabs in browser...');
        await this.openTabsWithRateLimit(comparison.canvasToBrowser);
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

      // Always fetch documents when switching contexts
      console.log('SyncEngine: Context switched - will fetch documents and apply behavior:', syncSettings.contextChangeBehavior);

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
      const mode = await browserStorage.getSyncMode();

      // Always fetch documents when context URL changes
      console.log('SyncEngine: Context URL changed - will fetch documents and apply behavior:', syncSettings.contextChangeBehavior);

      // For URL changes in context mode, we need to fetch and handle documents
      // according to the contextChangeBehavior setting
      if (mode === 'context') {
        await this._executeContextChangeBehavior(syncSettings.contextChangeBehavior, contextId, contextId, true);
      }

    } catch (error) {
      console.error('SyncEngine: Failed to handle context URL change:', error);
    }
  }

  // Determine the appropriate context change behavior based on sync settings
  async _determineContextChangeBehavior(syncSettings) {
    const explicitBehavior = syncSettings.contextChangeBehavior;

    // If user has explicitly set a behavior, use it
    if (explicitBehavior && explicitBehavior !== 'keep-only') {
      return explicitBehavior;
    }

    // Auto-determine behavior based on individual sync settings
    const shouldClose = syncSettings.closeTabsRemovedFromCanvas;
    const shouldOpen = syncSettings.openTabsAddedToCanvas;
    const shouldSave = syncSettings.sendNewTabsToCanvas;

    if (shouldSave && shouldClose && shouldOpen) {
      return 'save-close-open-new';
    } else if (shouldClose && shouldOpen) {
      return 'close-open-new';
    } else if (shouldOpen) {
      return 'keep-open-new';
    } else {
      return 'keep-only';
    }
  }

  // Execute context change behavior based on settings
  async _executeContextChangeBehavior(behavior, oldContextId, newContextId, isUrlChange = false) {
    try {
      const syncSettings = await browserStorage.getSyncSettings();

      // Determine actual behavior based on settings
      const actualBehavior = await this._determineContextChangeBehavior(syncSettings);
      console.log('SyncEngine: Executing context change behavior:', actualBehavior, 'isUrlChange:', isUrlChange, 'fromExplicitSetting:', behavior === actualBehavior);

      const mode = await browserStorage.getSyncMode();
      const currentWorkspace = await browserStorage.getCurrentWorkspace();
      const workspacePath = await browserStorage.getWorkspacePath();

      // For URL changes or context switches, we always need to fetch documents
      const shouldFetchDocuments = isUrlChange || (oldContextId !== newContextId);

      if (shouldFetchDocuments) {
        console.log('SyncEngine: Will fetch documents from backend for context:', newContextId);
      }

      const closeTabsForContextChange = async () => {
        // In context mode we can preserve tabs that are already part of the target context.
        // This matches the desired UX: close tabs not in context (except pinned), not "nuke everything".
        if (mode === 'context' && newContextId) return await this.closeTabsNotInContext(newContextId);
        return await this.closeCurrentTabs();
      };

      switch (actualBehavior) {
      case 'close-open-new':
        if (shouldFetchDocuments) {
          await closeTabsForContextChange();
          await this.fetchAndOpenNewTabs(mode, newContextId, currentWorkspace, workspacePath);
        }
        break;

      case 'save-close-open-new':
        if (oldContextId && mode === 'context') {
          await this.syncAllBrowserTabs(oldContextId);
        } else if (mode === 'explorer' && currentWorkspace) {
          await this.syncAllBrowserTabsToWorkspace(currentWorkspace, workspacePath);
        }
        if (shouldFetchDocuments) {
          await closeTabsForContextChange();
          await this.fetchAndOpenNewTabs(mode, newContextId, currentWorkspace, workspacePath);
        }
        break;

      case 'keep-open-new':
        if (shouldFetchDocuments) {
          await this.fetchAndOpenNewTabs(mode, newContextId, currentWorkspace, workspacePath);
        }
        break;

      case 'keep-only':
        // Do nothing - keep current tabs, don't open new ones
        // But still update our internal indexes
        await this.updateInternalIndexes(mode, newContextId, currentWorkspace, workspacePath);
        console.log('SyncEngine: Keep-only mode - preserving current tabs, not fetching new ones');
        break;

      default:
        console.warn('SyncEngine: Unknown context change behavior:', actualBehavior);
        // Fallback to close-open-new
        if (shouldFetchDocuments) {
          await this.closeCurrentTabs();
          await this.fetchAndOpenNewTabs(mode, newContextId, currentWorkspace, workspacePath);
        }
      }

    } catch (error) {
      console.error('SyncEngine: Failed to execute context change behavior:', error);
    }
  }

  // Helper: Close all browser tabs (with safety to prevent browser exit)
  async closeAllBrowserTabs() {
    const browserTabs = await tabManager.getSyncableTabs();

    // Safety: If closing all tabs would leave browser empty, open a new tab first
    if (await this.wouldLeaveEmptyBrowser(browserTabs)) {
      console.log('SyncEngine: Would close all tabs - opening new tab to prevent browser exit');
      await tabManager.openTab('chrome://newtab/', { active: false });
    }

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
      const featureArray = ['data/abstraction/tab'];

      // Filter by browser identity if enabled
      if (syncSettings.syncOnlyThisBrowser) {
        const browserIdentity = await browserStorage.getBrowserIdentity();
        featureArray.push(`tag/${browserIdentity}`);
      }

      const response = await apiClient.getContextDocuments(contextId, featureArray);
      const canvasDocuments = (response.status === 'success') ? (response.payload || []) : [];
      console.log('SyncEngine: Found Canvas documents in new context:', canvasDocuments.length, 'total:', response.totalCount || 'unknown');

      // Check for pagination - warn if we might have incomplete data
      if (response.totalCount && response.count && response.totalCount > response.count) {
        console.warn('SyncEngine: Pagination detected in context switch - only got', response.count, 'of', response.totalCount, 'documents. Some tabs may not be closed.');
      }

      // Create a set of URLs that exist in the new context for fast lookup
      const contextUrls = new Set();
      canvasDocuments.forEach(doc => {
        if (doc.data && doc.data.url) {
          contextUrls.add(doc.data.url);
        }
      });

      console.log('SyncEngine: Context URLs:', Array.from(contextUrls));

      // Get pinned tabs (by URL) to avoid closing them
      const pinnedUrls = await browserStorage.getPinnedTabUrls();
      console.log('SyncEngine: Pinned tabs (URLs):', Array.from(pinnedUrls));

      // Collect tabs that would be closed (not in context and not pinned)
      const tabsToClose = [];
      for (const tab of browserTabs) {
        if (!contextUrls.has(tab.url) && !pinnedUrls.has(tab.url)) {
          tabsToClose.push(tab);
        }
      }

      // Safety: If closing these tabs would leave browser empty, open a new tab first
      if (await this.wouldLeaveEmptyBrowser(tabsToClose)) {
        console.log('SyncEngine: Would close all tabs not in context - opening new tab to prevent browser exit');
        await tabManager.openTab('chrome://newtab/', { active: false });
      }

      // Close tabs that are not in the new context
      let closedCount = 0;
      for (const tab of tabsToClose) {
        console.log('SyncEngine: Closing tab not in context:', tab.title, tab.url);
        await tabManager.closeTab(tab.id);
        closedCount++;
      }

      // Log summary of what was kept vs closed
      for (const tab of browserTabs) {
        if (contextUrls.has(tab.url)) {
          console.log('SyncEngine: Keeping tab in context:', tab.title, tab.url);
        } else if (pinnedUrls.has(tab.url)) {
          console.log('SyncEngine: Keeping pinned tab (not closing):', tab.title, tab.url);
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

  // Helper: Sync all browser tabs to context
  async syncAllBrowserTabs(contextId) {
    const browserTabs = await tabManager.getSyncableTabs();
    if (browserTabs.length > 0) {
      const browserIdentity = await browserStorage.getBrowserIdentity();
      const syncSettings = await browserStorage.getSyncSettings();
      await tabManager.syncMultipleTabs(browserTabs, apiClient, contextId, browserIdentity, syncSettings);
    }
  }

  // Helper: Sync all browser tabs to workspace
  async syncAllBrowserTabsToWorkspace(workspace, workspacePath) {
    const browserTabs = await tabManager.getSyncableTabs();
    if (browserTabs.length > 0) {
      const browserIdentity = await browserStorage.getBrowserIdentity();
      const syncSettings = await browserStorage.getSyncSettings();
      const wsId = workspace?.name || workspace?.id;
      if (wsId) {
        const docs = browserTabs.map(tab => tabManager.convertTabToDocument(tab, browserIdentity, syncSettings));
        await apiClient.insertWorkspaceDocuments(wsId, docs, workspacePath || '/', docs[0]?.featureArray || []);
      }
    }
  }

  // Helper: Close current tabs (with safety to prevent browser exit)
  async closeCurrentTabs() {
    const browserTabs = await tabManager.getSyncableTabs();
    const pinnedUrls = await browserStorage.getPinnedTabUrls();

    // Collect tabs to close (don't close pinned tabs)
    const tabsToClose = [];
    for (const tab of browserTabs) {
      if (!pinnedUrls.has(tab.url)) {
        tabsToClose.push(tab);
      }
    }

    // Safety: If closing these tabs would leave browser empty, open a new tab first
    if (await this.wouldLeaveEmptyBrowser(tabsToClose)) {
      console.log('SyncEngine: Would close all tabs - opening new tab to prevent browser exit');
      await tabManager.openTab('chrome://newtab/', { active: false });
    }

    // Close all the tabs
    for (const tab of tabsToClose) {
      console.log('SyncEngine: Closing tab:', tab.title, tab.url);
      await tabManager.closeTab(tab.id);
    }
  }

  // Helper: Fetch and open new tabs based on mode
  async fetchAndOpenNewTabs(mode, contextId, workspace, workspacePath) {
    try {
      // Create unique key for this fetch to prevent duplicates
      const fetchKey = mode === 'context'
        ? `context:${contextId}`
        : `workspace:${workspace?.name || workspace?.id}:${workspacePath || '/'}`;

      // Check if we're already fetching this
      if (this.pendingFetches.has(fetchKey)) {
        console.log('SyncEngine: Already fetching documents for', fetchKey, '- skipping duplicate request');
        return await this.pendingFetches.get(fetchKey);
      }

      console.log('SyncEngine: Starting document fetch for', fetchKey);

      // Create the fetch promise
      const fetchPromise = this._doFetchAndOpenTabs(mode, contextId, workspace, workspacePath);

      // Store it to prevent duplicates
      this.pendingFetches.set(fetchKey, fetchPromise);

      // Auto-cleanup after 5 seconds
      setTimeout(() => {
        this.pendingFetches.delete(fetchKey);
      }, 5000);

      return await fetchPromise;

    } catch (error) {
      console.error('SyncEngine: Failed to fetch and open new tabs:', error);
    }
  }

  // Internal method to actually fetch and open tabs
  async _doFetchAndOpenTabs(mode, contextId, workspace, workspacePath) {
    try {
      let documents = [];

      if (mode === 'context' && contextId) {
        console.log('SyncEngine: Fetching documents from context:', contextId);

        const syncSettings = await browserStorage.getSyncSettings();
        const featureArray = ['data/abstraction/tab'];

        if (syncSettings.syncOnlyThisBrowser) {
          const browserIdentity = await browserStorage.getBrowserIdentity();
          featureArray.push(`tag/${browserIdentity}`);
        }

        const response = await apiClient.getContextDocuments(contextId, featureArray);
        documents = (response.status === 'success') ? (response.payload || []) : [];
        console.log('SyncEngine: API response for context documents:', {
          success: response.status === 'success',
          documentCount: documents.length,
          totalCount: response.totalCount || 'unknown',
          count: response.count || 'unknown',
          urls: documents.map(d => d.data?.url).filter(Boolean)
        });

        // Check for pagination - warn if we might have incomplete data
        if (response.totalCount && response.count && response.totalCount > response.count) {
          console.warn('SyncEngine: Pagination detected in context document fetch - only got', response.count, 'of', response.totalCount, 'documents. Some tabs may not be opened.');
        }

      } else if (mode === 'explorer' && workspace) {
        console.log('SyncEngine: Fetching documents from workspace:', workspace.name || workspace.id, 'path:', workspacePath);

        const wsId = workspace.name || workspace.id;
        const response = await apiClient.getWorkspaceDocuments(wsId, workspacePath || '/', ['data/abstraction/tab']);
        documents = (response.status === 'success') ? (response.payload || []) : [];
        console.log('SyncEngine: API response for workspace documents:', {
          success: response.status === 'success',
          documentCount: documents.length,
          totalCount: response.totalCount || 'unknown',
          count: response.count || 'unknown',
          urls: documents.map(d => d.data?.url).filter(Boolean)
        });

        // Check for pagination - warn if we might have incomplete data
        if (response.totalCount && response.count && response.totalCount > response.count) {
          console.warn('SyncEngine: Pagination detected in workspace document fetch - only got', response.count, 'of', response.totalCount, 'documents. Some tabs may not be opened.');
        }
      }

      console.log('SyncEngine: Found', documents.length, 'documents to open');

      // Open documents as tabs with rate limiting for browser security
      const syncSettings = await browserStorage.getSyncSettings();
      console.log('SyncEngine: Sync settings:', {
        openTabsAddedToCanvas: syncSettings.openTabsAddedToCanvas,
        contextChangeBehavior: syncSettings.contextChangeBehavior
      });

      if (syncSettings.openTabsAddedToCanvas && documents.length > 0) {
        console.log('SyncEngine: Opening', documents.length, 'tabs with rate limiting');
        await this.openTabsWithRateLimit(documents);
      } else if (!syncSettings.openTabsAddedToCanvas) {
        console.log('SyncEngine: Auto-open is disabled, skipping tab opening');
      } else {
        console.log('SyncEngine: No documents to open');
      }

      return documents;

    } catch (error) {
      console.error('SyncEngine: Failed to fetch and open new tabs:', error);
      throw error;
    }
  }

  // Helper: Update internal indexes without opening tabs
  async updateInternalIndexes(mode, contextId, workspace, workspacePath) {
    try {
      // This would update any internal tracking without opening tabs
      console.log('SyncEngine: Updating internal indexes for mode:', mode);

      // For now, just log - in the future we might track document states
      if (mode === 'context' && contextId) {
        console.log('SyncEngine: Context mode, contextId:', contextId);
      } else if (mode === 'explorer' && workspace) {
        console.log('SyncEngine: Explorer mode, workspace:', workspace.name || workspace.id, 'path:', workspacePath);
      }

    } catch (error) {
      console.error('SyncEngine: Failed to update internal indexes:', error);
    }
  }

  // Helper: Check if closing specified tabs would leave the browser with zero tabs
  async wouldLeaveEmptyBrowser(tabsToClose) {
    try {
      // Get ALL browser tabs (not just syncable ones)
      const allTabs = await tabManager.getAllTabs();

      // Create a set of tab IDs that would be closed
      const closeTabIds = new Set(tabsToClose.map(tab => tab.id));

      // Count how many tabs would remain after closing
      const remainingTabs = allTabs.filter(tab => !closeTabIds.has(tab.id));

      console.log('SyncEngine: Browser safety check:', {
        totalTabs: allTabs.length,
        tabsToClose: tabsToClose.length,
        remainingTabs: remainingTabs.length
      });

      // If no tabs would remain, the browser would exit
      return remainingTabs.length === 0;

    } catch (error) {
      console.error('SyncEngine: Error checking browser safety:', error);
      // Err on the side of caution - assume we would leave it empty
      return true;
    }
  }

  // Handle workspace path change (for explorer mode)
  async handleWorkspacePathChange(workspace, oldPath, newPath) {
    try {
      console.log('SyncEngine: Handling workspace path change:', workspace?.name || workspace?.id, oldPath, '->', newPath);

      const syncSettings = await browserStorage.getSyncSettings();

      // Always fetch documents when workspace path changes
      console.log('SyncEngine: Workspace path changed - will fetch documents and apply behavior:', syncSettings.contextChangeBehavior);

      // Execute the same behavior as context changes
      await this._executeWorkspacePathChangeBehavior(syncSettings.contextChangeBehavior, workspace, oldPath, newPath);

    } catch (error) {
      console.error('SyncEngine: Failed to handle workspace path change:', error);
    }
  }

  // Execute workspace path change behavior
  async _executeWorkspacePathChangeBehavior(behavior, workspace, oldPath, newPath) {
    try {
      const syncSettings = await browserStorage.getSyncSettings();

      // Determine actual behavior based on settings
      const actualBehavior = await this._determineContextChangeBehavior(syncSettings);
      console.log('SyncEngine: Executing workspace path change behavior:', actualBehavior, 'fromExplicitSetting:', behavior === actualBehavior);

      const mode = await browserStorage.getSyncMode();
      const currentContext = await browserStorage.getCurrentContext();

      // Always fetch documents when path changes
      const shouldFetchDocuments = true;
      console.log('SyncEngine: Will fetch documents from backend for workspace:', workspace?.name || workspace?.id, 'path:', newPath);

      switch (actualBehavior) {
      case 'close-open-new':
        if (shouldFetchDocuments) {
          await this.closeCurrentTabs();
          await this.fetchAndOpenNewTabs(mode, currentContext?.id, workspace, newPath);
        }
        break;

      case 'save-close-open-new':
        await this.syncAllBrowserTabsToWorkspace(workspace, oldPath);
        if (shouldFetchDocuments) {
          await this.closeCurrentTabs();
          await this.fetchAndOpenNewTabs(mode, currentContext?.id, workspace, newPath);
        }
        break;

      case 'keep-open-new':
        if (shouldFetchDocuments) {
          await this.fetchAndOpenNewTabs(mode, currentContext?.id, workspace, newPath);
        }
        break;

      case 'keep-only':
        // Do nothing - keep current tabs, don't open new ones
        await this.updateInternalIndexes(mode, currentContext?.id, workspace, newPath);
        console.log('SyncEngine: Keep-only mode - preserving current tabs during workspace path change');
        break;

      default:
        console.warn('SyncEngine: Unknown workspace path change behavior:', actualBehavior);
        // Fallback to close-open-new
        if (shouldFetchDocuments) {
          await this.closeCurrentTabs();
          await this.fetchAndOpenNewTabs(mode, currentContext?.id, workspace, newPath);
        }
      }

    } catch (error) {
      console.error('SyncEngine: Failed to execute workspace path change behavior:', error);
    }
  }

  // Pending tab tracking to prevent duplicates
  isPendingTabOpen(url) {
    return this.pendingTabOpens.has(url);
  }

  markPendingTabOpen(url) {
    this.pendingTabOpens.add(url);
    // Auto-clear after 10 seconds to prevent memory leaks
    setTimeout(() => {
      this.pendingTabOpens.delete(url);
    }, 10000);
  }

  clearPendingTabOpen(url) {
    this.pendingTabOpens.delete(url);
  }

  // Open tabs with reasonable limits to avoid browser issues
  async openTabsWithRateLimit(documents, maxConcurrent = null, delayMs = null) {
    try {
      // Safety cap - don't open more than 100 tabs at once
      if (documents.length > 100) {
        console.warn(`SyncEngine: Too many tabs to open (${documents.length}), limiting to 100`);
        documents = documents.slice(0, 100);
      }

      // Filter out documents that would create duplicate tabs
      const documentsToOpen = [];
      const skippedDuplicates = [];

      for (const document of documents) {
        if (document.schema === 'data/abstraction/tab' && document.data?.url) {
          // Check if tab is already open or pending
          const existingTabs = await tabManager.findDuplicateTabs(document.data.url);
          const isPending = this.isPendingTabOpen(document.data.url);

          if (existingTabs.length === 0 && !isPending) {
            // Mark as pending to prevent race conditions
            this.markPendingTabOpen(document.data.url);
            documentsToOpen.push(document);
          } else {
            console.log('SyncEngine: Skipping duplicate tab:', document.data?.title || document.data.url);
            skippedDuplicates.push(document);
          }
        } else {
          // Non-tab documents or documents without URLs - include them
          documentsToOpen.push(document);
        }
      }

      if (skippedDuplicates.length > 0) {
        console.log(`SyncEngine: Skipped ${skippedDuplicates.length} duplicate tabs, opening ${documentsToOpen.length} new tabs`);
      }

      if (documentsToOpen.length === 0) {
        console.log('SyncEngine: No new tabs to open after filtering duplicates');
        return;
      }

      // Get user-configured settings or use reasonable defaults
      const syncSettings = await browserStorage.getSyncSettings();
      const effectiveMaxConcurrent = maxConcurrent ?? syncSettings.tabOpeningMaxConcurrent ?? 20; // Increased from 3 to 20
      const effectiveDelayMs = delayMs ?? syncSettings.tabOpeningDelayMs ?? 50; // Reduced from 200ms to 50ms

      console.log('SyncEngine: Opening', documentsToOpen.length, 'tabs (max', effectiveMaxConcurrent, 'concurrent)');

      // Process documents in batches to avoid overwhelming the browser
      for (let i = 0; i < documentsToOpen.length; i += effectiveMaxConcurrent) {
        const batch = documentsToOpen.slice(i, i + effectiveMaxConcurrent);

        // Open batch of tabs concurrently with individual error handling
        const promises = batch.map(async (document, index) => {
          try {
            console.log(`SyncEngine: Opening tab ${i + index + 1}/${documentsToOpen.length}:`, document.data?.title || document.id);
            const result = await tabManager.openCanvasDocument(document, {
              active: false,
              allowDuplicates: false  // Prevent duplicates at tab manager level too
            });
            console.log('SyncEngine: ✅ Opened tab:', document.data?.title || document.id);
            return { success: true, document, result };
          } catch (error) {
            console.error('SyncEngine: ❌ Failed to open tab:', document.data?.title || document.id, error);
            return { success: false, document, error: error.message };
          }
        });

        // Wait for all tabs in this batch to complete (don't let one failure stop others)
        const results = await Promise.allSettled(promises);

        // Log batch completion
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = batch.length - successful;
        console.log(`SyncEngine: Batch ${Math.floor(i/effectiveMaxConcurrent) + 1} completed: ${successful} opened, ${failed} failed`);

        // Small delay between batches if there are more to process
        if (i + effectiveMaxConcurrent < documentsToOpen.length && effectiveDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, effectiveDelayMs));
        }
      }

      // Clear pending flags after opening all tabs
      for (const document of documentsToOpen) {
        if (document.data?.url) {
          this.clearPendingTabOpen(document.data.url);
        }
      }

      console.log('SyncEngine: Completed opening all tabs');

    } catch (error) {
      console.error('SyncEngine: Failed to open tabs with rate limiting:', error);
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
