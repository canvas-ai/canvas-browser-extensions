// Canvas Extension Sidebar JavaScript
// Optimized sidebar with tree view and window grouping

import FuzzySearch from './fuse.js';

// Cross-browser compatibility
const runtime = (typeof browser !== 'undefined') ? browser.runtime : chrome.runtime;
const tabs = (typeof browser !== 'undefined') ? browser.tabs : chrome.tabs;

// DOM elements
let connectionStatus, connectionText, contextInfo, contextId, contextUrl;
let searchInput, sendNewTabsToCanvas, openTabsAddedToCanvas, showSyncedTabs, showAllCanvasTabs;
let browserToCanvasList, canvasToBrowserList;
let settingsBtn, logoBtn, selectorBtn;
let browserBulkActions, canvasBulkActions;
let syncSelectedBtn, closeSelectedBtn, openSelectedBtn, removeSelectedBtn, deleteSelectedBtn;
let selectAllBrowser, selectAllCanvas;
let browserTabsHeader, canvasTabsHeader;
let toast, contextMenu;
let treeContainer, treePathInput, pathSubmitBtn;
let treeTabBtn, browserToCanvasTab, canvasToBrowserTab;

// State
let currentConnection = { connected: false, context: null, mode: 'explorer', workspace: null };
let currentWorkspacePath = '/';
let browserTabs = [];
let canvasTabs = [];
let allBrowserTabs = [];
const syncedTabIds = new Set();
let showingSyncedTabs = false;
let showingAllCanvasTabs = false;
const selectedBrowserTabs = new Set();
const selectedCanvasTabs = new Set();
let currentTab = 'tree-tab';
let treeData = null;
let expandedNodes = new Set();

// Window grouping
let windowGroups = new Map();

// Initialize sidebar
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  setupEventListeners();
  await loadInitialData();
});

// Listen for messages from service worker
runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Sidebar received message:', message);

  if (message.type === 'BACKGROUND_EVENT') {
    switch (message.eventType) {
    case 'tabs.refresh':
      loadTabs();
      break;
    case 'context.changed':
    case 'context.url.set':
      if (message.data.contextId && message.data.url) {
        if (currentConnection.context) {
          currentConnection.context.id = message.data.contextId;
          currentConnection.context.url = message.data.url;
        }
        updateConnectionStatus(currentConnection);
      }
      loadTabs();
      break;
    }
  }
});

function initializeElements() {
  connectionStatus = document.getElementById('connectionStatus');
  connectionText = document.getElementById('connectionText');
  contextInfo = document.getElementById('contextInfo');
  contextId = document.getElementById('contextId');
  contextUrl = document.getElementById('contextUrl');
  logoBtn = document.getElementById('logoBtn');
  searchInput = document.getElementById('searchInput');
  sendNewTabsToCanvas = document.getElementById('sendNewTabsToCanvas');
  openTabsAddedToCanvas = document.getElementById('openTabsAddedToCanvas');
  showSyncedTabs = document.getElementById('showSyncedTabs');
  showAllCanvasTabs = document.getElementById('showAllCanvasTabs');
  selectorBtn = document.getElementById('selectorBtn');
  settingsBtn = document.getElementById('settingsBtn');
  treeTabBtn = document.getElementById('treeTabBtn');
  browserToCanvasTab = document.getElementById('browserToCanvasTab');
  canvasToBrowserTab = document.getElementById('canvasToBrowserTab');
  browserToCanvasList = document.getElementById('browserToCanvasList');
  canvasToBrowserList = document.getElementById('canvasToBrowserList');
  browserBulkActions = document.getElementById('browserBulkActions');
  canvasBulkActions = document.getElementById('canvasBulkActions');
  syncSelectedBtn = document.getElementById('syncSelectedBtn');
  closeSelectedBtn = document.getElementById('closeSelectedBtn');
  openSelectedBtn = document.getElementById('openSelectedBtn');
  removeSelectedBtn = document.getElementById('removeSelectedBtn');
  deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  selectAllBrowser = document.getElementById('selectAllBrowser');
  selectAllCanvas = document.getElementById('selectAllCanvas');
  browserTabsHeader = document.getElementById('browserTabsHeader');
  canvasTabsHeader = document.getElementById('canvasTabsHeader');
  treeContainer = document.getElementById('treeContainer');
  treePathInput = document.getElementById('treePathInput');
  pathSubmitBtn = document.getElementById('pathSubmitBtn');
  toast = document.getElementById('toast');
  contextMenu = document.getElementById('contextMenu');
}

