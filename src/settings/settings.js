// Canvas Extension Settings JavaScript
// Handles settings page interactions and configuration management

// DOM elements
let browserIdentity, serverUrl, apiBasePath, apiToken;
let testConnectionBtn, connectBtn, disconnectBtn;
let connectionStatus, statusDot, statusText, statusDetails;
let syncModeSection, syncModeSelect;
let explorerSettings, workspaceSelect;
let contextSettings, contextSelect, bindContextBtn;
let currentContext, boundContextId, boundContextUrl;
let openTabsAddedToCanvas, closeTabsRemovedFromCanvas, sendNewTabsToCanvas, removeClosedTabsFromCanvas;
let syncOnlyCurrentBrowser, syncOnlyTaggedTabs, syncTagFilter;
let saveSettingsBtn, saveAndCloseBtn, resetSettingsBtn;
let toast;

// State
let isConnected = false;
let currentUser = null;
let availableContexts = [];
let availableWorkspaces = [];
let settings = {};
let isBoundToContext = false;
let currentMode = 'explorer';

// Initialize settings page
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  setupEventListeners();
  setupStorageListeners();
  try {
    const extApi = (typeof browser !== 'undefined' && browser.runtime) ? browser : (typeof chrome !== 'undefined' ? chrome : null);
    const version = extApi?.runtime?.getManifest?.().version;
    const versionEl = document.getElementById('extVersion');
    if (version && versionEl) {
      versionEl.textContent = `Version ${version}`;
    }
  } catch (e) {
    // ignore
  }
  await loadSettings();
  await checkInitialConnection();
});

function initializeElements() {
  // Connection settings
  browserIdentity = document.getElementById('browserIdentity');
  serverUrl = document.getElementById('serverUrl');
  apiBasePath = document.getElementById('apiBasePath');
  apiToken = document.getElementById('apiToken');

  // Connection controls

  testConnectionBtn = document.getElementById('testConnectionBtn');
  connectBtn = document.getElementById('connectBtn');
  disconnectBtn = document.getElementById('disconnectBtn');

  // Connection status
  connectionStatus = document.getElementById('connectionStatus');
  statusDot = document.getElementById('statusDot');
  statusText = document.getElementById('statusText');
  statusDetails = document.getElementById('statusDetails');

  // Sync mode and per-mode settings
  syncModeSection = document.getElementById('syncModeSection');
  syncModeSelect = document.getElementById('syncModeSelect');
  explorerSettings = document.getElementById('explorerSettings');
  workspaceSelect = document.getElementById('workspaceSelect');
  contextSettings = document.getElementById('contextSettings');
  contextSelect = document.getElementById('contextSelect');
  bindContextBtn = document.getElementById('bindContextBtn');
  currentContext = document.getElementById('currentContext');
  boundContextId = document.getElementById('boundContextId');
  boundContextUrl = document.getElementById('boundContextUrl');

  // Sync settings
  openTabsAddedToCanvas = document.getElementById('openTabsAddedToCanvas');
  closeTabsRemovedFromCanvas = document.getElementById('closeTabsRemovedFromCanvas');
  sendNewTabsToCanvas = document.getElementById('sendNewTabsToCanvas');
  removeClosedTabsFromCanvas = document.getElementById('removeClosedTabsFromCanvas');
  
  // Sync filtering options
  syncOnlyCurrentBrowser = document.getElementById('syncOnlyCurrentBrowser');
  syncOnlyTaggedTabs = document.getElementById('syncOnlyTaggedTabs');
  syncTagFilter = document.getElementById('syncTagFilter');

  // Action buttons
  saveSettingsBtn = document.getElementById('saveSettingsBtn');
  saveAndCloseBtn = document.getElementById('saveAndCloseBtn');
  resetSettingsBtn = document.getElementById('resetSettingsBtn');

  // Toast
  toast = document.getElementById('toast');
}

