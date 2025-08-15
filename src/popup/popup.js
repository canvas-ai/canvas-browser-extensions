// Canvas Extension Popup JavaScript
// Handles popup UI interactions and communication with background service worker

// Import FuzzySearch for fuzzy search
import FuzzySearch from './fuse.js';

// DOM elements
let connectionStatus, connectionText, contextInfo, contextId, contextUrl;
let searchInput, autoSyncNew, autoOpenNew, showSyncedTabs, showAllCanvasTabs;
let browserToCanvasList, canvasToBrowserList;
let syncAllBtn, closeAllBtn, openAllBtn, settingsBtn, logoBtn, selectorBtn;
let browserBulkActions, canvasBulkActions;
let syncSelectedBtn, closeSelectedBtn, openSelectedBtn, removeSelectedBtn, deleteSelectedBtn;

// Tab elements
let browserToCanvasTab, canvasToBrowserTab;
let browserToCanvasContent, canvasToBrowserContent;

// View containers and navigation
let viewContainer;
let mainView, treeView, selectionView;

// Tree view elements
let treeBackBtn, treePathInput, pathSubmitBtn, pathCancelBtn;
let treeTitle, treeSubtitle, treeContainer;

// Selection view elements
let selectionBackBtn, contextsSelectionTab, workspacesSelectionTab;
let contextsList, workspacesList;

// State
let currentConnection = { connected: false, context: null, mode: 'explorer', workspace: null };
let currentWorkspacePath = '/';
let browserTabs = [];
let canvasTabs = [];
let allBrowserTabs = []; // All tabs including synced ones
let syncedTabIds = new Set(); // Track which tabs are already synced
let showingSyncedTabs = false; // Track checkbox state
let showingAllCanvasTabs = false; // Track show all Canvas tabs checkbox state
let selectedBrowserTabs = new Set();
let selectedCanvasTabs = new Set();
let currentTab = 'browser-to-canvas';

// View state
let currentView = 'main'; // 'main', 'tree', 'selection'
let treeData = null; // Store tree data from API
let selectedPath = '/'; // Currently selected tree path
let currentSelectionTab = 'contexts'; // 'contexts' or 'workspaces'

// Fuzzy search instances
let browserTabsFuse = null;
let canvasTabsFuse = null;

// Fuzzy search configuration
const fuseConfig = {
  keys: [
    { name: 'title', weight: 0.7 },
    { name: 'url', weight: 0.3 },
    { name: 'data.title', weight: 0.7 },
    { name: 'data.url', weight: 0.3 }
  ],
  threshold: 0.4, // More lenient threshold for better fuzzy matching
  location: 0,
  distance: 100,
  minMatchCharLength: 1,
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  setupEventListeners();
  await loadInitialData();
});

// Listen for messages from service worker (cross-browser compatible)
const runtime = (typeof browser !== 'undefined') ? browser.runtime : chrome.runtime;
runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Popup received message:', message);

  // Handle background events from service worker
  if (message.type === 'BACKGROUND_EVENT') {
    switch (message.eventType) {
      case 'tabs.refresh':
        console.log('Refreshing tabs due to context change');
        loadTabs();
        break;

      case 'context.changed':
        console.log('Context changed:', message.data);
        // Update context display
        if (message.data.contextId && message.data.url) {
          // Update current connection and refresh display properly
          if (currentConnection.context) {
            currentConnection.context.id = message.data.contextId;
            currentConnection.context.url = message.data.url;
          }
          // Refresh the entire status display to ensure proper formatting
          updateConnectionStatus(currentConnection);
        }
        break;

      case 'context.url.set':
        console.log('Context URL set:', message.data);
        // Update context display when URL changes via CLI
        if (message.data.contextId && message.data.url) {
          // Update current connection and refresh display properly
          if (currentConnection.context && currentConnection.context.id === message.data.contextId) {
            currentConnection.context.url = message.data.url;
          }
          // Refresh the entire status display to ensure proper formatting
          updateConnectionStatus(currentConnection);
        }
        // Refresh tabs to show updated context
        loadTabs();
        break;

      case 'websocket.context.joined':
        console.log('Joined context:', message.data);
        break;

      default:
        console.log('Unknown background event:', message.eventType, message.data);
    }
    return;
  }

  // Handle direct message types (legacy)
  switch (message.type) {
    case 'tabs.refresh':
      console.log('Refreshing tabs due to context change');
      loadTabs();
      break;

    case 'context.changed':
      console.log('Context changed:', message.data);
      // Update context display
      if (message.data.contextId && message.data.url) {
        // Update current connection and refresh display properly
        if (currentConnection.context) {
          currentConnection.context.id = message.data.contextId;
          currentConnection.context.url = message.data.url;
        }
        // Refresh the entire status display to ensure proper formatting
        updateConnectionStatus(currentConnection);
      }
      break;

    case 'context.url.set':
      console.log('Context URL set:', message.data);
      // Update context display when URL changes via CLI
      if (message.data.contextId && message.data.url) {
        // Update current connection and refresh display properly
        if (currentConnection.context && currentConnection.context.id === message.data.contextId) {
          currentConnection.context.url = message.data.url;
        }
        // Refresh the entire status display to ensure proper formatting
        updateConnectionStatus(currentConnection);
      }
      // Refresh tabs to show updated context
      loadTabs();
      break;

    case 'websocket.context.joined':
      console.log('Joined context:', message.data);
      break;

    default:
      console.log('Unknown message type:', message.type, message.data);
  }
});

function initializeElements() {
  // View containers
  viewContainer = document.getElementById('viewContainer');
  mainView = document.getElementById('mainView');
  treeView = document.getElementById('treeView');
  selectionView = document.getElementById('selectionView');

  // Header elements
  connectionStatus = document.getElementById('connectionStatus');
  connectionText = document.getElementById('connectionText');
  contextInfo = document.getElementById('contextInfo');
  contextId = document.getElementById('contextId');
  contextUrl = document.getElementById('contextUrl');
  logoBtn = document.getElementById('logoBtn');

  // Search and settings
  searchInput = document.getElementById('searchInput');
  autoSyncNew = document.getElementById('autoSyncNew');
  autoOpenNew = document.getElementById('autoOpenNew');
  showSyncedTabs = document.getElementById('showSyncedTabs');
  showAllCanvasTabs = document.getElementById('showAllCanvasTabs');
  selectorBtn = document.getElementById('selectorBtn');
  settingsBtn = document.getElementById('settingsBtn');

  // Tab navigation
  browserToCanvasTab = document.getElementById('browserToCanvasTab');
  canvasToBrowserTab = document.getElementById('canvasToBrowserTab');

  // Tab content
  browserToCanvasContent = document.getElementById('browser-to-canvas');
  canvasToBrowserContent = document.getElementById('canvas-to-browser');

  // Tab lists
  browserToCanvasList = document.getElementById('browserToCanvasList');
  canvasToBrowserList = document.getElementById('canvasToBrowserList');

  // Action buttons
  syncAllBtn = document.getElementById('syncAllBtn');
  closeAllBtn = document.getElementById('closeAllBtn');
  openAllBtn = document.getElementById('openAllBtn');

  // Bulk actions
  browserBulkActions = document.getElementById('browserBulkActions');
  canvasBulkActions = document.getElementById('canvasBulkActions');
  syncSelectedBtn = document.getElementById('syncSelectedBtn');
  closeSelectedBtn = document.getElementById('closeSelectedBtn');
  openSelectedBtn = document.getElementById('openSelectedBtn');
  removeSelectedBtn = document.getElementById('removeSelectedBtn');
  deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

  // Tree view elements
  treeBackBtn = document.getElementById('treeBackBtn');
  treePathInput = document.getElementById('treePathInput');
  pathSubmitBtn = document.getElementById('pathSubmitBtn');
  pathCancelBtn = document.getElementById('pathCancelBtn');
  treeTitle = document.getElementById('treeTitle');
  treeSubtitle = document.getElementById('treeSubtitle');
  treeContainer = document.getElementById('treeContainer');

  // Selection view elements
  selectionBackBtn = document.getElementById('selectionBackBtn');
  contextsSelectionTab = document.getElementById('contextsSelectionTab');
  workspacesSelectionTab = document.getElementById('workspacesSelectionTab');
  contextsList = document.getElementById('contextsList');
  workspacesList = document.getElementById('workspacesList');
}