function setupEventListeners() {
  logoBtn.addEventListener('click', openCanvasWebUI);
  selectorBtn.addEventListener('click', openSettings);
  settingsBtn.addEventListener('click', openSettings);
  
  // Tab navigation
  treeTabBtn.addEventListener('click', () => switchTab('tree-tab'));
  browserToCanvasTab.addEventListener('click', () => switchTab('browser-to-canvas'));
  canvasToBrowserTab.addEventListener('click', () => switchTab('canvas-to-browser'));

  // Search
  searchInput.addEventListener('input', handleSearch);

  // Sync settings
  sendNewTabsToCanvas?.addEventListener('change', handleSyncSettingChange);
  openTabsAddedToCanvas?.addEventListener('change', handleSyncSettingChange);
  showSyncedTabs?.addEventListener('change', handleShowSyncedChange);
  showAllCanvasTabs?.addEventListener('change', handleShowAllCanvasChange);

  // Bulk actions
  syncSelectedBtn?.addEventListener('click', () => handleSyncSelected());
  closeSelectedBtn?.addEventListener('click', () => handleCloseSelected());
  openSelectedBtn?.addEventListener('click', () => handleOpenSelected());
  removeSelectedBtn?.addEventListener('click', () => handleRemoveSelected());
  deleteSelectedBtn?.addEventListener('click', () => handleDeleteSelected());

  // Select all
  selectAllBrowser?.addEventListener('change', handleSelectAllBrowser);
  selectAllCanvas?.addEventListener('change', handleSelectAllCanvas);

  // Tree controls
  pathSubmitBtn.addEventListener('click', handlePathSubmit);
  treePathInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePathSubmit();
  });

  // Event delegation for tab actions
  browserToCanvasList?.addEventListener('click', handleBrowserTabAction);
  canvasToBrowserList?.addEventListener('click', handleCanvasTabAction);

  // Context menu
  document.addEventListener('click', () => hideContextMenu());
  contextMenu?.addEventListener('click', handleContextMenuAction);
}

async function loadInitialData() {
  try {
    const response = await sendMessageToBackground('GET_CONNECTION_STATUS');
    currentConnection = response;
    if (currentConnection.mode === 'explorer' && typeof response.workspacePath === 'string') {
      currentWorkspacePath = response.workspacePath || '/';
    }
    updateConnectionStatus(currentConnection);

    showSyncedTabs.checked = false;
    showingSyncedTabs = false;

    await loadTabs();
    await loadSyncSettings();
    await loadTree();
  } catch (error) {
    console.error('Failed to load initial data:', error);
  }
}

function updateConnectionStatus(connection) {
  if (connection.connected) {
    connectionStatus.className = 'status-dot connected';
    connectionText.textContent = 'Connected';

    if ((connection.mode === 'context') && connection.context) {
      contextId.textContent = `Context: ${connection.context.id}`;
      const workspaceName = connection.context.workspaceName || connection.context.workspace ||
                           (connection.workspace ? getWorkspaceName(connection.workspace) : null);
      const contextPath = connection.context.url || '/';
      if (workspaceName) {
        contextUrl.textContent = formatContextUrl(workspaceName, contextPath);
      } else {
        contextUrl.textContent = contextPath;
      }
    } else if ((connection.mode === 'explorer') && connection.workspace) {
      const wsName = getWorkspaceName(connection.workspace);
      contextId.textContent = `Workspace: ${wsName}`;
      const workspacePath = currentWorkspacePath || '/';
      contextUrl.textContent = formatContextUrl(wsName, workspacePath);
    } else {
      contextId.textContent = '-';
      contextUrl.textContent = 'Not bound';
    }
  } else {
    connectionStatus.className = 'status-dot disconnected';
    connectionText.textContent = 'Disconnected';
    contextId.textContent = '-';
    contextUrl.textContent = 'No context';
  }
}

