// Tab Manager module for Canvas Extension
// Handles browser tab operations and Canvas document conversion

export class TabManager {
  constructor() {
    this.trackedTabs = new Map(); // tabId -> tab data
    this.syncedTabs = new Set(); // tabIds that are synced to Canvas
    this.pendingCanvasTabs = new Set(); // URLs of tabs being opened from Canvas (to prevent auto-sync race conditions)

    // Browser compatibility
    this.tabsAPI = (typeof chrome !== 'undefined') ? chrome.tabs : browser.tabs;
    this.windowsAPI = (typeof chrome !== 'undefined') ? chrome.windows : browser.windows;
  }

  // Convert browser tab to Canvas document format (based on PAYLOAD.md format)
  convertTabToDocument(tab, browserIdentity, syncSettings = {}) {
    const document = {
      schema: 'data/abstraction/tab',
      schemaVersion: '2.0',
      data: {
        // Browser tab properties as specified in design doc
        id: tab.id,
        windowId: tab.windowId,
        index: tab.index,
        highlighted: tab.highlighted,
        active: tab.active,
        pinned: tab.pinned,
        discarded: tab.discarded || false,
        incognito: tab.incognito,
        audible: tab.audible,
        mutedInfo: tab.mutedInfo,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        timestamp: new Date().toISOString()
      },
      featureArray: this.generateFeatureArray(browserIdentity, syncSettings),
      metadata: {
        contentType: 'application/json',
        contentEncoding: 'utf8',
        dataPaths: []
      },
      indexOptions: {
        checksumAlgorithms: ['sha1', 'sha256'],
        primaryChecksumAlgorithm: 'sha1',
        checksumFields: ['data.url'],
        ftsSearchFields: ['data.title', 'data.url'],
        vectorEmbeddingFields: ['data.title', 'data.url'],
        embeddingOptions: {
          embeddingModel: 'text-embedding-3-small',
          embeddingDimensions: 1536,
          embeddingProvider: 'openai',
          embeddingProviderOptions: {},
          chunking: {
            type: 'sentence',
            chunkSize: 1000,
            chunkOverlap: 200
          }
        }
      }
    };

    console.log('Converted tab to Canvas document:', document);
    return document;
  }

  // Generate feature array for tab document
  generateFeatureArray(browserIdentity, syncSettings = {}) {
    const features = ['data/abstraction/tab'];

    // Add browser type
    if (browserIdentity) {
      if (browserIdentity.includes('chrome')) {
        features.push('client/app/chrome');
      } else if (browserIdentity.includes('firefox')) {
        features.push('client/app/firefox');
      } else if (browserIdentity.includes('edge')) {
        features.push('client/app/edge');
      } else if (browserIdentity.includes('safari')) {
        features.push('client/app/safari');
      }

      // Add browser identity string if "sync only current browser" is enabled
      if (syncSettings.syncOnlyCurrentBrowser) {
        features.push(`client/app/browser-identity-string`);
      }

      // Add instance identifier
      features.push(`tag/${browserIdentity}`);
    }

    // Add custom tag if "sync only tagged tabs" is enabled and tag is specified
    if (syncSettings.syncOnlyTaggedTabs && syncSettings.syncTagFilter) {
      features.push(`custom/tag/${syncSettings.syncTagFilter}`);
    }

    return features;
  }