function setupEventListeners() {
  // Logo click - open Canvas server webui
  logoBtn.addEventListener('click', openCanvasWebUI);

  // Selector button - navigate to selection view
  selectorBtn.addEventListener('click', () => navigateToView('selection'));

  // Settings button
  settingsBtn.addEventListener('click', openSettingsPage);

  // Context URL click - navigate to tree view
  contextUrl.addEventListener('click', handleContextUrlClick);

  // Tree view navigation
  treeBackBtn.addEventListener('click', () => navigateToView('main'));
  pathSubmitBtn.addEventListener('click', handlePathSubmit);
  pathCancelBtn.addEventListener('click', () => navigateToView('main'));
  treePathInput.addEventListener('keydown', handleTreePathKeydown);

  // Selection view navigation
  selectionBackBtn.addEventListener('click', handleSelectionBackClick);
  contextsSelectionTab.addEventListener('click', () => switchSelectionTab('contexts'));
  workspacesSelectionTab.addEventListener('click', () => switchSelectionTab('workspaces'));

  // Tab navigation
  browserToCanvasTab.addEventListener('click', () => switchTab('browser-to-canvas'));
  canvasToBrowserTab.addEventListener('click', () => switchTab('canvas-to-browser'));

  // Search
  searchInput.addEventListener('input', handleSearch);

  // Sync settings toggles
  autoSyncNew.addEventListener('change', handleSyncSettingChange);
  autoOpenNew.addEventListener('change', handleSyncSettingChange);
  showSyncedTabs.addEventListener('change', handleShowSyncedChange);
  showAllCanvasTabs.addEventListener('change', handleShowAllCanvasChange);

  // Action buttons
  syncAllBtn.addEventListener('click', () => handleSyncAll());
  closeAllBtn.addEventListener('click', () => handleCloseAll());
  openAllBtn.addEventListener('click', () => handleOpenAll());

  // Bulk actions
  syncSelectedBtn.addEventListener('click', () => handleSyncSelected());
  closeSelectedBtn.addEventListener('click', () => handleCloseSelected());
  openSelectedBtn.addEventListener('click', () => handleOpenSelected());
  removeSelectedBtn.addEventListener('click', () => handleRemoveSelected());
  deleteSelectedBtn.addEventListener('click', () => handleDeleteSelected());

  // Event delegation for browser tab actions
  browserToCanvasList.addEventListener('click', handleBrowserTabAction);

  // Event delegation for Canvas tab actions
  canvasToBrowserList.addEventListener('click', handleCanvasTabAction);

  // Event delegation for selection actions
  contextsList.addEventListener('click', handleSelectionActionClick);
  workspacesList.addEventListener('click', handleSelectionActionClick);

  // Event delegation for checkboxes
  browserToCanvasList.addEventListener('change', handleBrowserTabCheckbox);
  canvasToBrowserList.addEventListener('change', handleCanvasTabCheckbox);

  // Event delegation for favicon error handling
  browserToCanvasList.addEventListener('error', handleImageError, true);
  canvasToBrowserList.addEventListener('error', handleImageError, true);
}

// Tab switching functionality
function switchTab(tabName) {
  console.log('Switching to tab:', tabName);

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });

  // Activate selected tab
  const targetTab = document.querySelector(`[data-tab="${tabName}"]`);
  const targetContent = document.getElementById(tabName);

  if (targetTab && targetContent) {
    targetTab.classList.add('active');
    targetContent.classList.add('active');
    currentTab = tabName;

    // Clear selections when switching tabs
    clearSelections();

    // Apply search filter to current tab if there's a search query
    if (searchInput.value.trim()) {
      handleSearch({ target: { value: searchInput.value } });
    }
  }
}

function clearSelections() {
  selectedBrowserTabs.clear();
  selectedCanvasTabs.clear();
  browserBulkActions.style.display = 'none';
  canvasBulkActions.style.display = 'none';

  // Uncheck all checkboxes
  document.querySelectorAll('.tab-checkbox input[type="checkbox"]').forEach(checkbox => {
    checkbox.checked = false;
  });
}

async function loadInitialData() {
  try {
    console.log('Loading initial data...');

    // Get connection status
    const response = await sendMessageToBackground('GET_CONNECTION_STATUS');
    console.log('Connection status response:', response);

    currentConnection = response;
    if (currentConnection.mode === 'explorer' && typeof response.workspacePath === 'string') {
      currentWorkspacePath = response.workspacePath || '/';
    }

    // If in context mode but missing workspace info, try to load it
    if (currentConnection.mode === 'context' && currentConnection.context &&
        !currentConnection.context.workspaceName && !currentConnection.context.workspace &&
        !currentConnection.workspace) {
      console.log('Context mode detected but missing workspace info, attempting to load...');
      try {
        const workspacesResponse = await sendMessageToBackground('GET_WORKSPACES');
        if (workspacesResponse.success && workspacesResponse.workspaces && workspacesResponse.workspaces.length > 0) {
          // Prefer "universe" workspace if available, otherwise use first workspace
          let workspace = workspacesResponse.workspaces.find(ws => ws.name === 'universe');
          if (!workspace) {
            workspace = workspacesResponse.workspaces[0];
          }
          currentConnection.workspace = workspace;
          console.log('Added workspace info to current connection (preferred universe):', currentConnection.workspace);
        }
      } catch (error) {
        console.warn('Could not load workspace information on popup init:', error);
      }
    }

    updateConnectionStatus(currentConnection);

    // Initialize checkbox states to ensure proper defaults
    showSyncedTabs.checked = false; // Default to showing only unsynced tabs
    showingSyncedTabs = false;

    // Initialize section header based on checkbox state
    const sectionHeader = document.querySelector('#browser-to-canvas .section-header h3');
    if (sectionHeader) {
      sectionHeader.textContent = showingSyncedTabs ? 'Browser Tabs' : 'Unsynced Browser Tabs';
    }

    // Initialize Canvas section header based on checkbox state
    showingAllCanvasTabs = showAllCanvasTabs?.checked || false;

    // Load tabs if connected (or always load for debugging)
    console.log('Loading tabs...');
    await loadTabs();

    // Load sync settings
    await loadSyncSettings();
  } catch (error) {
    console.error('Failed to load initial data:', error);
  }
}

function updateConnectionStatus(connection) {
  console.log('Popup: Updating connection status with:', connection);

  if (connection.connected) {
    console.log('Popup: Setting status to CONNECTED');
    connectionStatus.className = 'status-dot connected';
    connectionText.textContent = 'Connected';

        // Context mode header
    if ((connection.mode === 'context') && connection.context) {
      console.log('Popup: Context mode, context:', connection.context);
      console.log('Popup: Context mode, workspace info:', connection.workspace);
      contextId.textContent = `Bound to context ID: ${connection.context.id}`;

      // Get workspace name from context or use fallback
      const workspaceName = connection.context.workspaceName || connection.context.workspace ||
                           (connection.workspace ? getWorkspaceName(connection.workspace) : null);
      const contextPath = connection.context.url || '/';

      console.log('Popup: Resolved workspace name:', workspaceName, 'context path:', contextPath);

      // Format URL as workspace.name://path
      if (workspaceName) {
        contextUrl.textContent = formatContextUrl(workspaceName, contextPath);
      } else {
        contextUrl.textContent = contextPath;
      }
      contextUrl.classList.add('clickable');
    // Explorer mode header
    } else if ((connection.mode === 'explorer') && connection.workspace) {
      const wsName = getWorkspaceName(connection.workspace);
      console.log('Popup: Explorer mode, workspace:', wsName);
      contextId.textContent = `Current workspace: ${wsName}`;

      // Format URL as workspace.name://path
      const workspacePath = currentWorkspacePath || '/';
      contextUrl.textContent = formatContextUrl(wsName, workspacePath);
      contextUrl.classList.add('clickable');
    } else {
      console.log('Popup: No context or workspace selected');
      contextId.textContent = '-';
      contextUrl.textContent = 'Not bound';
      contextUrl.classList.remove('clickable');
    }
  } else {
    console.log('Popup: Setting status to DISCONNECTED');
    connectionStatus.className = 'status-dot disconnected';
    connectionText.textContent = 'Disconnected';
    contextId.textContent = '-';
    contextUrl.textContent = 'No context';
    contextUrl.classList.remove('clickable');
  }
}

// Filter out internal browser tabs that should never be shown or interacted with
function isInternalTab(tab) {
  if (!tab || !tab.url) return true;

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

  // Check protocols
  for (const protocol of excludedProtocols) {
    if (tab.url.startsWith(protocol)) {
      console.log(`🚫 Filtering internal tab (${protocol}): ${tab.title}`);
      return true;
    }
  }

  // Check specific URLs
  for (const url of excludedUrls) {
    if (tab.url === url) {
      console.log(`🚫 Filtering internal tab (${url}): ${tab.title}`);
      return true;
    }
  }

  return false;
}