async function loadTree() {
  if (!currentConnection.connected) {
    treeContainer.innerHTML = '<div class="empty-state">Not connected</div>';
    return;
  }

  try {
    treeContainer.innerHTML = '<div class="loading-state">Loading tree...</div>';

    if (currentConnection.mode === 'context' && currentConnection.context) {
      const response = await sendMessageToBackground('GET_CONTEXT_TREE', { contextId: currentConnection.context.id });
      if (response.success) {
        treeData = response.tree;
        renderTree();
      } else {
        throw new Error(response.error || 'Failed to load context tree');
      }
    } else if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
      const wsId = currentConnection.workspace.name || currentConnection.workspace.id;
      const response = await sendMessageToBackground('GET_WORKSPACE_TREE', { workspaceIdOrName: wsId });
      if (response.success) {
        treeData = response.tree;
        renderTree();
      } else {
        throw new Error(response.error || 'Failed to load workspace tree');
      }
    }
  } catch (error) {
    console.error('Failed to load tree:', error);
    treeContainer.innerHTML = `<div class="empty-state">Failed to load tree: ${error.message}</div>`;
  }
}

function renderTree() {
  if (!treeData) {
    treeContainer.innerHTML = '<div class="empty-state">No tree data</div>';
    return;
  }

  treeContainer.innerHTML = '';
  renderTreeNode(treeData, '', 0, treeContainer);
}

function renderTreeNode(node, parentPath, level, container) {
  const currentPath = level === 0 ? '/' : (parentPath === '/' ? `/${node.name}` : `${parentPath}/${node.name}`);
  const hasChildren = node.children && node.children.length > 0;
  const isRoot = level === 0;
  const isExpanded = expandedNodes.has(currentPath);

  const nodeDiv = document.createElement('div');
  nodeDiv.className = 'tree-node';
  nodeDiv.dataset.path = currentPath;
  nodeDiv.dataset.level = level;

  // Expand button
  const expandBtn = document.createElement('button');
  expandBtn.className = 'expand-btn' + (isExpanded ? ' expanded' : '');
  expandBtn.textContent = '[+]';
  if (!hasChildren) expandBtn.style.visibility = 'hidden';
  expandBtn.onclick = (e) => {
    e.stopPropagation();
    toggleTreeNode(currentPath);
  };

  // Folder icon
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.classList.add('folder-icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z');
  icon.appendChild(path);

  // Label
  const label = document.createElement('span');
  label.className = 'node-label';
  label.textContent = isRoot ? '/' : (node.label || node.name);

  // Tab count badge
  const tabCount = document.createElement('span');
  tabCount.className = 'tab-count';
  tabCount.style.display = 'none';

  nodeDiv.appendChild(expandBtn);
  nodeDiv.appendChild(icon);
  nodeDiv.appendChild(label);
  nodeDiv.appendChild(tabCount);

  // Context menu on right-click
  nodeDiv.oncontextmenu = (e) => {
    e.preventDefault();
    showContextMenu(e, currentPath, node);
  };

  // Click to select path
  nodeDiv.onclick = () => selectTreePath(currentPath);

  container.appendChild(nodeDiv);

  // Children container
  if (hasChildren) {
    const childrenDiv = document.createElement('div');
    childrenDiv.className = 'tree-children';
    childrenDiv.style.display = isExpanded ? 'block' : 'none';
    
    for (const child of node.children) {
      renderTreeNode(child, currentPath, level + 1, childrenDiv);
    }

    container.appendChild(childrenDiv);
  }

  // Tabs list (loaded on demand)
  const tabsDiv = document.createElement('div');
  tabsDiv.className = 'tree-tabs-list';
  tabsDiv.id = `tabs-${currentPath.replace(/\//g, '-')}`;
  tabsDiv.style.display = 'none';
  container.appendChild(tabsDiv);
}