function setupEventListeners() {
  // Connection buttons

  testConnectionBtn.addEventListener('click', handleTestConnection);
  connectBtn.addEventListener('click', handleConnect);
  disconnectBtn.addEventListener('click', handleDisconnect);

  // Context buttons
  bindContextBtn.addEventListener('click', handleBindContext);

  // Mode change
  syncModeSelect.addEventListener('change', handleModeChange);

  // Workspace selection change
  workspaceSelect.addEventListener('change', async () => {
    if (currentMode === 'explorer') {
      const wsId = workspaceSelect.value;
      let selectedWorkspace = null;
      if (wsId) {
        selectedWorkspace = availableWorkspaces.find(w => w.id === wsId) || null;
      }
      // Reset path to root when changing workspace and trigger path change behavior
      await sendMessageToBackground('SET_MODE_AND_SELECTION', { mode: 'explorer', workspace: selectedWorkspace, workspacePath: '/' });
      showToast(`Switched to workspace: ${selectedWorkspace?.label || selectedWorkspace?.name || wsId}`, 'success');
    }
  });

  // Settings buttons
  saveSettingsBtn.addEventListener('click', handleSaveSettings);
  saveAndCloseBtn.addEventListener('click', handleSaveAndClose);
  resetSettingsBtn.addEventListener('click', handleResetSettings);

  // Auto-generate browser identity if empty
  browserIdentity.addEventListener('blur', handleBrowserIdentityBlur);

  // Sync filtering options
  syncOnlyTaggedTabs.addEventListener('change', () => {
    syncTagFilter.disabled = !syncOnlyTaggedTabs.checked;
    if (!syncOnlyTaggedTabs.checked) {
      syncTagFilter.value = '';
    }
  });


}



async function loadSettings() {
  try {
    console.log('Loading settings from background service worker...');

    // Get connection status and settings from background
    const response = await sendMessageToBackground('GET_CONNECTION_STATUS');
    console.log('Loaded settings response:', response);

    // Get sync settings separately
    const syncResponse = await sendMessageToBackground('GET_SYNC_SETTINGS');
    console.log('Loaded sync settings response:', syncResponse);

    // Get mode and selection
    const modeSelResponse = await sendMessageToBackground('GET_MODE_AND_SELECTION');
    console.log('Loaded mode/selection response:', modeSelResponse);

    // Use actual saved settings, with defaults only as fallback
    const savedConnectionSettings = response.settings || {};
    const savedSyncSettings = syncResponse.success ? syncResponse.settings : {};

    settings = {
      connectionSettings: {
        serverUrl: savedConnectionSettings.serverUrl || 'http://127.0.0.1:8001',
        apiBasePath: savedConnectionSettings.apiBasePath || '/rest/v2',
        apiToken: savedConnectionSettings.apiToken || '',
        connected: savedConnectionSettings.connected || false
      },
      syncSettings: {
        openTabsAddedToCanvas: savedSyncSettings.openTabsAddedToCanvas || false,
        closeTabsRemovedFromCanvas: savedSyncSettings.closeTabsRemovedFromCanvas || false,
        sendNewTabsToCanvas: savedSyncSettings.sendNewTabsToCanvas || false,
        removeClosedTabsFromCanvas: savedSyncSettings.removeClosedTabsFromCanvas || false,
        syncOnlyCurrentBrowser: savedSyncSettings.syncOnlyCurrentBrowser || false,
        syncOnlyTaggedTabs: savedSyncSettings.syncOnlyTaggedTabs || false,
        syncTagFilter: savedSyncSettings.syncTagFilter || ''
      },
      browserIdentity: '',
      currentContext: (modeSelResponse.success ? modeSelResponse.context : null) || (response.context || null),
      currentWorkspace: modeSelResponse.success ? modeSelResponse.workspace : null,
      mode: modeSelResponse.success ? (modeSelResponse.mode || 'explorer') : 'explorer'
    };

    // Set connection state
    isConnected = response.connected || false;
    currentMode = settings.mode;

    populateForm();

    // Load contexts and workspaces if connected
    if (isConnected) {
      await Promise.all([
        loadContexts(),
        loadWorkspaces()
      ]);

      // Preselect dropdowns if values exist - this will be handled in populate functions
    }

    showToast('Settings loaded successfully', 'success');
  } catch (error) {
    console.error('Failed to load settings:', error);
    showToast('Failed to load settings', 'error');

    // Use defaults on error
    settings = {
      connectionSettings: {
        serverUrl: 'http://127.0.0.1:8001',
        apiBasePath: '/rest/v2',
        apiToken: '',
        connected: false
      },
      syncSettings: {
        openTabsAddedToCanvas: false,
        closeTabsRemovedFromCanvas: false,
        sendNewTabsToCanvas: false,
        removeClosedTabsFromCanvas: false
      },
      browserIdentity: '',
      currentContext: null
    };
    populateForm();
  }
}