async function loadTabs() {
  try {
    console.log('Loading tabs...');

    // Get all browser tabs (both synced and unsynced)
    console.log('Requesting all browser tabs...');
    const allTabsResponse = await sendMessageToBackground('GET_ALL_TABS');
    console.log('All browser tabs response:', allTabsResponse);

    if (allTabsResponse.success) {
      const rawTabs = allTabsResponse.tabs || [];

      // Filter out discarded tabs and internal tabs - user doesn't want to see them anywhere
      allBrowserTabs = rawTabs.filter(tab => !tab.discarded && !isInternalTab(tab));
      const discardedCount = rawTabs.filter(tab => tab.discarded).length;
      const internalCount = rawTabs.filter(tab => !tab.discarded && isInternalTab(tab)).length;

      console.log(`All browser tabs loaded: ${allBrowserTabs.length} usable, ${discardedCount} discarded, ${internalCount} internal (filtered out)`);

      // Get synced tab URLs from server documents to identify which tabs are synced
      if (currentConnection.connected) {
        let docsResponse = null;
        if (currentConnection.mode === 'context' && currentConnection.context) {
          docsResponse = await sendMessageToBackground('GET_CANVAS_DOCUMENTS');
        } else if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
          docsResponse = await sendMessageToBackground('GET_WORKSPACE_DOCUMENTS', { contextSpec: currentWorkspacePath || '/' });
        }

        if (docsResponse?.success) {
          const syncedUrls = new Set(
            (docsResponse.documents || []).map(doc => doc.data?.url).filter(Boolean)
          );

          // Mark which tabs are synced
          syncedTabIds.clear();
          allBrowserTabs.forEach(tab => {
            if (syncedUrls.has(tab.url)) {
              syncedTabIds.add(tab.id);
            }
          });

          console.log('Synced tab IDs:', Array.from(syncedTabIds));
        }
      }

      // Load pin state for all tabs
      await loadPinStates();

      // Filter tabs based on showSyncedTabs setting
      updateBrowserTabsFilter();
      renderBrowserTabs();
    } else {
      console.error('Failed to get browser tabs:', allTabsResponse.error);
    }

    // Get documents for current mode - only if connected
    if (currentConnection.connected) {
      if (currentConnection.mode === 'context' && currentConnection.context) {
        console.log('Requesting Context documents...');
        const canvasResponse = await sendMessageToBackground('GET_CANVAS_DOCUMENTS');
        console.log('Context documents response:', canvasResponse);

        if (canvasResponse.success) {
          canvasTabs = canvasResponse.documents || [];
          console.log('Context documents loaded:', canvasTabs.length);
          renderCanvasTabs();
        } else {
          console.error('Failed to get context documents:', canvasResponse.error);
          canvasTabs = [];
          renderCanvasTabs();
        }
      } else if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
        console.log('Requesting Workspace documents...');
        const wsResponse = await sendMessageToBackground('GET_WORKSPACE_DOCUMENTS', { contextSpec: currentWorkspacePath || '/' });
        console.log('Workspace documents response:', wsResponse);

        if (wsResponse.success) {
          canvasTabs = wsResponse.documents || [];
          console.log('Workspace documents loaded:', canvasTabs.length);
          renderCanvasTabs();
        } else {
          console.error('Failed to get workspace documents:', wsResponse.error);
          canvasTabs = [];
          renderCanvasTabs();
        }
      } else {
        console.log('No selection for current mode - skipping documents');
        canvasTabs = [];
        renderCanvasTabs();
      }
    } else {
      console.log('Not connected - skipping documents');
      canvasTabs = [];
      renderCanvasTabs();
    }

    // Initialize fuzzy search instances with the loaded data
    initializeFuseInstances();

    // If there's an active search, re-apply it with the new data
    if (searchInput && searchInput.value.trim()) {
      handleSearch({ target: { value: searchInput.value } });
    }
  } catch (error) {
    console.error('Failed to load tabs:', error);
  }
}

async function loadPinStates() {
  try {
    console.log('Loading pin states for tabs...');
    const pinResponse = await sendMessageToBackground('GET_PINNED_TABS');

    if (pinResponse.success) {
      const pinnedTabIds = new Set(pinResponse.pinnedTabs || []);
      console.log('Pinned tab IDs:', Array.from(pinnedTabIds));

      // Add pin state to each tab
      allBrowserTabs.forEach(tab => {
        tab.isPinned = pinnedTabIds.has(tab.id);
      });
    } else {
      console.error('Failed to get pinned tabs:', pinResponse.error);
      // Default to not pinned for all tabs
      allBrowserTabs.forEach(tab => {
        tab.isPinned = false;
      });
    }
  } catch (error) {
    console.error('Failed to load pin states:', error);
    // Default to not pinned for all tabs
    allBrowserTabs.forEach(tab => {
      tab.isPinned = false;
    });
  }
}

function updateBrowserTabsFilter() {
  if (showingSyncedTabs) {
    // Show all tabs (both synced and unsynced)
    browserTabs = [...allBrowserTabs];
    console.log(`Browser tabs filter: Showing ALL tabs (${browserTabs.length} total)`);
  } else {
    // Show only unsynced tabs
    browserTabs = allBrowserTabs.filter(tab => !syncedTabIds.has(tab.id));
    const syncedCount = allBrowserTabs.length - browserTabs.length;
    console.log(`Browser tabs filter: Showing UNSYNCED only (${browserTabs.length} unsynced, ${syncedCount} synced hidden)`);
  }
}

function getFilteredCanvasTabs() {
  if (showingAllCanvasTabs) {
    // Show all Canvas tabs
    return canvasTabs;
  } else {
    // Show only Canvas tabs that are NOT already open in browser
    const openUrls = new Set(allBrowserTabs.map(tab => tab.url));
    const filteredTabs = canvasTabs.filter(doc => {
      const url = doc.data?.url;
      return url && !openUrls.has(url);
    });
    console.log(`Filtered Canvas tabs: ${filteredTabs.length} of ${canvasTabs.length} total (hiding tabs already open in browser)`);
    return filteredTabs;
  }
}

async function loadSyncSettings() {
  try {
    console.log('Loading sync settings from background...');

    // Get sync settings from background service worker
    const response = await sendMessageToBackground('GET_SYNC_SETTINGS');
    console.log('Loaded sync settings:', response);

    if (response.success) {
      const settings = response.settings;

      // Update checkbox states to match saved settings
      autoSyncNew.checked = settings.autoSyncNewTabs || false;
      autoOpenNew.checked = settings.autoOpenNewTabs || false;

      console.log('Applied sync settings to UI:', {
        autoSyncNewTabs: autoSyncNew.checked,
        autoOpenNewTabs: autoOpenNew.checked
      });
    } else {
      console.warn('Failed to load sync settings:', response.error);
      // Set defaults
      autoSyncNew.checked = false;
      autoOpenNew.checked = false;
    }
  } catch (error) {
    console.error('Failed to load sync settings:', error);
    // Set defaults on error
    autoSyncNew.checked = false;
    autoOpenNew.checked = false;
  }
}

function renderBrowserTabs() {
  console.log('Rendering browser tabs, count:', browserTabs.length);

  if (browserTabs.length === 0) {
    const emptyMessage = showingSyncedTabs
      ? 'No browser tabs found'
      : 'All tabs are already synced!<br><small>Check "Show Synced" to see all tabs</small>';
    browserToCanvasList.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }

  browserToCanvasList.innerHTML = browserTabs.map(tab => {
    const isSynced = syncedTabIds.has(tab.id);
    const syncButtonDisabled = isSynced ? 'disabled' : '';
    const syncButtonTitle = isSynced ? 'Already synced to Canvas' : 'Sync to Canvas';
    const tabClass = isSynced ? 'tab-item synced' : 'tab-item';
    const isPinned = tab.isPinned || false; // Will be populated when we load tab data
    const pinButtonClass = isPinned ? 'action-btn small pin-btn pinned' : 'action-btn small pin-btn';
    const pinButtonTitle = isPinned ? 'Unpin tab (will close on context change)' : 'Pin tab (keep open on context change)';
    const pinIcon = isPinned ?
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pin-fill" viewBox="0 0 16 16"><path d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A6 6 0 0 1 5 6.708V2.277a3 3 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354"/></svg>' :
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pin-angle-fill" viewBox="0 0 16 16"><path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707s.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 0 1 1.013.16l3.134-3.133a3 3 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146"/></svg>';

    return `
      <div class="${tabClass}" data-tab-id="${tab.id}">
        <label class="tab-checkbox">
          <input type="checkbox" data-tab-id="${tab.id}" ${isSynced ? 'disabled' : ''}>
          <span class="checkmark"></span>
        </label>
        <img src="${tab.favIconUrl || '../assets/icons/logo-br_64x64.png'}" class="tab-favicon" data-fallback="../assets/icons/logo-br_64x64.png">
        <div class="tab-info">
          <div class="tab-title">${escapeHtml(tab.title)}</div>
          <div class="tab-url">${escapeHtml(tab.url)}</div>
        </div>
        <div class="tab-actions">
          <button class="${pinButtonClass}" data-action="pin" data-tab-id="${tab.id}" title="${pinButtonTitle}">${pinIcon}</button>
          <button class="action-btn small primary" data-action="sync" data-tab-id="${tab.id}" title="${syncButtonTitle}" ${syncButtonDisabled}>↗</button>
          <button class="action-btn small danger" data-action="close" data-tab-id="${tab.id}" title="Close tab">✕</button>
        </div>
      </div>
    `;
  }).join('');

  // Setup checkbox listeners
  browserToCanvasList.querySelectorAll('input[type="checkbox"]:not([disabled])').forEach(checkbox => {
    checkbox.addEventListener('change', handleBrowserTabSelection);
  });
}

function renderCanvasTabs() {
  const filteredCanvasTabs = getFilteredCanvasTabs();

  if (filteredCanvasTabs.length === 0) {
    const emptyMessage = showingAllCanvasTabs ?
      'No context tabs found' :
      'No new context tabs to open<br><small>All context tabs are already open in browser</small>';
    canvasToBrowserList.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }

  canvasToBrowserList.innerHTML = filteredCanvasTabs.map(tab => `
    <div class="tab-item" data-document-id="${tab.id}">
      <label class="tab-checkbox">
        <input type="checkbox" data-document-id="${tab.id}">
        <span class="checkmark"></span>
      </label>
      <img src="${tab.data?.favIconUrl || '../assets/icons/logo-br_64x64.png'}" class="tab-favicon" data-fallback="../assets/icons/logo-br_64x64.png">
      <div class="tab-info">
        <div class="tab-title">${escapeHtml(tab.data?.title || 'Untitled')}</div>
        <div class="tab-url">${escapeHtml(tab.data?.url || 'No URL')}</div>
      </div>
      <div class="tab-actions">
        <button class="action-btn small primary" data-action="open" data-document-id="${tab.id}" title="Open in browser">↙</button>
        <button class="action-btn small warning" data-action="remove" data-document-id="${tab.id}" title="Remove from context">⊖</button>
        <button class="action-btn small danger" data-action="delete" data-document-id="${tab.id}" title="Delete from database">🗑</button>
      </div>
    </div>
  `).join('');

  updateBulkActionVisibility();
}