async function toggleTreeNode(path) {
  const node = document.querySelector(`[data-path="${path}"]`);
  if (!node) return;

  const expandBtn = node.querySelector('.expand-btn');
  const childrenDiv = node.nextElementSibling;
  const tabsDiv = childrenDiv?.nextElementSibling;

  if (expandedNodes.has(path)) {
    // Collapse
    expandedNodes.delete(path);
    expandBtn.classList.remove('expanded');
    if (childrenDiv) childrenDiv.style.display = 'none';
    if (tabsDiv) tabsDiv.style.display = 'none';
  } else {
    // Expand
    expandedNodes.add(path);
    expandBtn.classList.add('expanded');
    if (childrenDiv) childrenDiv.style.display = 'block';
    
    // Load tabs for this path
    await loadTabsForPath(path, tabsDiv);
  }
}

async function loadTabsForPath(path, container) {
  if (!container) return;

  try {
    let docs = [];
    if (currentConnection.mode === 'context' && currentConnection.context) {
      // For context mode, would need to filter by path - not directly supported
      // Skip for now
      return;
    } else if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
      const wsId = currentConnection.workspace.name || currentConnection.workspace.id;
      const response = await sendMessageToBackground('GET_WORKSPACE_DOCUMENTS', {
        workspaceIdOrName: wsId,
        contextSpec: path
      });
      if (response.success) {
        docs = response.documents || [];
      }
    }

    if (docs.length > 0) {
      container.innerHTML = '';
      container.style.display = 'block';

      // Update tab count badge
      const node = document.querySelector(`[data-path="${path}"]`);
      if (node) {
        const badge = node.querySelector('.tab-count');
        badge.textContent = docs.length;
        badge.style.display = 'inline-block';
        node.classList.add('has-tabs');
      }

      docs.forEach(doc => {
        const tabItem = createTabItem(doc, 'canvas');
        container.appendChild(tabItem);
      });
    }
  } catch (error) {
    console.error('Failed to load tabs for path:', path, error);
  }
}

function selectTreePath(path) {
  document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('selected'));
  const node = document.querySelector(`[data-path="${path}"]`);
  if (node) node.classList.add('selected');

  if (currentConnection.mode === 'context' && currentConnection.context) {
    const workspaceName = currentConnection.context.workspaceName || currentConnection.context.workspace ||
                         (currentConnection.workspace ? getWorkspaceName(currentConnection.workspace) : null);
    if (workspaceName) {
      treePathInput.value = formatContextUrl(workspaceName, path);
    } else {
      treePathInput.value = path;
    }
  } else if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
    const wsName = getWorkspaceName(currentConnection.workspace);
    treePathInput.value = formatContextUrl(wsName, path);
  }
}

async function handlePathSubmit() {
  const newPath = treePathInput.value.trim() || '/';
  
  try {
    const parsed = parseContextUrl(newPath);
    const pathToSend = parsed.workspaceName ? parsed.path : newPath;

    if (currentConnection.mode === 'context' && currentConnection.context) {
      const response = await sendDirectMessageToBackground({
        type: 'context.url.update',
        contextId: currentConnection.context.id,
        url: pathToSend
      });
      if (response.success) {
        currentConnection.context.url = pathToSend;
        contextUrl.textContent = treePathInput.value;
      }
    } else if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
      const wsId = currentConnection.workspace.name || currentConnection.workspace.id;
      await sendMessageToBackground('INSERT_WORKSPACE_PATH', {
        path: pathToSend,
        workspaceIdOrName: wsId,
        autoCreateLayers: true
      });
      currentWorkspacePath = pathToSend;
      contextUrl.textContent = treePathInput.value;
      await sendMessageToBackground('SET_MODE_AND_SELECTION', {
        mode: 'explorer',
        workspace: currentConnection.workspace,
        workspacePath: currentWorkspacePath
      });
    }

    await loadTabs();
    await loadTree();
  } catch (error) {
    console.error('Failed to submit path:', error);
    showToast('Failed to update path: ' + error.message);
  }
}