  // Check if tab should be synced (exclude internal pages)
  shouldSyncTab(tab) {
    console.log(`🔧 shouldSyncTab: Checking tab:`, {
      id: tab?.id,
      url: tab?.url,
      title: tab?.title,
      status: tab?.status,
      discarded: tab?.discarded
    });

    if (!tab || !tab.url || !tab.title) {
      console.log(`❌ shouldSyncTab: Tab missing basic fields:`, {
        hasTab: !!tab,
        hasUrl: !!tab?.url,
        hasTitle: !!tab?.title
      });
      return false;
    }

    // Allow tabs that are complete or loading (but not discarded)
    // Note: 'unloaded' tabs are still syncable - Chrome just unloaded them to save memory
    if (tab.discarded === true) {
      console.log(`❌ shouldSyncTab: Tab is discarded`);
      return false;
    }

    // Exclude internal browser pages and extension pages
    const excludedProtocols = [
      'chrome://',
      'chrome-extension://',
      'chrome-search://',
      'chrome-devtools://',
      'moz-extension://',
      'edge://',
      'opera://',
      'brave://',
      'about:',
      'file://',
      'data:',
      'blob:',
      'javascript:',
      'view-source:',
      'wyciwyg://',
      'resource://'
    ];

    const excludedUrls = [
      'chrome://newtab/',
      'chrome://new-tab-page/',
      'about:newtab',
      'about:blank',
      'edge://newtab/',
      'opera://startpage/'
    ];

    const excludedTitles = [
      'New Tab',
      'New tab',
      'Newtab',
      'about:blank'
    ];

    // Check protocols
    for (const protocol of excludedProtocols) {
      if (tab.url.startsWith(protocol)) {
        console.log(`❌ shouldSyncTab: Excluded protocol: ${protocol}`);
        return false;
      }
    }

    // Check specific URLs
    for (const url of excludedUrls) {
      if (tab.url === url) {
        console.log(`❌ shouldSyncTab: Excluded URL: ${url}`);
        return false;
      }
    }

    // Check titles (for pages that might have blank/new tab titles)
    for (const title of excludedTitles) {
      if (tab.title === title) {
        console.log(`❌ shouldSyncTab: Excluded title: ${title}`);
        return false;
      }
    }

    // Must have http or https protocol for valid web pages
    const isValidProtocol = tab.url.startsWith('http://') || tab.url.startsWith('https://');
    if (!isValidProtocol) {
      console.log(`❌ shouldSyncTab: Invalid protocol for URL: ${tab.url}`);
      return false;
    }

    console.log(`✅ shouldSyncTab: Tab is syncable: ${tab.title} (${tab.url})`);
    return true;
  }

  // Get all browser tabs
  async getAllTabs() {
    try {
      const tabs = await this.tabsAPI.query({});
      return tabs;
    } catch (error) {
      console.error('Failed to get all tabs:', error);
      return [];
    }
  }

  // Get tabs that should be synced
  async getSyncableTabs() {
    const allTabs = await this.getAllTabs();
    console.log('Total browser tabs found:', allTabs.length);

    const syncableTabs = allTabs.filter(tab => {
      const shouldSync = this.shouldSyncTab(tab);
      if (!shouldSync) {
        console.log('Filtering out tab:', tab.title, tab.url, 'Status:', tab.status, 'Discarded:', tab.discarded);
      }
      return shouldSync;
    });

    console.log('Syncable tabs after filtering:', syncableTabs.length);
    return syncableTabs;
  }

  // Get unsynced tabs
  async getUnsyncedTabs() {
    const syncableTabs = await this.getSyncableTabs();
    return syncableTabs.filter(tab => !this.syncedTabs.has(tab.id));
  }

  // Track tab as synced
  markTabAsSynced(tabId, documentId = null) {
    this.syncedTabs.add(tabId);
    if (documentId) {
      // Store mapping for future reference
      const tabData = this.trackedTabs.get(tabId) || {};
      tabData.documentId = documentId;
      this.trackedTabs.set(tabId, tabData);
    }
  }

  // Untrack tab
  unmarkTabAsSynced(tabId) {
    this.syncedTabs.delete(tabId);
    this.trackedTabs.delete(tabId);
  }

  // Check if tab is synced
  isTabSynced(tabId) {
    return this.syncedTabs.has(tabId);
  }

  // Check if URL is pending from Canvas (to prevent auto-sync)
  isUrlPendingFromCanvas(url) {
    return this.pendingCanvasTabs.has(url);
  }

  // Mark URL as pending from Canvas
  markUrlAsPendingFromCanvas(url) {
    this.pendingCanvasTabs.add(url);
  }

  // Unmark URL as pending from Canvas
  unmarkUrlAsPendingFromCanvas(url) {
    this.pendingCanvasTabs.delete(url);
  }

  // Get tab by ID
  async getTab(tabId) {
    try {
      const tab = await this.tabsAPI.get(tabId);
      return tab;
    } catch (error) {
      console.error('Failed to get tab:', error);
      return null;
    }
  }

  // Open URL in new tab
  async openTab(url, options = {}) {
    try {
      const tab = await this.tabsAPI.create({
        url,
        active: options.active !== false, // Default to active
        ...options
      });
      return tab;
    } catch (error) {
      console.error('Failed to open tab:', error);
      throw error;
    }
  }

  // Close tab
  async closeTab(tabId) {
    try {
      await this.tabsAPI.remove(tabId);
      this.unmarkTabAsSynced(tabId);
      return true;
    } catch (error) {
      console.error('Failed to close tab:', error);
      return false;
    }
  }

  // Focus tab
  async focusTab(tabId) {
    try {
      const tab = await this.tabsAPI.get(tabId);
      await this.tabsAPI.update(tabId, { active: true });
      await this.windowsAPI.update(tab.windowId, { focused: true });
      return true;
    } catch (error) {
      console.error('Failed to focus tab:', error);
      return false;
    }
  }