// Event handlers
async function openSettingsPage() {
  try {
    const runtime = (typeof browser !== 'undefined') ? browser.runtime : chrome.runtime;
    const tabs = (typeof browser !== 'undefined') ? browser.tabs : chrome.tabs;
    await tabs.create({ url: runtime.getURL('settings/settings.html') });
    window.close();
  } catch (error) {
    console.error('Failed to open settings page:', error);
  }
}

async function openCanvasWebUI() {
  try {
    console.log('Opening Canvas server webui...');

    // Get connection settings to build the webui URL
    const response = await sendMessageToBackground('GET_CONNECTION_SETTINGS');

    if (response.success && response.settings) {
      const { serverUrl } = response.settings;

      if (serverUrl) {
        console.log('Opening Canvas webui at:', serverUrl);
        const tabs = (typeof browser !== 'undefined') ? browser.tabs : chrome.tabs;
        await tabs.create({ url: serverUrl });
        window.close();
      } else {
        console.error('No server URL configured');
        // Could show a toast message here
      }
    } else {
      console.error('Failed to get connection settings:', response.error);
    }
  } catch (error) {
    console.error('Failed to open Canvas webui:', error);
  }
}

function handleSearch(event) {
  const query = event.target.value.trim();
  console.log('Fuzzy searching for:', query);

  // Clear search if empty
  if (!query) {
    clearSearch();
    return;
  }

  // Perform fuzzy search based on current tab
  if (currentTab === 'browser-to-canvas') {
    performFuzzySearch(query, 'browser');
  } else if (currentTab === 'canvas-to-browser') {
    performFuzzySearch(query, 'canvas');
  }
}

function performFuzzySearch(query, type) {
  let results = [];
  let container, fuse;

  if (type === 'browser') {
    container = browserToCanvasList;
    fuse = browserTabsFuse;
  } else if (type === 'canvas') {
    container = canvasToBrowserList;
    fuse = canvasTabsFuse;
  } else {
    return;
  }

  // Perform fuzzy search if Fuse instance exists
  if (fuse && query) {
    const searchResults = fuse.search(query);
    console.log(`Fuzzy search results for "${query}":`, searchResults);

    // Extract the items from search results
    results = searchResults.map(result => ({
      item: result.item,
      score: result.score,
      matches: result.matches
    }));
  }

  // Apply search results to UI
  applySearchResults(container, results, type);
}

function applySearchResults(container, results, type) {
  const tabItems = container.querySelectorAll('.tab-item');

  if (results.length === 0) {
    // No search results - hide all items and show search empty state
    tabItems.forEach(item => {
      item.style.display = 'none';
      item.removeAttribute('data-search-match');
    });

    // Show search-specific empty state
    showSearchEmptyState(container, searchInput.value);
    return;
  }

  // Hide any existing empty state
  hideEmptyState(container);

  // Create a set of matching item IDs for quick lookup
  const matchingIds = new Set();
  results.forEach(result => {
    const item = result.item;
    if (type === 'browser') {
      matchingIds.add(item.id);
    } else if (type === 'canvas') {
      matchingIds.add(item.id);
    }
  });

  // Show/hide items based on search results
  tabItems.forEach(item => {
    const itemId = type === 'browser'
      ? parseInt(item.dataset.tabId)
      : parseInt(item.dataset.documentId);

    if (matchingIds.has(itemId)) {
      item.style.display = 'flex';
      item.setAttribute('data-search-match', 'true');

      // Add search highlighting if available
      const searchResult = results.find(r =>
        (type === 'browser' ? r.item.id : r.item.id) === itemId
      );
      highlightSearchMatches(item, searchResult);
    } else {
      item.style.display = 'none';
      item.removeAttribute('data-search-match');
    }
  });
}

function showSearchEmptyState(container, query) {
  let emptyState = container.querySelector('.empty-state');

  if (!emptyState) {
    emptyState = document.createElement('div');
    emptyState.className = 'empty-state search-empty';
    container.appendChild(emptyState);
  }

  emptyState.className = 'empty-state search-empty';
  emptyState.textContent = `No tabs match "${query}"`;
  emptyState.style.display = 'block';
}

function hideEmptyState(container) {
  const emptyState = container.querySelector('.empty-state');
  if (emptyState) {
    emptyState.style.display = 'none';
  }
}

function highlightSearchMatches(itemElement, searchResult) {
  if (!searchResult || !searchResult.matches) return;

  // Remove existing highlights
  clearHighlights(itemElement);

  // Apply highlights based on FuzzySearch matches
  searchResult.matches.forEach(match => {
    const key = match.key;
    let targetElement = null;

    if (key === 'title' || key === 'data.title') {
      targetElement = itemElement.querySelector('.tab-title');
    } else if (key === 'url' || key === 'data.url') {
      targetElement = itemElement.querySelector('.tab-url');
    }

    if (targetElement && match.indices) {
      highlightText(targetElement, match.indices, match.value);
    }
  });
}

function highlightText(element, indices, text) {
  if (!element || !indices || !text) return;

  let highlightedText = '';
  let lastIndex = 0;

  // Sort indices by start position
  const sortedIndices = indices.sort((a, b) => a[0] - b[0]);

  sortedIndices.forEach(([start, end]) => {
    // Add text before highlight
    highlightedText += escapeHtml(text.substring(lastIndex, start));

    // Add highlighted text
    highlightedText += `<mark class="search-highlight">${escapeHtml(text.substring(start, end + 1))}</mark>`;

    lastIndex = end + 1;
  });

  // Add remaining text
  highlightedText += escapeHtml(text.substring(lastIndex));

  element.innerHTML = highlightedText;
}

function clearHighlights(element) {
  const highlights = element.querySelectorAll('.search-highlight');
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
    parent.normalize();
  });
}

function clearSearch() {
  console.log('Clearing search');

  // Show all items in the current tab
  const container = currentTab === 'browser-to-canvas'
    ? browserToCanvasList
    : canvasToBrowserList;

  const tabItems = container.querySelectorAll('.tab-item');
  tabItems.forEach(item => {
    item.style.display = 'flex';
    item.removeAttribute('data-search-match');
    clearHighlights(item);
  });

  // Show original empty state if no items
  if (tabItems.length === 0) {
    let emptyState = container.querySelector('.empty-state');
    if (emptyState) {
      emptyState.className = 'empty-state';
      if (currentTab === 'browser-to-canvas') {
        emptyState.textContent = 'No syncable tabs found';
      } else {
        emptyState.textContent = 'No context tabs to open';
      }
      emptyState.style.display = 'block';
    }
  } else {
    hideEmptyState(container);
  }
}

function initializeFuseInstances() {
  console.log('Initializing FuzzySearch search instances...');

  // Initialize browser tabs fuzzy search
  if (browserTabs && browserTabs.length > 0) {
    browserTabsFuse = new FuzzySearch(browserTabs, fuseConfig);
    console.log('Browser tabs FuzzySearch instance created with', browserTabs.length, 'items');
  } else {
    browserTabsFuse = null;
  }

  // Initialize Canvas documents fuzzy search
  const filteredCanvasTabs = getFilteredCanvasTabs();
  if (filteredCanvasTabs && filteredCanvasTabs.length > 0) {
    canvasTabsFuse = new FuzzySearch(filteredCanvasTabs, fuseConfig);
    console.log('Canvas tabs FuzzySearch instance created with', filteredCanvasTabs.length, 'items');
  } else {
    canvasTabsFuse = null;
  }
}

function filterTabItems(container, query, type) {
  // Legacy function - now handled by performFuzzySearch
  // Keep for backwards compatibility but redirect to fuzzy search
  if (query) {
    performFuzzySearch(query, type);
  } else {
    clearSearch();
  }
}

// Context URL editing handlers
function handleContextUrlClick() {
  // Only allow editing if connected and we have a context or workspace
  if (!currentConnection.connected) return;
  if (currentConnection.mode === 'context' && !currentConnection.context) return;
  if (currentConnection.mode === 'explorer' && !currentConnection.workspace) return;

  // Don't allow editing if showing placeholder text
  const currentText = contextUrl.textContent;
  if (currentText === 'No context' || currentText === 'No context bound' || currentText === 'Not bound') {
    return;
  }

  // Navigate to tree view for path selection
  navigateToTreeView();
}

// ===================================
// VIEW NAVIGATION FUNCTIONS
// ===================================

function navigateToView(viewName) {
  console.log('Navigating to view:', viewName);
  currentView = viewName;
  viewContainer.setAttribute('data-current-view', viewName);

  // Initialize view-specific data when navigating
  if (viewName === 'tree') {
    initializeTreeView();
  } else if (viewName === 'selection') {
    initializeSelectionView();
  }
}

async function navigateToTreeView() {
  // Set up initial path based on current mode
  if (currentConnection.mode === 'context' && currentConnection.context) {
    selectedPath = currentConnection.context.url || '/';
    const workspaceName = currentConnection.context.workspaceName || currentConnection.context.workspace || 'unknown';
    treeTitle.textContent = `Bound context: ${currentConnection.context.id}@${workspaceName}`;
    treeSubtitle.textContent = 'Select a path in the context tree';
  } else if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
    selectedPath = currentWorkspacePath || '/';
    const wsName = getWorkspaceName(currentConnection.workspace);
    treeTitle.textContent = `Workspace Tree: ${wsName}`;
    treeSubtitle.textContent = 'Select a path in the workspace tree';
  }

  // Set input value to show formatted URL for consistency
  if (currentConnection.mode === 'context' && currentConnection.context) {
    const workspaceName = currentConnection.context.workspaceName || currentConnection.context.workspace ||
                         (currentConnection.workspace ? getWorkspaceName(currentConnection.workspace) : null);
    if (workspaceName) {
      treePathInput.value = formatContextUrl(workspaceName, selectedPath);
    } else {
      treePathInput.value = selectedPath;
    }
  } else if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
    const wsName = getWorkspaceName(currentConnection.workspace);
    treePathInput.value = formatContextUrl(wsName, selectedPath);
  } else {
    treePathInput.value = selectedPath;
  }

  // Navigate to tree view
  navigateToView('tree');
}