function populateForm() {
  // Connection settings
  serverUrl.value = settings.connectionSettings.serverUrl;
  apiBasePath.value = settings.connectionSettings.apiBasePath;
  apiToken.value = settings.connectionSettings.apiToken;
  browserIdentity.value = settings.browserIdentity;

  // Sync settings
  openTabsAddedToCanvas.checked = settings.syncSettings.openTabsAddedToCanvas;
  closeTabsRemovedFromCanvas.checked = settings.syncSettings.closeTabsRemovedFromCanvas;
  sendNewTabsToCanvas.checked = settings.syncSettings.sendNewTabsToCanvas;
  removeClosedTabsFromCanvas.checked = settings.syncSettings.removeClosedTabsFromCanvas;
  
  // Sync filtering options
  syncOnlyCurrentBrowser.checked = settings.syncSettings.syncOnlyCurrentBrowser;
  syncOnlyTaggedTabs.checked = settings.syncSettings.syncOnlyTaggedTabs;
  syncTagFilter.value = settings.syncSettings.syncTagFilter;
  syncTagFilter.disabled = !settings.syncSettings.syncOnlyTaggedTabs;

  // Update connection status
  updateConnectionStatus(settings.connectionSettings.connected);

  // Sync mode UI
  syncModeSection.style.display = isConnected ? 'block' : 'none';
  syncModeSelect.value = settings.mode || 'explorer';
  updateModeVisibility(syncModeSelect.value);

  // Show current context if exists and in context mode
  if (settings.currentContext && (settings.mode === 'context')) {
    boundContextId.textContent = settings.currentContext.id;
    boundContextUrl.textContent = settings.currentContext.url || '-';
    currentContext.style.display = 'block';
  } else if (currentContext) {
    currentContext.style.display = 'none';
  }
}

async function checkInitialConnection() {
  if (settings.connectionSettings.connected && settings.connectionSettings.apiToken) {
    await handleTestConnection();
  }
}

async function handleTestConnection() {
  try {
    setButtonLoading(testConnectionBtn, true);

    const connectionData = {
      serverUrl: serverUrl.value.trim(),
      apiBasePath: apiBasePath.value.trim(),
      apiToken: apiToken.value.trim()
    };

    console.log('Testing connection with:', connectionData);

    // Send test connection request to background
    const response = await sendMessageToBackground('TEST_CONNECTION', connectionData);
    console.log('Connection test response:', response);

        if (response.success) {
      // Only show connected status if BOTH connection AND authentication succeed
      const isFullyConnected = response.connected && response.authenticated;
      updateConnectionStatus(isFullyConnected);

      if (response.authenticated) {
        showToast('✅ Connection and authentication successful!', 'success');

        // Show authentication details if available
        if (response.user) {
          const userInfo = response.user.name || response.user.email || 'User';
          showToast(`🔐 Authenticated as: ${userInfo}`, 'info');
        }

        // Load contexts and workspaces if authenticated
        await Promise.all([loadContexts(), loadWorkspaces()]);
      } else if (response.connected) {
        showToast('⚠️ Server reachable but authentication failed - check API token', 'warning');
      } else {
        showToast('❌ Server connection failed', 'error');
      }
    } else {
      updateConnectionStatus(false);
      showToast(`❌ Connection test failed: ${response.error}`, 'error');
    }

  } catch (error) {
    console.error('Connection test failed:', error);
    updateConnectionStatus(false);
    showToast(`Connection test failed: ${error.message}`, 'error');
  } finally {
    setButtonLoading(testConnectionBtn, false);
  }
}