function showContextMenu(event, path, node) {
  contextMenu.style.display = 'block';
  contextMenu.style.left = event.pageX + 'px';
  contextMenu.style.top = event.pageY + 'px';
  contextMenu.dataset.path = path;
  contextMenu.dataset.nodeName = node.name || '';
}

function hideContextMenu() {
  contextMenu.style.display = 'none';
}

async function handleContextMenuAction(event) {
  const item = event.target.closest('.context-menu-item');
  if (!item) return;

  const action = item.dataset.action;
  const path = contextMenu.dataset.path;
  const nodeName = contextMenu.dataset.nodeName;

  hideContextMenu();

  if (action === 'create-subfolder') {
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;

    const newPath = path === '/' ? `/${folderName}` : `${path}/${folderName}`;
    
    try {
      if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
        const wsId = currentConnection.workspace.name || currentConnection.workspace.id;
        await sendMessageToBackground('INSERT_WORKSPACE_PATH', {
          path: newPath,
          workspaceIdOrName: wsId,
          autoCreateLayers: true
        });
        showToast('Folder created');
        await loadTree();
      }
    } catch (error) {
      showToast('Failed to create folder: ' + error.message);
    }
  } else if (action === 'rename') {
    const newName = prompt('Enter new name:', nodeName);
    if (!newName || newName === nodeName) return;

    try {
      if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
        const wsId = currentConnection.workspace.name || currentConnection.workspace.id;
        await sendMessageToBackground('RENAME_LAYER', {
          path: path,
          newName: newName,
          workspaceIdOrName: wsId
        });
        showToast('Renamed');
        await loadTree();
      }
    } catch (error) {
      showToast('Failed to rename: ' + error.message);
    }
  }
}

async function loadTabs() {
  try {
    const allTabsResponse = await sendMessageToBackground('GET_ALL_TABS');
    if (allTabsResponse.success) {
      allBrowserTabs = allTabsResponse.tabs.filter(tab => !tab.discarded && !isInternalTab(tab));
      
      // Group tabs by window
      windowGroups.clear();
      allBrowserTabs.forEach(tab => {
        if (!windowGroups.has(tab.windowId)) {
          windowGroups.set(tab.windowId, []);
        }
        windowGroups.get(tab.windowId).push(tab);
      });

      if (currentConnection.connected) {
        let docsResponse = null;
        if (currentConnection.mode === 'context' && currentConnection.context) {
          docsResponse = await sendMessageToBackground('GET_CANVAS_DOCUMENTS');
        } else if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
          docsResponse = await sendMessageToBackground('GET_WORKSPACE_DOCUMENTS', { contextSpec: currentWorkspacePath || '/' });
        }

        if (docsResponse?.success) {
          const syncedUrls = new Set((docsResponse.documents || []).map(doc => doc.data?.url).filter(Boolean));
          syncedTabIds.clear();
          allBrowserTabs.forEach(tab => {
            if (syncedUrls.has(tab.url)) {
              syncedTabIds.add(tab.id);
            }
          });
        }
      }

      await loadPinStates();
      updateBrowserTabsFilter();
      renderBrowserTabs();
    }

    if (currentConnection.connected) {
      if (currentConnection.mode === 'context' && currentConnection.context) {
        const canvasResponse = await sendMessageToBackground('GET_CANVAS_DOCUMENTS');
        if (canvasResponse.success) {
          canvasTabs = canvasResponse.documents || [];
          renderCanvasTabs();
        }
      } else if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
        const wsResponse = await sendMessageToBackground('GET_WORKSPACE_DOCUMENTS', { contextSpec: currentWorkspacePath || '/' });
        if (wsResponse.success) {
          canvasTabs = wsResponse.documents || [];
          renderCanvasTabs();
        }
      }
    }
  } catch (error) {
    console.error('Failed to load tabs:', error);
  }
}