async function initializeTreeView() {
  console.log('Initializing tree view...');

  try {
    // Load tree data from API
    if (currentConnection.mode === 'context' && currentConnection.context) {
      const response = await sendMessageToBackground('GET_CONTEXT_TREE', { contextId: currentConnection.context.id });
      if (response.success) {
        treeData = response.tree;
        renderTreeView();
      } else {
        throw new Error(response.error || 'Failed to load context tree');
      }
    } else if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
      const wsId = currentConnection.workspace.name || currentConnection.workspace.id;
      const response = await sendMessageToBackground('GET_WORKSPACE_TREE', { workspaceIdOrName: wsId });
      if (response.success) {
        treeData = response.tree;
        renderTreeView();
      } else {
        throw new Error(response.error || 'Failed to load workspace tree');
      }
    }
  } catch (error) {
    console.error('Failed to initialize tree view:', error);
    treeContainer.innerHTML = `<div class="empty-state">Failed to load tree: ${error.message}</div>`;
  }
}

function renderTreeView() {
  if (!treeData) {
    treeContainer.innerHTML = '<div class="empty-state">No tree data available</div>';
    return;
  }

  console.log('Rendering tree view with data:', treeData);
  console.log('Tree data structure:', JSON.stringify(treeData, null, 2));

  const treeHtml = renderTreeNode(treeData, '', 0);
  treeContainer.innerHTML = treeHtml;

  // Add event listeners to tree nodes
  setupTreeEventListeners();
}

function renderTreeNode(node, parentPath, level) {
  // Build the correct path for this node
  const currentPath = level === 0 ? '/' : (parentPath === '/' ? `/${node.name}` : `${parentPath}/${node.name}`);
  const isSelected = selectedPath === currentPath;
  const hasChildren = node.children && node.children.length > 0;
  const isRoot = level === 0;

  console.log(`Rendering node: ${node.name || 'root'}, level: ${level}, parentPath: "${parentPath}", currentPath: "${currentPath}"`);

  let html = '';

  if (isRoot) {
    // Render root node - always represents '/'
    html += `
      <div class="tree-node ${isSelected ? 'selected' : ''}" data-path="/" data-level="0" data-node-id="${node.id || 'root'}">
        <div class="expand-btn"></div>
        <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        ${node.color && node.color !== '#fff' ? `<div class="color-indicator" style="background-color: ${node.color}"></div>` : ''}
        <span class="node-label">/</span>
      </div>
    `;
  }

  if (hasChildren) {
    if (isRoot) {
      html += '<div class="tree-children">';
    }

    for (const child of node.children) {
      // FIXED: Pass the currentPath as parentPath for children (not building path again)
      const childPath = currentPath === '/' ? `/${child.name}` : `${currentPath}/${child.name}`;
      const childSelected = selectedPath === childPath;
      const childHasChildren = child.children && child.children.length > 0;

      console.log(`Child: ${child.name}, parentPath: "${currentPath}", childPath: "${childPath}"`);

      html += `
        <div class="tree-node ${childSelected ? 'selected' : ''}" data-path="${childPath}" data-level="${level + 1}" data-node-id="${child.id || child.name}" style="padding-left: ${(level + 1) * 20}px">
          <button class="expand-btn" ${!childHasChildren ? 'style="visibility: hidden;"' : ''}>
            ${childHasChildren ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>' : ''}
          </button>
          <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          ${child.color && child.color !== '#fff' ? `<div class="color-indicator" style="background-color: ${child.color}"></div>` : ''}
          <span class="node-label">${child.label || child.name}</span>
        </div>
      `;

      if (childHasChildren) {
        html += `<div class="tree-children" style="display: none;">`;
        // FIXED: Pass currentPath as the parentPath for recursive call, not childPath
        html += renderTreeNode(child, currentPath, level + 1);
        html += '</div>';
      }
    }

    if (isRoot) {
      html += '</div>';
    }
  }

  return html;
}

function setupTreeEventListeners() {
  // Add click listeners to tree nodes
  treeContainer.addEventListener('click', (event) => {
    const treeNode = event.target.closest('.tree-node');
    if (treeNode) {
      const path = treeNode.dataset.path;
      selectTreePath(path);
    }

    // Handle expand/collapse
    const expandBtn = event.target.closest('.expand-btn');
    if (expandBtn && expandBtn.querySelector('svg')) {
      event.stopPropagation();
      const treeNode = expandBtn.closest('.tree-node');
      const children = treeNode.nextElementSibling;
      if (children && children.classList.contains('tree-children')) {
        const isExpanded = children.style.display !== 'none';
        children.style.display = isExpanded ? 'none' : 'block';
        const svg = expandBtn.querySelector('svg');
        svg.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(90deg)';
      }
    }
  });
}

function selectTreePath(path) {
  console.log('Selected tree path:', path);
  console.log('Tree node that was clicked:', document.querySelector(`[data-path="${path}"]`));
  selectedPath = path;

  // Always format as absolute URL for display consistency
  let formattedPath = path;
  if (currentConnection.mode === 'context' && currentConnection.context) {
    const workspaceName = currentConnection.context.workspaceName || currentConnection.context.workspace ||
                         (currentConnection.workspace ? getWorkspaceName(currentConnection.workspace) : null);
    if (workspaceName) {
      formattedPath = formatContextUrl(workspaceName, path);
    }
  } else if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
    const wsName = getWorkspaceName(currentConnection.workspace);
    formattedPath = formatContextUrl(wsName, path);
  }

  treePathInput.value = formattedPath;

  // Update selected state in UI
  document.querySelectorAll('.tree-node').forEach(node => {
    node.classList.remove('selected');
  });

  const selectedNode = document.querySelector(`[data-path="${path}"]`);
  if (selectedNode) {
    selectedNode.classList.add('selected');
    console.log('Selected node data:', {
      path: selectedNode.dataset.path,
      nodeId: selectedNode.dataset.nodeId,
      level: selectedNode.dataset.level
    });
  }
}

async function handlePathSubmit() {
  const newPath = treePathInput.value.trim() || '/';
  console.log('Submitting path:', newPath);

  try {
    if (currentConnection.mode === 'context' && currentConnection.context) {
      // For context mode: extract relative path if full URL is provided
      let pathToSend = newPath;
      const parsed = parseContextUrl(newPath);
      if (parsed.workspaceName) {
        // Full URL provided, send relative path to backend
        pathToSend = parsed.path;
      }

      // Update context URL - use direct message format for cross-browser compatibility
      const response = await sendDirectMessageToBackground({
        type: 'context.url.update',
        contextId: currentConnection.context.id,
        url: pathToSend
      });

      if (response.success) {
        currentConnection.context.url = pathToSend;

        // Update display with properly formatted URL
        const workspaceName = currentConnection.context.workspaceName ||
                             currentConnection.context.workspace ||
                             (currentConnection.workspace ? getWorkspaceName(currentConnection.workspace) : null);

        if (workspaceName) {
          contextUrl.textContent = formatContextUrl(workspaceName, pathToSend);
        } else {
          contextUrl.textContent = pathToSend;
        }

        currentWorkspacePath = pathToSend; // Update for display consistency
        console.log('Context URL updated successfully');
      } else {
        throw new Error(response.error || 'Failed to update context URL');
      }
    } else if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
      // For workspace mode: extract relative path if full URL is provided
      let pathToSend = newPath;
      const parsed = parseContextUrl(newPath);
      if (parsed.workspaceName) {
        // Full URL provided, use relative path only
        pathToSend = parsed.path;
      }

      // Update workspace path (must be relative)
      currentWorkspacePath = pathToSend;

      // Update display with properly formatted URL
      const wsName = getWorkspaceName(currentConnection.workspace);
      contextUrl.textContent = formatContextUrl(wsName, pathToSend);

      // Persist the workspace path
      await sendMessageToBackground('SET_MODE_AND_SELECTION', {
        mode: 'explorer',
        workspace: currentConnection.workspace,
        workspacePath: currentWorkspacePath
      });

      console.log('Workspace path updated successfully');
    }

    // Refresh tabs with new path and navigate back to main view
    await loadTabs();
    navigateToView('main');

  } catch (error) {
    console.error('Failed to submit path:', error);
    alert('Failed to update path: ' + error.message);
  }
}

function handleTreePathKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    handlePathSubmit();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    navigateToView('main');
  }
}

// ===================================
// SELECTION VIEW FUNCTIONS
// ===================================

async function initializeSelectionView() {
  console.log('Initializing selection view...');

  // Load contexts and workspaces
  await loadContextsAndWorkspaces();

  // Render the current tab
  renderSelectionTab();
}

function switchSelectionTab(tabName) {
  currentSelectionTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.selection-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  document.querySelectorAll('.selection-tab-content').forEach(content => {
    content.classList.remove('active');
  });

  // Activate selected tab
  const targetTab = document.querySelector(`[data-selection-tab="${tabName}"]`);
  const targetContent = document.getElementById(`${tabName}-selection`);

  if (targetTab && targetContent) {
    targetTab.classList.add('active');
    targetContent.classList.add('active');
  }

  renderSelectionTab();
}