async function handleConnect() {
  try {
    setButtonLoading(connectBtn, true);

    // Validate form
    if (!validateConnectionForm()) {
      setButtonLoading(connectBtn, false);
      return;
    }

    // Generate browser identity if not set
    if (!browserIdentity.value.trim()) {
      await generateBrowserIdentity();
    }

    const connectionData = {
      serverUrl: serverUrl.value.trim(),
      apiBasePath: apiBasePath.value.trim(),
      apiToken: apiToken.value.trim(),
      browserIdentity: browserIdentity.value.trim()
    };

    console.log('Connecting with:', connectionData);



    // Send connect request to background
    const response = await sendMessageToBackground('CONNECT', connectionData);
    console.log('Connect response:', response);

        if (response.success && response.authenticated) {
      isConnected = true;
      updateConnectionStatus(true);

      if (response.user) {
        showToast(`✅ Connected and authenticated as ${response.user.name || response.user.email}`, 'success');
      } else {
        showToast('✅ Connected and authenticated successfully!', 'success');
      }

      // Load contexts and workspaces
      await Promise.all([loadContexts(), loadWorkspaces()]);

      // Auto-bind to first/selected context if available (mandatory)
      if (contextSelect.value) {
        await handleBindContext();
      } else if (availableContexts.length > 0) {
        // Auto-select and bind to first context if none selected
        contextSelect.value = availableContexts[0].id;
        await handleBindContext();
        showToast('Auto-bound to first available context', 'info');
      }
    } else if (response.success && response.connected && !response.authenticated) {
      // Server reachable but authentication failed
      isConnected = false;
      updateConnectionStatus(false);
      showToast('⚠️ Server reachable but authentication failed - check API token', 'warning');
    } else {
      // Complete connection failure
      isConnected = false;
      updateConnectionStatus(false);
      showToast(`❌ Connection failed: ${response.error}`, 'error');
    }

  } catch (error) {
    console.error('Connection failed:', error);
    isConnected = false;
    updateConnectionStatus(false);
    showToast(`Connection failed: ${error.message}`, 'error');
  } finally {
    setButtonLoading(connectBtn, false);
  }
}

async function handleDisconnect() {
  try {
    setButtonLoading(disconnectBtn, true);

    // TODO: Send disconnect request to background
    console.log('TODO: Disconnect');

    // Simulate success for now
    setTimeout(() => {
      isConnected = false;
      updateConnectionStatus(false);
      showToast('Disconnected successfully', 'success');
      setButtonLoading(disconnectBtn, false);

      // Hide UI sections
      if (syncModeSection) syncModeSection.style.display = 'none';
      currentContext.style.display = 'none';
    }, 500);

  } catch (error) {
    console.error('Disconnection failed:', error);
    showToast(`Disconnection failed: ${error.message}`, 'error');
    setButtonLoading(disconnectBtn, false);
  }
}

async function loadContexts() {
  try {
    if (!isConnected) {
      console.log('Not connected, skipping context loading');
      // Clear contexts
      availableContexts = [];
      populateContextSelect();
      if (syncModeSection) syncModeSection.style.display = 'none';
      return;
    }

    console.log('Loading contexts from Canvas server...');

    // Get contexts from background service worker
    const response = await sendMessageToBackground('GET_CONTEXTS');
    console.log('Contexts response:', response);

    if (response.success) {
      availableContexts = response.contexts || [];
      console.log(`Loaded ${availableContexts.length} contexts`);

      populateContextSelect();
      if (syncModeSection) syncModeSection.style.display = 'block';

      if (availableContexts.length === 0) {
        showToast('No contexts found - you can create one by entering a context ID', 'info');
      } else {
        showToast(`Loaded ${availableContexts.length} contexts`, 'success');

        // Auto-select first context if none is currently selected
        if (!contextSelect.value && availableContexts.length > 0) {
          contextSelect.value = availableContexts[0].id;
          console.log('Auto-selected first context:', availableContexts[0].id);
        }
      }
    } else {
      console.error('Failed to load contexts:', response.error);
      showToast(`Failed to load contexts: ${response.error}`, 'error');
      availableContexts = [];
      populateContextSelect();
    }

  } catch (error) {
    console.error('Failed to load contexts:', error);
    showToast(`Failed to load contexts: ${error.message}`, 'error');
    availableContexts = [];
    populateContextSelect();
  }
}

function populateContextSelect() {
  // Clear existing options securely
  contextSelect.textContent = '';

  // Create default option securely
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select a context...';
  contextSelect.appendChild(defaultOption);

  availableContexts.forEach(context => {
    const option = document.createElement('option');
    option.value = context.id;
    option.textContent = `${context.id} (${context.url})`;
    contextSelect.appendChild(option);
  });

  // Set current context selection if we have one and we're in context mode
  if (settings.currentContext?.id && currentMode === 'context') {
    contextSelect.value = settings.currentContext.id;
    console.log('Pre-selected current context:', settings.currentContext.id);
  }
}