async function loadPinStates() {
  try {
    const pinResponse = await sendMessageToBackground('GET_PINNED_TABS');
    if (pinResponse.success) {
      const pinnedTabIds = new Set(pinResponse.pinnedTabs || []);
      allBrowserTabs.forEach(tab => {
        tab.isPinned = pinnedTabIds.has(tab.id);
      });
    }
  } catch (error) {
    console.error('Failed to load pin states:', error);
  }
}

function updateBrowserTabsFilter() {
  if (showingSyncedTabs) {
    browserTabs = [...allBrowserTabs];
  } else {
    browserTabs = allBrowserTabs.filter(tab => !syncedTabIds.has(tab.id));
  }
}

function renderBrowserTabs() {
  browserToCanvasList.innerHTML = '';

  if (browserTabs.length === 0) {
    browserToCanvasList.innerHTML = '<div class="empty-state">No tabs</div>';
    return;
  }

  // Group filtered tabs by window
  const filteredWindowGroups = new Map();
  browserTabs.forEach(tab => {
    if (!filteredWindowGroups.has(tab.windowId)) {
      filteredWindowGroups.set(tab.windowId, []);
    }
    filteredWindowGroups.get(tab.windowId).push(tab);
  });

  // Render each window group
  filteredWindowGroups.forEach((tabs, windowId) => {
    const windowDiv = document.createElement('div');
    windowDiv.className = 'window-group';

    const header = document.createElement('div');
    header.className = 'window-header';

    const title = document.createElement('div');
    title.className = 'window-title';
    title.textContent = `Window ${windowId} (${tabs.length} tabs)`;

    const actions = document.createElement('div');
    actions.className = 'window-actions';

    const syncAllBtn = document.createElement('button');
    syncAllBtn.className = 'action-btn small secondary';
    syncAllBtn.textContent = 'Sync All';
    syncAllBtn.onclick = () => handleSyncAllWindow(tabs);

    const closeAllBtn = document.createElement('button');
    closeAllBtn.className = 'action-btn small danger';
    closeAllBtn.textContent = 'Close All';
    closeAllBtn.onclick = () => handleCloseAllWindow(tabs);

    actions.appendChild(syncAllBtn);
    actions.appendChild(closeAllBtn);

    header.appendChild(title);
    header.appendChild(actions);
    windowDiv.appendChild(header);

    const tabsList = document.createElement('div');
    tabsList.className = 'tab-list';
    
    tabs.forEach(tab => {
      const tabItem = createTabItem(tab, 'browser');
      tabsList.appendChild(tabItem);
    });

    windowDiv.appendChild(tabsList);
    browserToCanvasList.appendChild(windowDiv);
  });
}

function renderCanvasTabs() {
  canvasToBrowserList.innerHTML = '';

  const filteredTabs = getFilteredCanvasTabs();

  if (filteredTabs.length === 0) {
    canvasToBrowserList.innerHTML = '<div class="empty-state">No tabs</div>';
    return;
  }

  filteredTabs.forEach(tab => {
    const tabItem = createTabItem(tab, 'canvas');
    canvasToBrowserList.appendChild(tabItem);
  });
}