async function loadContextsAndWorkspaces() {
  try {
    // Load contexts
    const contextsResponse = await sendMessageToBackground('GET_CONTEXTS');
    if (contextsResponse.success) {
      console.log('Loaded contexts:', contextsResponse.contexts);
      renderContextsList(contextsResponse.contexts || []);
    } else {
      console.error('Failed to load contexts:', contextsResponse.error);
      contextsList.innerHTML = `<div class="empty-state">Failed to load contexts: ${contextsResponse.error}</div>`;
    }

    // Load workspaces
    const workspacesResponse = await sendMessageToBackground('GET_WORKSPACES');
    if (workspacesResponse.success) {
      console.log('Loaded workspaces:', workspacesResponse.workspaces);
      renderWorkspacesList(workspacesResponse.workspaces || []);
    } else {
      console.error('Failed to load workspaces:', workspacesResponse.error);
      workspacesList.innerHTML = `<div class="empty-state">Failed to load workspaces: ${workspacesResponse.error}</div>`;
    }
  } catch (error) {
    console.error('Failed to load contexts and workspaces:', error);
    contextsList.innerHTML = `<div class="empty-state">Error: ${error.message}</div>`;
    workspacesList.innerHTML = `<div class="empty-state">Error: ${error.message}</div>`;
  }
}

function renderContextsList(contexts) {
  if (!contexts || contexts.length === 0) {
    contextsList.innerHTML = '<div class="empty-state">No contexts available</div>';
    return;
  }

  const contextsHtml = contexts.map(context => `
    <div class="selection-item" data-context-id="${context.id}">
      <div class="selection-item-info">
        <div class="selection-item-name">${context.name || context.id}</div>
        <div class="selection-item-id">${context.id}</div>
        ${context.url ? `<div class="selection-item-url">${context.url}</div>` : ''}
      </div>
      <div class="selection-item-actions">
        <button class="selection-action-btn bind-context-btn" data-context-id="${context.id}" data-context-name="${escapeHtml(context.name || context.id)}" data-context-url="${escapeHtml(context.url || '')}">
          Bind
        </button>
      </div>
    </div>
  `).join('');

  contextsList.innerHTML = contextsHtml;
}

function renderWorkspacesList(workspaces) {
  if (!workspaces || workspaces.length === 0) {
    workspacesList.innerHTML = '<div class="empty-state">No workspaces available</div>';
    return;
  }

  const workspacesHtml = workspaces.map(workspace => `
    <div class="selection-item" data-workspace-id="${workspace.id}">
      <div class="selection-item-info">
        <div class="selection-item-name">${workspace.label || workspace.name || workspace.id}</div>
        <div class="selection-item-id">${workspace.id}</div>
        ${workspace.description ? `<div class="selection-item-url">${workspace.description}</div>` : ''}
      </div>
      <div class="selection-item-actions">
        <button class="selection-action-btn open-workspace-btn"
                data-workspace-id="${workspace.id}"
                data-workspace-name="${escapeHtml(workspace.name || workspace.label)}"
                data-workspace-label="${escapeHtml(workspace.label || workspace.name)}">
          Open Workspace
        </button>
      </div>
    </div>
  `).join('');

  workspacesList.innerHTML = workspacesHtml;
}

function renderSelectionTab() {
  // Tab content is already rendered, just ensure current tab is visible
  console.log('Selection tab rendered:', currentSelectionTab);
}

async function bindToContext(contextId, contextName, contextUrl) {
  try {
    console.log('Binding to context:', contextId);

    // Preserve workspace information if available
    let workspaceInfo = null;
    let workspaceName = null;

    if (currentConnection.workspace) {
      workspaceInfo = currentConnection.workspace;
      workspaceName = getWorkspaceName(workspaceInfo);
    } else {
      // Try to get workspace info from available workspaces if not in current connection
      try {
        const workspacesResponse = await sendMessageToBackground('GET_WORKSPACES');
        if (workspacesResponse.success && workspacesResponse.workspaces && workspacesResponse.workspaces.length > 0) {
          // Prefer "universe" workspace if available, otherwise use first workspace
          workspaceInfo = workspacesResponse.workspaces.find(ws => ws.name === 'universe');
          if (!workspaceInfo) {
            workspaceInfo = workspacesResponse.workspaces[0];
          }
          workspaceName = getWorkspaceName(workspaceInfo);
          console.log('Using fallback workspace for context binding (preferred universe):', workspaceName);
        }
      } catch (error) {
        console.warn('Could not load workspace information for context binding:', error);
      }
    }

    const contextData = {
      id: contextId,
      name: contextName,
      url: contextUrl || '/',
      // Preserve workspace information for proper URL formatting
      workspaceName: workspaceName,
      workspace: workspaceName
    };

    console.log('Context data for binding:', contextData);

    const response = await sendMessageToBackground('BIND_CONTEXT', { context: contextData });

    if (response.success) {
      console.log('Bound to context successfully');

      // Update current connection
      currentConnection.mode = 'context';
      currentConnection.context = contextData;
      // Keep workspace info for reference, but context takes precedence
      if (workspaceInfo) {
        currentConnection.workspace = workspaceInfo;
      }

      console.log('Updated currentConnection:', currentConnection);

      // Update connection status display
      updateConnectionStatus(currentConnection);

      // Navigate to tree view to show the context tree
      await navigateToTreeView();
    } else {
      throw new Error(response.error || 'Failed to bind to context');
    }
  } catch (error) {
    console.error('Failed to bind to context:', error);
    alert('Failed to bind to context: ' + error.message);
  }
}

async function openWorkspace(workspaceId, workspaceName, workspaceLabel) {
  try {
    console.log('Opening workspace:', workspaceId, 'name:', workspaceName);

    const workspaceData = {
      id: workspaceId,
      name: workspaceName, // Now correctly using the actual workspace name
      label: workspaceLabel || workspaceName
    };

    const response = await sendMessageToBackground('OPEN_WORKSPACE', { workspace: workspaceData });

    if (response.success) {
      console.log('Opened workspace successfully');

      // Update current connection
      currentConnection.mode = 'explorer';
      currentConnection.workspace = workspaceData;
      currentConnection.context = null;
      currentWorkspacePath = '/'; // Default to root

      // Update connection status display
      updateConnectionStatus(currentConnection);

      // Navigate to tree view to show the workspace tree
      await navigateToTreeView();
    } else {
      throw new Error(response.error || 'Failed to open workspace');
    }
  } catch (error) {
    console.error('Failed to open workspace:', error);
    alert('Failed to open workspace: ' + error.message);
  }
}

// Event delegation handlers
function handleSelectionActionClick(event) {
  const button = event.target;

  if (button.classList.contains('bind-context-btn')) {
    const contextId = button.dataset.contextId;
    const contextName = button.dataset.contextName;
    const contextUrl = button.dataset.contextUrl;
    bindToContext(contextId, contextName, contextUrl);
  } else if (button.classList.contains('open-workspace-btn')) {
    const workspaceId = button.dataset.workspaceId;
    const workspaceName = button.dataset.workspaceName;
    const workspaceLabel = button.dataset.workspaceLabel;
    openWorkspace(workspaceId, workspaceName, workspaceLabel);
  }
}

function handleSelectionBackClick() {
  // Determine where to go back based on current connection state
  if (currentConnection.context || currentConnection.workspace) {
    // If we have a context or workspace, go to tree view
    navigateToTreeView();
  } else {
    // Otherwise go back to main view
    navigateToView('main');
  }
}

async function handleSyncSettingChange(event) {
  try {
    const settingName = event.target.id;
    const settingValue = event.target.checked;

    console.log('Sync setting changed:', settingName, '=', settingValue);

    // Map checkbox IDs to setting names
    const settingMap = {
      'autoSyncNew': 'autoSyncNewTabs',
      'autoOpenNew': 'autoOpenNewTabs'
    };

    const actualSettingName = settingMap[settingName];
    if (!actualSettingName) {
      console.warn('Unknown sync setting:', settingName);
      return;
    }

    // Create partial settings object
    const settingsUpdate = {
      [actualSettingName]: settingValue
    };

    console.log('Saving sync setting update:', settingsUpdate);

    // Save to background service worker
    const response = await sendMessageToBackground('SET_SYNC_SETTINGS', settingsUpdate);

    if (response.success) {
      console.log('Sync setting saved successfully:', actualSettingName, '=', settingValue);
    } else {
      console.error('Failed to save sync setting:', response.error);
      // Revert checkbox state on failure
      event.target.checked = !settingValue;
    }
  } catch (error) {
    console.error('Failed to save sync setting:', error);
    // Revert checkbox state on failure
    event.target.checked = !event.target.checked;
  }
}

function handleShowSyncedChange(event) {
  showingSyncedTabs = event.target.checked;
  console.log('Show synced tabs toggled:', showingSyncedTabs);

  // Update the section header
  const sectionHeader = document.querySelector('#browser-to-canvas .section-header h3');
  if (sectionHeader) {
    sectionHeader.textContent = showingSyncedTabs ? 'Browser Tabs' : 'Unsynced Browser Tabs';
  }

  // Update filter and re-render browser tabs
  updateBrowserTabsFilter();
  renderBrowserTabs();
}