async function loadWorkspaces() {
  try {
    if (!isConnected) {
      availableWorkspaces = [];
      populateWorkspaceSelect();
      return;
    }

    console.log('Loading workspaces from Canvas server...');
    const response = await sendMessageToBackground('GET_WORKSPACES');
    console.log('Workspaces response:', response);

    if (response.success) {
      availableWorkspaces = response.workspaces || [];
      populateWorkspaceSelect();
    } else {
      availableWorkspaces = [];
      populateWorkspaceSelect();
    }
  } catch (error) {
    console.error('Failed to load workspaces:', error);
    availableWorkspaces = [];
    populateWorkspaceSelect();
  }
}

function populateWorkspaceSelect() {
  // Clear existing options securely
  workspaceSelect.textContent = '';

  // Create default option securely
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select a workspace...';
  workspaceSelect.appendChild(defaultOption);

  availableWorkspaces.forEach(ws => {
    const option = document.createElement('option');
    option.value = ws.id;
    option.textContent = ws.label || ws.name || ws.id;
    option.dataset.name = ws.name;
    workspaceSelect.appendChild(option);
  });

  // Set current workspace selection if we have one and we're in explorer mode
  if (settings.currentWorkspace?.id && currentMode === 'explorer') {
    workspaceSelect.value = settings.currentWorkspace.id;
    console.log('Pre-selected current workspace:', settings.currentWorkspace.id);
  }
}

function updateModeVisibility(mode) {
  if (!contextSettings || !explorerSettings) return;
  if (mode === 'context') {
    contextSettings.style.display = 'block';
    explorerSettings.style.display = 'none';
  } else {
    contextSettings.style.display = 'none';
    explorerSettings.style.display = 'block';
  }
}

async function handleModeChange() {
  const selectedMode = syncModeSelect.value;
  currentMode = selectedMode;
  updateModeVisibility(selectedMode);

  if (selectedMode === 'context') {
    await sendMessageToBackground('SET_MODE_AND_SELECTION', { mode: 'context' });
  } else {
    const wsId = workspaceSelect.value;
    let selectedWorkspace = null;
    if (wsId) {
      selectedWorkspace = availableWorkspaces.find(w => w.id === wsId) || null;
    }
    await sendMessageToBackground('SET_MODE_AND_SELECTION', { mode: 'explorer', workspace: selectedWorkspace });
  }
}

async function handleBindContext() {
  try {
    const selectedContextId = contextSelect.value;
    if (!selectedContextId) {
      showToast('Please select a context to bind to', 'warning');
      return;
    }

    console.log('Binding to context:', selectedContextId);

    // Find the selected context
    const selectedContext = availableContexts.find(ctx => ctx.id === selectedContextId);
    if (!selectedContext) {
      showToast('Selected context not found', 'error');
      return;
    }

    // Send bind context request to background
    const response = await sendMessageToBackground('BIND_CONTEXT', { context: selectedContext });
    console.log('Bind context response:', response);

    if (response.success) {
      showToast(`Bound to context: ${selectedContext.id}`, 'success');
      settings.currentContext = selectedContext;
      isBoundToContext = true;
      currentMode = 'context';

      // Persist mode/selection in background
      await sendMessageToBackground('SET_MODE_AND_SELECTION', { mode: 'context', context: selectedContext });

      // Update UI to show bound context
      boundContextId.textContent = selectedContext.id;
      boundContextUrl.textContent = selectedContext.url;
      currentContext.style.display = 'block';

      // Show green dot indicator
      const contextStatusDot = document.getElementById('contextStatusDot');
      if (contextStatusDot) {
        contextStatusDot.className = 'status-dot connected';
        contextStatusDot.style.display = 'inline-block';
      }
    } else {
      showToast(`Failed to bind context: ${response.error}`, 'error');
      isBoundToContext = false;
    }
  } catch (error) {
    console.error('Failed to bind context:', error);
    showToast(`Failed to bind context: ${error.message}`, 'error');
  }
}