  // Close multiple tabs
  async closeTabs(tabIds) {
    try {
      await this.tabsAPI.remove(tabIds);
      tabIds.forEach(tabId => this.unmarkTabAsSynced(tabId));
      return true;
    } catch (error) {
      console.error('Failed to close tabs:', error);
      return false;
    }
  }

  // Update tab
  async updateTab(tabId, updateProperties) {
    try {
      const tab = await this.tabsAPI.update(tabId, updateProperties);
      return tab;
    } catch (error) {
      console.error('Failed to update tab:', error);
      return null;
    }
  }

  // Check if tab exists
  async tabExists(tabId) {
    try {
      await this.tabsAPI.get(tabId);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get synced tab data
  getSyncedTabData(tabId) {
    return this.trackedTabs.get(tabId);
  }

  // Generate hash for tab (for duplicate detection)
  generateTabHash(tab) {
    return `${tab.url}|${tab.title}`;
  }

  // Find duplicate tabs by URL
  async findDuplicateTabs(url) {
    const allTabs = await this.getAllTabs();
    return allTabs.filter(tab => tab.url === url);
  }

  // Canvas Integration Methods

  // Compare browser tabs with Canvas documents to determine sync state
  compareWithCanvasDocuments(browserTabs, canvasDocuments) {
    const result = {
      browserToCanvas: [], // Browser tabs not in Canvas (need syncing)
      canvasToBrowser: [], // Canvas docs not open in browser
      synced: [] // Tabs that exist in both
    };

    // Create lookup maps for efficient comparison
    const browserTabsByUrl = new Map();
    const canvasDocsByUrl = new Map();

    // Index browser tabs by URL
    browserTabs.forEach(tab => {
      if (this.shouldSyncTab(tab)) {
        browserTabsByUrl.set(tab.url, tab);
      }
    });

    // Index Canvas documents by URL
    canvasDocuments.forEach(doc => {
      if (doc.schema === 'data/abstraction/tab' && doc.data?.url) {
        canvasDocsByUrl.set(doc.data.url, doc);
      }
    });

    // Find browser tabs not in Canvas
    browserTabsByUrl.forEach((tab, url) => {
      if (!canvasDocsByUrl.has(url)) {
        result.browserToCanvas.push(tab);
      } else {
        result.synced.push({
          browserTab: tab,
          canvasDoc: canvasDocsByUrl.get(url)
        });
        // Mark as synced in our tracking
        this.markTabAsSynced(tab.id, canvasDocsByUrl.get(url).id);
      }
    });

    // Find Canvas documents not open in browser
    canvasDocsByUrl.forEach((doc, url) => {
      if (!browserTabsByUrl.has(url)) {
        result.canvasToBrowser.push(doc);
      }
    });

    console.log('Tab sync comparison result:', {
      browserToCanvas: result.browserToCanvas.length,
      canvasToBrowser: result.canvasToBrowser.length,
      synced: result.synced.length
    });

    return result;
  }

  // Get tabs that need syncing to Canvas
  async getTabsToSync(canvasDocuments = []) {
    const browserTabs = await this.getSyncableTabs();
    const comparison = this.compareWithCanvasDocuments(browserTabs, canvasDocuments);
    return comparison.browserToCanvas;
  }

  // Get Canvas documents that should be opened in browser
  getDocumentsToOpen(canvasDocuments = []) {
    // This would typically be called after compareWithCanvasDocuments
    // For now, return all Canvas tab documents not currently tracked
    return canvasDocuments.filter(doc => {
      if (doc.schema !== 'data/abstraction/tab' || !doc.data?.url) return false;

      // Check if any browser tab has this URL
      const hasOpenTab = [...this.trackedTabs.values()].some(tabData =>
        tabData.url === doc.data.url
      );

      return !hasOpenTab;
    });
  }

  // Sync a browser tab to Canvas
  async syncTabToCanvas(tab, apiClient, contextId, browserIdentity, syncSettings = {}) {
    try {
      console.log(`🔧 TabManager.syncTabToCanvas: Starting sync for tab: ${tab.title} (${tab.url})`);

      if (!this.shouldSyncTab(tab)) {
        console.warn(`⚠️ TabManager.syncTabToCanvas: Tab is not syncable: ${tab.title}`);
        throw new Error('Tab is not syncable');
      }

      console.log(`🔧 TabManager.syncTabToCanvas: Tab is syncable, proceeding with sync`);

      // Convert tab to Canvas document format
      const document = this.convertTabToDocument(tab, browserIdentity, syncSettings);
      console.log(`🔧 TabManager.syncTabToCanvas: Converted to document:`, {
        schema: document.schema,
        url: document.data.url,
        title: document.data.title,
        featureArrayLength: document.featureArray?.length
      });

      console.log(`🔧 TabManager.syncTabToCanvas: Making API call to insertDocument...`);
      console.log(`🔧 TabManager.syncTabToCanvas: API client details:`, {
        hasApiClient: !!apiClient,
        hasInsertMethod: typeof apiClient?.insertDocument === 'function',
        apiToken: apiClient?.apiToken ? 'present' : 'missing',
        serverUrl: apiClient?.serverUrl || 'missing'
      });

      // Send to Canvas API (use insertDocument with feature array)
      const response = await apiClient.insertDocument(
        contextId,
        document,
        document.featureArray
      );

      console.log(`🔧 TabManager.syncTabToCanvas: API response:`, response);

      if (response.status === 'success') {
        // response.payload is now an array of document IDs
        const documentId = Array.isArray(response.payload) ? response.payload[0] : response.payload;

        // Mark tab as synced
        this.markTabAsSynced(tab.id, documentId);

        console.log(`Tab synced successfully: ${tab.title}`);
        return {
          success: true,
          documentId: documentId,
          message: 'Tab synced to Canvas'
        };
      } else {
        throw new Error(response.message || 'Failed to sync tab');
      }
    } catch (error) {
      console.error('Failed to sync tab to Canvas:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Open a Canvas document as a browser tab
  async openCanvasDocument(canvasDoc, options = {}) {
    try {
      if (!canvasDoc.data?.url) {
        throw new Error('Canvas document has no URL');
      }

      console.log(`Opening Canvas document: ${canvasDoc.data.title} (${canvasDoc.data.url})`);

      // Mark URL as pending from Canvas to prevent auto-sync race conditions
      this.markUrlAsPendingFromCanvas(canvasDoc.data.url);

      try {
        // Check if tab is already open
        const existingTabs = await this.findDuplicateTabs(canvasDoc.data.url);
        if (existingTabs.length > 0 && !options.allowDuplicates) {
          // Focus existing tab instead
          const existingTab = existingTabs[0];
          await this.tabsAPI.update(existingTab.id, { active: true });
          await this.windowsAPI.update(existingTab.windowId, { focused: true });

          // Mark as synced and remove from pending
          this.markTabAsSynced(existingTab.id, canvasDoc.id);

          return {
            success: true,
            tab: existingTab,
            message: 'Focused existing tab'
          };
        }

        // Open new tab (prefer the same window if available)
        const baseOptions = {
          active: options.active !== false,
          pinned: canvasDoc.data.pinned || false
        };
        const preferredWindowId = Number.isInteger(canvasDoc.data?.windowId) ? canvasDoc.data.windowId : undefined;

        let tab;
        if (preferredWindowId !== undefined) {
          try {
            tab = await this.openTab(canvasDoc.data.url, { ...baseOptions, windowId: preferredWindowId });
          } catch (err) {
            console.warn('Failed to open tab in preferred window, retrying without windowId:', err?.message || err);
            tab = await this.openTab(canvasDoc.data.url, baseOptions);
          }
        } else {
          tab = await this.openTab(canvasDoc.data.url, baseOptions);
        }

        // Mark as synced immediately to prevent auto-sync
        this.markTabAsSynced(tab.id, canvasDoc.id);

        console.log(`Canvas document opened successfully: ${canvasDoc.data.title}`);
        return {
          success: true,
          tab,
          message: 'Canvas document opened'
        };
      } finally {
        // Always clean up pending state
        this.unmarkUrlAsPendingFromCanvas(canvasDoc.data.url);
      }
    } catch (error) {
      console.error('Failed to open Canvas document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Bulk sync multiple tabs
  async syncMultipleTabs(tabs, apiClient, contextId, browserIdentity, syncSettings = {}) {
    console.log(`🔧 TabManager.syncMultipleTabs: Starting batch sync of ${tabs.length} tabs to context ${contextId}`);
    console.log('🔧 TabManager.syncMultipleTabs: API client status:', {
      hasApiClient: !!apiClient,
      hasToken: !!apiClient?.apiToken,
      hasUrl: !!apiClient?.serverUrl
    });

    try {
      // Filter out non-syncable tabs
      const syncableTabs = tabs.filter(tab => {
        const canSync = this.shouldSyncTab(tab);
        if (!canSync) {
          console.warn(`⚠️ TabManager.syncMultipleTabs: Tab is not syncable: ${tab.title}`);
        }
        return canSync;
      });

      if (syncableTabs.length === 0) {
        console.warn('❌ TabManager.syncMultipleTabs: No syncable tabs found');
        return {
          success: false,
          total: tabs.length,
          successful: 0,
          failed: tabs.length,
          error: 'No syncable tabs found'
        };
      }

      console.log(`🔧 TabManager.syncMultipleTabs: Converting ${syncableTabs.length} syncable tabs to documents`);

      // Convert all tabs to documents
      const documents = syncableTabs.map(tab => this.convertTabToDocument(tab, browserIdentity, syncSettings));

      // Use batch API for better performance
      console.log(`🔧 TabManager.syncMultipleTabs: Making batch API call with ${documents.length} documents`);

      const response = await apiClient.insertDocuments(
        contextId,
        documents,
        documents[0]?.featureArray || [] // All tabs should have same feature array
      );

      console.log(`🔧 TabManager.syncMultipleTabs: Batch API response:`, response);

      if (response.status === 'success') {
        // response.payload is now an array of document IDs
        const documentIds = Array.isArray(response.payload) ? response.payload : [response.payload];
        syncableTabs.forEach((tab, index) => {
          const documentId = documentIds[index] || documentIds[0]; // Fallback to first ID if array mismatch
          this.markTabAsSynced(tab.id, documentId);
          console.log(`✅ TabManager.syncMultipleTabs: Marked tab ${tab.id} as synced with document ${documentId}`);
        });

        console.log(`✅ TabManager.syncMultipleTabs: Batch sync completed successfully: ${syncableTabs.length} tabs synced`);

        return {
          success: true,
          total: tabs.length,
          successful: syncableTabs.length,
          failed: tabs.length - syncableTabs.length,
          documentIds
        };
      } else {
        throw new Error(response.message || 'Batch sync failed');
      }

    } catch (error) {
      console.error(`❌ TabManager.syncMultipleTabs: Batch sync failed:`, error);

      // Fallback to individual sync if batch fails
      console.log('🔄 TabManager.syncMultipleTabs: Falling back to individual sync...');
      return await this.syncMultipleTabsIndividually(tabs, apiClient, contextId, browserIdentity);
    }
  }

  // Fallback method for individual tab syncing
  async syncMultipleTabsIndividually(tabs, apiClient, contextId, browserIdentity) {
    console.log(`🔄 TabManager.syncMultipleTabsIndividually: Starting individual sync of ${tabs.length} tabs`);

    const results = [];

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      console.log(`🔧 TabManager.syncMultipleTabsIndividually: Syncing tab ${i + 1}/${tabs.length}: ${tab.title}`);

      try {
        const result = await this.syncTabToCanvas(tab, apiClient, contextId, browserIdentity);
        console.log(`🔧 TabManager.syncMultipleTabsIndividually: Tab ${i + 1} result:`, result);
        results.push({
          tab,
          result
        });
      } catch (error) {
        console.error(`❌ TabManager.syncMultipleTabsIndividually: Tab ${i + 1} failed:`, error);
        results.push({
          tab,
          result: { success: false, error: error.message }
        });
      }
    }

    const successful = results.filter(r => r.result.success).length;
    console.log(`✅ TabManager.syncMultipleTabsIndividually: Individual sync completed: ${successful}/${tabs.length} tabs synced`);

    return {
      success: successful > 0,
      total: tabs.length,
      successful,
      failed: tabs.length - successful,
      results
    };
  }

  // Remove Canvas document (and optionally close browser tab)
  async removeCanvasDocument(canvasDoc, apiClient, contextId, closeTab = false) {
    try {
      console.log(`Removing Canvas document: ${canvasDoc.data?.title}`);

      // Remove from Canvas
      const response = await apiClient.deleteDocument(contextId, canvasDoc.id);

      if (response.status === 'success') {
        // Optionally close browser tab
        if (closeTab && canvasDoc.data?.url) {
          const matchingTabs = await this.findDuplicateTabs(canvasDoc.data.url);
          for (const tab of matchingTabs) {
            if (this.isTabSynced(tab.id)) {
              await this.closeTab(tab.id);
            }
          }
        }

        return {
          success: true,
          message: 'Canvas document removed'
        };
      } else {
        throw new Error(response.message || 'Failed to remove document');
      }
    } catch (error) {
      console.error('Failed to remove Canvas document:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
export const tabManager = new TabManager();
export default tabManager;