function handleShowAllCanvasChange(event) {
  showingAllCanvasTabs = event.target.checked;
  console.log('Show all Canvas tabs toggled:', showingAllCanvasTabs);

  // Re-render Canvas tabs with new filter
  renderCanvasTabs();

  // Reinitialize fuzzy search with filtered data
  initializeFuseInstances();
}

function handleBrowserTabSelection(event) {
  const tabId = parseInt(event.target.dataset.tabId);
  if (event.target.checked) {
    selectedBrowserTabs.add(tabId);
  } else {
    selectedBrowserTabs.delete(tabId);
  }

  updateBulkActionVisibility();
}

function handleCanvasTabSelection(event) {
  const documentId = parseInt(event.target.dataset.documentId);
  if (event.target.checked) {
    selectedCanvasTabs.add(documentId);
  } else {
    selectedCanvasTabs.delete(documentId);
  }

  updateBulkActionVisibility();
}

function updateBulkActionVisibility() {
  // Show/hide bulk actions for browser tabs
  if (selectedBrowserTabs.size > 0) {
    browserBulkActions.style.display = 'flex';
  } else {
    browserBulkActions.style.display = 'none';
  }

  // Show/hide bulk actions for Canvas tabs
  if (selectedCanvasTabs.size > 0) {
    canvasBulkActions.style.display = 'flex';
  } else {
    canvasBulkActions.style.display = 'none';
  }
}

// Tab action handlers (now called via event delegation)
async function handleSyncTab(tabId) {
  try {
    console.log('Syncing tab:', tabId);

    // Find the tab
    const tab = browserTabs.find(t => t.id === tabId);
    if (!tab) {
      console.error('Tab not found:', tabId);
      return;
    }

    const response = await sendMessageToBackground('SYNC_TAB', { tab });
    console.log('Sync tab response:', response);

    if (response.success) {
      await loadTabs(); // Refresh lists
    }
  } catch (error) {
    console.error('Failed to sync tab:', error);
  }
}

async function handleCloseTab(tabId) {
  try {
    console.log('Closing tab:', tabId);

    const response = await sendMessageToBackground('CLOSE_TAB', { tabId });
    console.log('Close tab response:', response);

    if (response.success) {
      await loadTabs(); // Refresh lists
    }
  } catch (error) {
    console.error('Failed to close tab:', error);
  }
}

async function handlePinTab(tabId) {
  try {
    console.log('Toggling pin for tab:', tabId);

    const response = await sendMessageToBackground('TOGGLE_PIN_TAB', { tabId });
    console.log('Pin tab response:', response);

    if (response.success) {
      await loadTabs(); // Refresh lists to update pin state
    }
  } catch (error) {
    console.error('Failed to toggle pin tab:', error);
  }
}

async function handleFocusTab(tabId) {
  try {
    console.log('Focusing tab:', tabId);

    const response = await sendMessageToBackground('FOCUS_TAB', { tabId });
    console.log('Focus tab response:', response);

    if (!response.success) {
      console.error('Failed to focus tab:', response.error);
    }
  } catch (error) {
    console.error('Failed to focus tab:', error);
  }
}

async function handleOpenCanvasTab(documentId) {
  try {
    console.log('Opening Canvas document:', documentId);

    // Find the Canvas document
    const document = canvasTabs.find(doc => doc.id === documentId);
    if (!document) {
      console.error('Canvas document not found:', documentId);
      return;
    }

    const response = await sendMessageToBackground('OPEN_CANVAS_DOCUMENT', { document });
    console.log('Open Canvas document response:', response);

    if (response.success) {
      await loadTabs(); // Refresh lists
    } else {
      console.error('Failed to open Canvas document:', response.error);
    }
  } catch (error) {
    console.error('Failed to open Canvas tab:', error);
  }
}

async function handleRemoveCanvasTab(documentId) {
  try {
    console.log('Removing Canvas document:', documentId);

    // Find the Canvas document
    const document = canvasTabs.find(doc => doc.id === documentId);
    if (!document) {
      console.error('Canvas document not found:', documentId);
      return;
    }

    const response = await sendMessageToBackground('REMOVE_CANVAS_DOCUMENT', {
      document,
      closeTab: false
    });
    console.log('Remove Canvas document response:', response);

    if (response.success) {
      await loadTabs(); // Refresh lists
    } else {
      console.error('Failed to remove Canvas document:', response.error);
    }
  } catch (error) {
    console.error('Failed to remove from context:', error);
  }
}

async function handleDeleteCanvasTab(documentId) {
  try {
    console.log('Deleting Canvas document:', documentId);

    // Find the Canvas document
    const document = canvasTabs.find(doc => doc.id === documentId);
    if (!document) {
      console.error('Canvas document not found:', documentId);
      return;
    }

    // Use the removeDocument API with deleteFromDatabase option
    const response = await sendMessageToBackground('REMOVE_CANVAS_DOCUMENT', {
      document,
      closeTab: true
    });
    console.log('Delete Canvas document response:', response);

    if (response.success) {
      await loadTabs(); // Refresh lists
    } else {
      console.error('Failed to delete Canvas document:', response.error);
    }
  } catch (error) {
    console.error('Failed to delete from database:', error);
  }
}

// Event delegation handlers
function handleBrowserTabAction(event) {
  console.log('Browser tab action event triggered:', event.target);

  const button = event.target.closest('button[data-action]');
  console.log('Found button:', button);

  // Check if it's a button action
  if (button) {
    event.preventDefault();
    event.stopPropagation();

    const action = button.dataset.action;
    const tabId = parseInt(button.dataset.tabId);

    console.log('Action:', action, 'TabId:', tabId);

    if (!tabId) {
      console.error('No tabId found for action:', action);
      return;
    }

    switch (action) {
      case 'sync':
        console.log('Calling handleSyncTab with tabId:', tabId);
        handleSyncTab(tabId);
        break;
      case 'close':
        console.log('Calling handleCloseTab with tabId:', tabId);
        handleCloseTab(tabId);
        break;
      case 'pin':
        console.log('Calling handlePinTab with tabId:', tabId);
        handlePinTab(tabId);
        break;
      default:
        console.warn('Unknown browser tab action:', action);
    }
    return;
  }

  // Check if it's a click on the tab info area (for focusing)
  const tabInfo = event.target.closest('.tab-info');
  const tabItem = event.target.closest('.tab-item');

  if (tabInfo && tabItem) {
    const tabId = parseInt(tabItem.dataset.tabId);

    console.log('Tab info clicked, focusing tab:', tabId);

    if (tabId) {
      event.preventDefault();
      event.stopPropagation();
      handleFocusTab(tabId);
    }
  }
}

function handleCanvasTabAction(event) {
  console.log('Canvas tab action event triggered:', event.target);

  const button = event.target.closest('button[data-action]');
  console.log('Found button:', button);

  if (!button) return;

  event.preventDefault();
  event.stopPropagation();

  const action = button.dataset.action;
  const documentId = parseInt(button.dataset.documentId);

  console.log('Action:', action, 'DocumentId:', documentId);

  if (!documentId) {
    console.error('No documentId found for action:', action);
    return;
  }

  switch (action) {
    case 'open':
      console.log('Calling handleOpenCanvasTab with documentId:', documentId);
      handleOpenCanvasTab(documentId);
      break;
    case 'remove':
      console.log('Calling handleRemoveCanvasTab with documentId:', documentId);
      handleRemoveCanvasTab(documentId);
      break;
    case 'delete':
      console.log('Calling handleDeleteCanvasTab with documentId:', documentId);
      handleDeleteCanvasTab(documentId);
      break;
    default:
      console.warn('Unknown Canvas tab action:', action);
  }
}

function handleBrowserTabCheckbox(event) {
  const checkbox = event.target.closest('input[type="checkbox"][data-tab-id]');
  if (!checkbox) return;

  const tabId = parseInt(checkbox.dataset.tabId);
  if (!tabId) return;

  if (checkbox.checked) {
    selectedBrowserTabs.add(tabId);
  } else {
    selectedBrowserTabs.delete(tabId);
  }

  updateBulkActionVisibility();
}

function handleCanvasTabCheckbox(event) {
  const checkbox = event.target.closest('input[type="checkbox"][data-document-id]');
  if (!checkbox) return;

  const documentId = parseInt(checkbox.dataset.documentId);
  if (!documentId) return;

  if (checkbox.checked) {
    selectedCanvasTabs.add(documentId);
  } else {
    selectedCanvasTabs.delete(documentId);
  }

  updateBulkActionVisibility();
}

// Event delegation for favicon error handling
function handleImageError(event) {
  const img = event.target;
  if (img && img.tagName === 'IMG' && img.classList.contains('tab-favicon')) {
    console.log('Favicon failed to load, using fallback:', img.src);
    const fallback = img.dataset.fallback || '../assets/icons/logo-br_64x64.png';
    if (img.src !== fallback) {
      img.src = fallback;
    }
  }
}

// URL formatting utilities
function formatContextUrl(workspaceName, contextPath) {
  if (!workspaceName || !contextPath) {
    return contextPath || '-';
  }

  // If contextPath already contains '://', extract the path part
  if (contextPath.includes('://')) {
    const pathPart = contextPath.split('://')[1] || '/';
    return `${workspaceName}://${pathPart}`;
  }

  // Ensure path starts with '/' then remove it for the final URL format
  const normalizedPath = contextPath.startsWith('/') ? contextPath : `/${contextPath}`;
  const pathWithoutLeadingSlash = normalizedPath.substring(1);
  // If path is just "/", pathWithoutLeadingSlash will be empty, which is correct for "workspace://"
  return `${workspaceName}://${pathWithoutLeadingSlash}`;
}