async function handleSaveAndClose() {
  try {
    // Save settings first
    await handleSaveSettings();

    // Wait a moment for the save operation to complete and show success message
    setTimeout(() => {
      // Close the current tab
      window.close();
    }, 1000);

  } catch (error) {
    console.error('Failed to save and close:', error);
    showToast(`Failed to save and close: ${error.message}`, 'error');
  }
}



async function handleSaveSettings() {
  try {
    setButtonLoading(saveSettingsBtn, true);

    // MANDATORY: Check if connected
    if (!isConnected) {
      throw new Error('You must connect to Canvas server before saving settings');
    }

    // Mode-specific validation
    if ((currentMode === 'context') && (!isBoundToContext && !contextSelect.value)) {
      throw new Error('You must bind to a context before saving settings');
    }
    if (currentMode === 'explorer' && !workspaceSelect.value) {
      throw new Error('You must select a workspace in Explorer mode');
    }

    // If context is selected but not bound, bind automatically
    if (currentMode === 'context' && contextSelect.value && !isBoundToContext) {
      console.log('Auto-binding to selected context before save...');
      await handleBindContext();

      // Check if binding was successful
      if (!isBoundToContext) {
        throw new Error('Failed to bind to context. Please bind manually before saving.');
      }
    }

    // Persist mode and selection
    if (currentMode === 'explorer') {
      const ws = availableWorkspaces.find(w => w.id === workspaceSelect.value) || null;
      await sendMessageToBackground('SET_MODE_AND_SELECTION', { mode: 'explorer', workspace: ws });
    }

    // Collect all settings
    const allSettings = {
      connectionSettings: {
        serverUrl: serverUrl.value.trim(),
        apiBasePath: apiBasePath.value.trim(),
        apiToken: apiToken.value.trim(),
        connected: isConnected
      },
      syncSettings: {
        openTabsAddedToCanvas: openTabsAddedToCanvas.checked,
        closeTabsRemovedFromCanvas: closeTabsRemovedFromCanvas.checked,
        sendNewTabsToCanvas: sendNewTabsToCanvas.checked,
        removeClosedTabsFromCanvas: removeClosedTabsFromCanvas.checked,
        syncOnlyCurrentBrowser: syncOnlyCurrentBrowser.checked,
        syncOnlyTaggedTabs: syncOnlyTaggedTabs.checked,
        syncTagFilter: syncTagFilter.value.trim()
      },
      browserIdentity: browserIdentity.value.trim()
    };

    console.log('Saving settings with mandatory context binding:', allSettings);

    // Save settings via background service worker
    const saveResponse = await sendMessageToBackground('SAVE_SETTINGS', allSettings);

    if (saveResponse.success) {
      showToast('Settings saved successfully! Extension is fully configured.', 'success');
    } else {
      throw new Error(saveResponse.error || 'Failed to save settings');
    }

  } catch (error) {
    console.error('Failed to save settings:', error);
    showToast(`Cannot save settings: ${error.message}`, 'error');
  } finally {
    setButtonLoading(saveSettingsBtn, false);
  }
}

async function handleResetSettings() {
  if (!confirm('Reset all settings to defaults? This cannot be undone.')) {
    return;
  }

  try {
    setButtonLoading(resetSettingsBtn, true);

    // TODO: Reset settings in background
    console.log('TODO: Reset settings');

    // Simulate success and reload
    setTimeout(() => {
      showToast('Settings reset successfully', 'success');
      setButtonLoading(resetSettingsBtn, false);
      location.reload();
    }, 1000);

  } catch (error) {
    console.error('Failed to reset settings:', error);
    showToast(`Failed to reset settings: ${error.message}`, 'error');
    setButtonLoading(resetSettingsBtn, false);
  }
}

async function handleBrowserIdentityBlur() {
  if (!browserIdentity.value.trim()) {
    await generateBrowserIdentity();
  }
}

async function generateBrowserIdentity() {
  // TODO: Generate browser identity via background
  console.log('TODO: Generate browser identity');

  // For now, generate a simple one
  const userAgent = navigator.userAgent;
  let browserType = 'unknown';

  if (userAgent.includes('Chrome')) {
    browserType = 'chrome';
  } else if (userAgent.includes('Firefox')) {
    browserType = 'firefox';
  } else if (userAgent.includes('Edge')) {
    browserType = 'edge';
  } else if (userAgent.includes('Safari')) {
    browserType = 'safari';
  }

  const suffix = Math.random().toString(36).substring(2, 8);
  const identity = `${browserType}@${suffix}`;

  browserIdentity.value = identity;
}