function createTabItem(tab, type) {
  const isSynced = type === 'browser' && syncedTabIds.has(tab.id);
  
  const div = document.createElement('div');
  div.className = 'tab-item' + (isSynced ? ' synced' : '');
  div.dataset[type === 'browser' ? 'tabId' : 'documentId'] = tab.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'tab-checkbox';
  if (isSynced) checkbox.disabled = true;

  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  favicon.src = (type === 'browser' ? tab.favIconUrl : tab.data?.favIconUrl) || '../assets/icons/logo-br_64x64.png';

  const info = document.createElement('div');
  info.className = 'tab-info';
  
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = (type === 'browser' ? tab.title : tab.data?.title) || 'Untitled';
  
  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = (type === 'browser' ? tab.url : tab.data?.url) || 'No URL';

  info.appendChild(title);
  info.appendChild(url);

  const actions = document.createElement('div');
  actions.className = 'tab-actions';

  if (type === 'browser') {
    const syncBtn = document.createElement('button');
    syncBtn.className = 'action-btn small primary';
    syncBtn.textContent = '↗';
    syncBtn.title = 'Sync to Canvas';
    syncBtn.onclick = () => handleSyncTab(tab.id);
    if (isSynced) syncBtn.disabled = true;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'action-btn small danger';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close tab';
    closeBtn.onclick = () => handleCloseTab(tab.id);

    actions.appendChild(syncBtn);
    actions.appendChild(closeBtn);
  } else {
    const openBtn = document.createElement('button');
    openBtn.className = 'action-btn small primary';
    openBtn.textContent = '↙';
    openBtn.title = 'Open in browser';
    openBtn.onclick = () => handleOpenTab(tab.data?.url);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'action-btn small warning';
    removeBtn.textContent = '⊖';
    removeBtn.title = 'Remove from context';
    removeBtn.onclick = () => handleRemoveDocument(tab.id);

    actions.appendChild(openBtn);
    actions.appendChild(removeBtn);
  }

  div.appendChild(checkbox);
  div.appendChild(favicon);
  div.appendChild(info);
  div.appendChild(actions);

  return div;
}

function getFilteredCanvasTabs() {
  if (showingAllCanvasTabs) {
    return canvasTabs;
  } else {
    const openUrls = new Set(allBrowserTabs.map(tab => tab.url));
    return canvasTabs.filter(doc => {
      const url = doc.data?.url;
      return url && !openUrls.has(url);
    });
  }
}

async function handleSyncAllWindow(tabs) {
  const unsyncedTabs = tabs.filter(tab => !syncedTabIds.has(tab.id));
  for (const tab of unsyncedTabs) {
    await handleSyncTab(tab.id);
  }
  showToast(`Synced ${unsyncedTabs.length} tabs`);
}

async function handleCloseAllWindow(tabs) {
  if (!confirm(`Close all ${tabs.length} tabs in this window?`)) return;
  
  for (const tab of tabs) {
    await tabs.remove(tab.id).catch(console.error);
  }
  showToast(`Closed ${tabs.length} tabs`);
  await loadTabs();
}

async function handleSyncTab(tabId) {
  try {
    await sendMessageToBackground('SYNC_TAB', { tabId });
    await loadTabs();
  } catch (error) {
    console.error('Failed to sync tab:', error);
  }
}

async function handleCloseTab(tabId) {
  try {
    await tabs.remove(tabId);
    await loadTabs();
  } catch (error) {
    console.error('Failed to close tab:', error);
  }
}

async function handleOpenTab(url) {
  if (!url) return;
  try {
    await tabs.create({ url });
  } catch (error) {
    console.error('Failed to open tab:', error);
  }
}

async function handleRemoveDocument(docId) {
  try {
    if (currentConnection.mode === 'context' && currentConnection.context) {
      await sendMessageToBackground('REMOVE_DOCUMENT', { 
        contextId: currentConnection.context.id, 
        documentId: docId 
      });
    } else if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
      await sendMessageToBackground('REMOVE_WORKSPACE_DOCUMENT', {
        workspaceIdOrName: currentConnection.workspace.name || currentConnection.workspace.id,
        documentId: docId,
        contextSpec: currentWorkspacePath
      });
    }
    await loadTabs();
  } catch (error) {
    console.error('Failed to remove document:', error);
  }
}