function parseContextUrl(contextUrl) {
  if (!contextUrl || !contextUrl.includes('://')) {
    return { workspaceName: null, path: contextUrl || '/' };
  }

  const [workspaceName, path] = contextUrl.split('://');
  return {
    workspaceName: workspaceName || null,
    path: path ? `/${path}` : '/' // Ensure path always starts with '/' for internal use
  };
}

function getWorkspaceName(workspace) {
  // Prioritize workspace.name specifically, only fall back to label, never use ID for URL
  if (!workspace) return 'unknown';

  // Ensure we're using the actual name, not ID
  const name = workspace.name || workspace.label;

  // Validate that name is not a UUID (in case there are still issues)
  if (name && !isUUID(name)) {
    return name;
  }

  return workspace.label || 'unknown';
}

function isUUID(str) {
  if (!str) return false;
  // UUID pattern: 8-4-4-4-12 hex chars with dashes
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}

// Utility to ensure workspace information is available
async function ensureWorkspaceInfo() {
  if (!currentConnection.workspace &&
      (!currentConnection.context || (!currentConnection.context.workspaceName && !currentConnection.context.workspace))) {
    console.log('No workspace info available, attempting to load...');
    try {
      const workspacesResponse = await sendMessageToBackground('GET_WORKSPACES');
      if (workspacesResponse.success && workspacesResponse.workspaces && workspacesResponse.workspaces.length > 0) {
        // Prefer "universe" workspace if available, otherwise use first workspace
        let workspace = workspacesResponse.workspaces.find(ws => ws.name === 'universe');
        if (!workspace) {
          workspace = workspacesResponse.workspaces[0];
        }
        currentConnection.workspace = workspace;
        console.log('Loaded workspace info (preferred universe):', workspace);
        return workspace;
      }
    } catch (error) {
      console.warn('Could not load workspace information:', error);
    }
  }
  return currentConnection.workspace;
}

// Utility functions
async function sendMessageToBackground(type, data = null) {
  return new Promise((resolve, reject) => {
    // Cross-browser compatibility: Firefox uses 'browser', Chrome uses 'chrome'
    const runtime = (typeof browser !== 'undefined') ? browser.runtime : chrome.runtime;

    runtime.sendMessage({ type, data }, (response) => {
      const lastError = (typeof browser !== 'undefined') ? browser.runtime.lastError : chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// Special function for direct message sending (for messages that need specific format)
async function sendDirectMessageToBackground(message) {
  return new Promise((resolve, reject) => {
    // Cross-browser compatibility: Firefox uses 'browser', Chrome uses 'chrome'
    const runtime = (typeof browser !== 'undefined') ? browser.runtime : chrome.runtime;

    runtime.sendMessage(message, (response) => {
      const lastError = (typeof browser !== 'undefined') ? browser.runtime.lastError : chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Bulk action handlers
async function handleSyncAll() {
  try {
    console.log('🔧 handleSyncAll: Starting sync all operation');

    // Use ALL browser tabs, not just the currently filtered ones
    const allSyncableTabs = allBrowserTabs.filter(tab => {
      // Only sync tabs that aren't already synced and are syncable
      return !syncedTabIds.has(tab.id);
    });

    console.log('🔧 handleSyncAll: Tab filtering results:', {
      totalBrowserTabs: allBrowserTabs.length,
      syncedTabIds: Array.from(syncedTabIds),
      unsyncedTabs: allSyncableTabs.length
    });

    console.log('🔧 handleSyncAll: Sample tab data:', allBrowserTabs.slice(0, 2).map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      status: tab.status,
      discarded: tab.discarded,
      windowId: tab.windowId,
      active: tab.active
    })));

    if (allSyncableTabs.length === 0) {
      console.log('❌ handleSyncAll: No browser tabs to sync');
      return;
    }

    console.log(`🔧 handleSyncAll: Syncing ${allSyncableTabs.length} unsynced browser tabs out of ${allBrowserTabs.length} total`);
    console.log('🔧 handleSyncAll: Tab details:', allSyncableTabs.map(tab => ({ id: tab.id, title: tab.title, url: tab.url })));

    const tabIds = allSyncableTabs.map(tab => tab.id);
    console.log('🔧 handleSyncAll: Sending message to background with tabIds:', tabIds);

    const response = await sendMessageToBackground('SYNC_MULTIPLE_TABS', { tabIds });
    console.log('🔧 handleSyncAll: Received response from background:', response);

    if (response.success) {
      console.log(`Synced ${response.successful}/${response.total} tabs`);
      await loadTabs(); // Refresh lists
    } else {
      console.error('Failed to sync all tabs:', response.error);
    }
  } catch (error) {
    console.error('Failed to sync all tabs:', error);
  }
}

async function handleCloseAll() {
  try {
    console.log('Closing all browser tabs');

    if (browserTabs.length === 0) {
      console.log('No browser tabs to close');
      return;
    }

    for (const tab of browserTabs) {
      await sendMessageToBackground('CLOSE_TAB', { tabId: tab.id });
    }

    console.log('All browser tabs closed');
    await loadTabs(); // Refresh lists
  } catch (error) {
    console.error('Failed to close all tabs:', error);
  }
}

async function handleOpenAll() {
  try {
    console.log('Opening all Canvas tabs');

    const filteredCanvasTabs = getFilteredCanvasTabs();

    if (filteredCanvasTabs.length === 0) {
      console.log('No Canvas tabs to open');
      return;
    }

    console.log(`Opening ${filteredCanvasTabs.length} Canvas tabs`);

    // Open tabs with better error handling
    let opened = 0;
    let failed = 0;

    for (const document of filteredCanvasTabs) {
      try {
        const response = await sendMessageToBackground('OPEN_CANVAS_DOCUMENT', { document });
        if (response.success) {
          opened++;
        } else {
          failed++;
          console.error(`Failed to open tab: ${document.data?.title}`, response.error);
        }
      } catch (error) {
        failed++;
        console.error(`Error opening tab: ${document.data?.title}`, error);
      }
    }

    console.log(`Opened ${opened} tabs, ${failed} failed`);
    await loadTabs(); // Refresh lists
  } catch (error) {
    console.error('Failed to open all Canvas tabs:', error);
  }
}

async function handleSyncSelected() {
  try {
    const selectedIds = Array.from(selectedBrowserTabs);
    console.log('Syncing selected tabs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No tabs selected for syncing');
      return;
    }

    const response = await sendMessageToBackground('SYNC_MULTIPLE_TABS', { tabIds: selectedIds });
    console.log('Sync selected response:', response);

    if (response.success) {
      console.log(`Synced ${response.successful}/${response.total} selected tabs`);
      selectedBrowserTabs.clear();
      await loadTabs(); // Refresh lists
    } else {
      console.error('Failed to sync selected tabs:', response.error);
    }
  } catch (error) {
    console.error('Failed to sync selected tabs:', error);
  }
}

async function handleCloseSelected() {
  try {
    const selectedIds = Array.from(selectedBrowserTabs);
    console.log('Closing selected tabs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No tabs selected for closing');
      return;
    }

    for (const tabId of selectedIds) {
      await sendMessageToBackground('CLOSE_TAB', { tabId });
    }

    console.log('Selected browser tabs closed');
    selectedBrowserTabs.clear();
    await loadTabs(); // Refresh lists
  } catch (error) {
    console.error('Failed to close selected tabs:', error);
  }
}

async function handleOpenSelected() {
  try {
    const selectedIds = Array.from(selectedCanvasTabs);
    console.log('Opening selected Canvas tabs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No Canvas tabs selected for opening');
      return;
    }

    for (const documentId of selectedIds) {
      const document = canvasTabs.find(doc => doc.id === documentId);
      if (document) {
        await sendMessageToBackground('OPEN_CANVAS_DOCUMENT', { document });
      }
    }

    console.log('Selected Canvas tabs opened');
    selectedCanvasTabs.clear();
    await loadTabs(); // Refresh lists
  } catch (error) {
    console.error('Failed to open selected Canvas tabs:', error);
  }
}

async function handleRemoveSelected() {
  try {
    const selectedIds = Array.from(selectedCanvasTabs);
    console.log('Removing selected Canvas tabs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No Canvas tabs selected for removal');
      return;
    }

    for (const documentId of selectedIds) {
      const document = canvasTabs.find(doc => doc.id === documentId);
      if (document) {
        await sendMessageToBackground('REMOVE_CANVAS_DOCUMENT', {
          document,
          closeTab: false
        });
      }
    }

    console.log('Selected Canvas tabs removed');
    selectedCanvasTabs.clear();
    await loadTabs(); // Refresh lists
  } catch (error) {
    console.error('Failed to remove selected Canvas tabs:', error);
  }
}

async function handleDeleteSelected() {
  try {
    const selectedIds = Array.from(selectedCanvasTabs);
    console.log('Deleting selected Canvas tabs:', selectedIds);

    if (selectedIds.length === 0) {
      console.log('No Canvas tabs selected for deletion');
      return;
    }

    for (const documentId of selectedIds) {
      const document = canvasTabs.find(doc => doc.id === documentId);
      if (document) {
        await sendMessageToBackground('REMOVE_CANVAS_DOCUMENT', {
          document,
          closeTab: true
        });
      }
    }

    console.log('Selected Canvas tabs deleted');
    selectedCanvasTabs.clear();
    await loadTabs(); // Refresh lists
  } catch (error) {
    console.error('Failed to delete selected Canvas tabs:', error);
  }
}