function validateConnectionForm() {
  if (!serverUrl.value.trim()) {
    showToast('Server URL is required', 'warning');
    serverUrl.focus();
    return false;
  }

  if (!apiBasePath.value.trim()) {
    showToast('API base path is required', 'warning');
    apiBasePath.focus();
    return false;
  }

  if (!apiToken.value.trim()) {
    showToast('API token is required', 'warning');
    apiToken.focus();
    return false;
  }

  return true;
}

function updateConnectionStatus(connected) {
  isConnected = connected;

  if (connected) {
    statusDot.className = 'status-dot connected';
    statusText.textContent = 'Connected';
    statusDetails.textContent = 'Successfully connected and authenticated to Canvas server';

    connectBtn.style.display = 'none';
    disconnectBtn.style.display = 'inline-block';
  } else {
    statusDot.className = 'status-dot disconnected';
    statusText.textContent = 'Not connected';
    statusDetails.textContent = 'Click "Test Connection" or "Connect" to establish connection';

    connectBtn.style.display = 'inline-block';
    disconnectBtn.style.display = 'none';

    if (syncModeSection) syncModeSection.style.display = 'none';
  }
}

function setButtonLoading(button, loading) {
  if (loading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = 'Loading...';
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText;
  }
}

function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';

  setTimeout(() => {
    toast.style.display = 'none';
  }, 5000);
}

// Setup storage change listeners for real-time updates
function setupStorageListeners() {
  // Listen for storage changes (cross-browser compatible)
  const browserAPI = (typeof chrome !== 'undefined') ? chrome : browser;
  if (browserAPI && browserAPI.storage) {
    browserAPI.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        console.log('Settings: Storage changed:', changes);

        // Handle connection settings changes
        if (changes.canvasConnectionSettings) {
          console.log('Settings: Connection settings changed');
          const newSettings = changes.canvasConnectionSettings.newValue;
          if (newSettings) {
            // Update connection state
            isConnected = newSettings.connected || false;
            updateConnectionStatus(isConnected);

            // Update form fields if they exist and are different
            if (serverUrl && newSettings.serverUrl && serverUrl.value !== newSettings.serverUrl) {
              serverUrl.value = newSettings.serverUrl;
            }
            if (apiBasePath && newSettings.apiBasePath && apiBasePath.value !== newSettings.apiBasePath) {
              apiBasePath.value = newSettings.apiBasePath;
            }
            if (apiToken && newSettings.apiToken && apiToken.value !== newSettings.apiToken) {
              apiToken.value = newSettings.apiToken;
            }
          }
        }

        // Handle context changes
        if (changes.canvasCurrentContext) {
          console.log('Settings: Current context changed');
          const newContext = changes.canvasCurrentContext.newValue;
                    if (newContext) {
            isBoundToContext = true;
            if (boundContextId) boundContextId.textContent = newContext.id;
            if (boundContextUrl) boundContextUrl.textContent = newContext.url;
            if (currentContext) currentContext.style.display = 'block';

            // Show green dot indicator
            const contextStatusDot = document.getElementById('contextStatusDot');
            if (contextStatusDot) {
              contextStatusDot.className = 'status-dot connected';
              contextStatusDot.style.display = 'inline-block';
            }

            // Update context dropdown selection
            if (contextSelect && contextSelect.value !== newContext.id) {
              contextSelect.value = newContext.id;
            }
          } else {
            isBoundToContext = false;
            if (currentContext) currentContext.style.display = 'none';

            // Hide green dot indicator
            const contextStatusDot = document.getElementById('contextStatusDot');
            if (contextStatusDot) {
              contextStatusDot.style.display = 'none';
            }
          }
        }

        // Handle mode changes
        if (changes.canvasSyncMode) {
          const newMode = changes.canvasSyncMode.newValue || 'explorer';
          currentMode = newMode;
          if (syncModeSelect) syncModeSelect.value = newMode;
          updateModeVisibility(newMode);
        }
      }
    });
  } else {
    console.warn('Settings: Chrome storage API not available');
  }
}

// Utility functions
async function sendMessageToBackground(type, data = null) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}