function switchTab(tabName) {
  currentTab = tabName;
  
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
  document.getElementById(tabName)?.classList.add('active');
}

async function openSettings() {
  try {
    await tabs.create({ url: runtime.getURL('settings/settings.html') });
  } catch (error) {
    console.error('Failed to open settings:', error);
  }
}

async function openCanvasWebUI() {
  try {
    const response = await sendMessageToBackground('GET_CONNECTION_SETTINGS');
    if (response.success && response.settings) {
      let targetUrl = response.settings.serverUrl;
      if (currentConnection.connected) {
        if (currentConnection.mode === 'context' && currentConnection.context) {
          targetUrl = `${response.settings.serverUrl}/contexts/${currentConnection.context.id}`;
        } else if (currentConnection.mode === 'explorer' && currentConnection.workspace) {
          const workspaceName = getWorkspaceName(currentConnection.workspace);
          const contextPath = currentWorkspacePath && currentWorkspacePath !== '/' ? currentWorkspacePath : '';
          targetUrl = `${response.settings.serverUrl}/workspaces/${workspaceName}${contextPath}`;
        }
      }
      await tabs.create({ url: targetUrl });
    }
  } catch (error) {
    console.error('Failed to open Canvas webui:', error);
  }
}

function handleSearch(event) {
  // TODO: Implement search
}

async function handleSyncSettingChange() {
  // TODO: Implement
}

async function handleShowSyncedChange() {
  showingSyncedTabs = showSyncedTabs.checked;
  updateBrowserTabsFilter();
  renderBrowserTabs();
}

async function handleShowAllCanvasChange() {
  showingAllCanvasTabs = showAllCanvasTabs.checked;
  renderCanvasTabs();
}

function handleSelectAllBrowser() {
  // TODO: Implement
}

function handleSelectAllCanvas() {
  // TODO: Implement
}

async function handleSyncSelected() {
  // TODO: Implement
}

async function handleCloseSelected() {
  // TODO: Implement
}

async function handleOpenSelected() {
  // TODO: Implement
}

async function handleRemoveSelected() {
  // TODO: Implement
}

async function handleDeleteSelected() {
  // TODO: Implement
}

function handleBrowserTabAction(event) {
  // Handled by individual tab buttons
}

function handleCanvasTabAction(event) {
  // Handled by individual tab buttons
}

async function loadSyncSettings() {
  try {
    const response = await sendMessageToBackground('GET_SYNC_SETTINGS');
    if (response.success) {
      sendNewTabsToCanvas.checked = response.settings.sendNewTabsToCanvas || false;
      openTabsAddedToCanvas.checked = response.settings.openTabsAddedToCanvas || false;
    }
  } catch (error) {
    console.error('Failed to load sync settings:', error);
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// Helper functions
function isInternalTab(tab) {
  if (!tab || !tab.url) return true;
  const excluded = ['chrome://', 'chrome-extension://', 'moz-extension://', 'about:', 'edge://'];
  return excluded.some(prefix => tab.url.startsWith(prefix));
}

function getWorkspaceName(workspace) {
  return workspace.name || workspace.id || 'unknown';
}

function formatContextUrl(workspaceName, path) {
  return `${workspaceName}://${path}`;
}

function parseContextUrl(url) {
  const match = url.match(/^([^:]+):\/\/(.+)$/);
  if (match) {
    return { workspaceName: match[1], path: match[2] };
  }
  return { workspaceName: null, path: url };
}

async function sendMessageToBackground(type, data = {}) {
  return new Promise((resolve) => {
    runtime.sendMessage({ type, ...data }, (response) => {
      resolve(response || {});
    });
  });
}

async function sendDirectMessageToBackground(message) {
  return new Promise((resolve) => {
    runtime.sendMessage(message, (response) => {
      resolve(response || {});
    });
  });
}
