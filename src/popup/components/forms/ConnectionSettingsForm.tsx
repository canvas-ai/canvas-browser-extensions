import React, { useEffect, useState, useCallback, useRef } from 'react';
import { browser } from '@/general/utils';
import { RUNTIME_MESSAGES, SOCKET_EVENTS } from '@/general/constants';
import { showErrorMessage, showSuccessMessage } from '@/popup/utils';
import configStore, { Protocol } from '@/general/ConfigStore';

interface ConnectionSettingsFormTypes {
  closePopup?: React.MouseEventHandler<HTMLDivElement>;
}

const ConnectionSettingsForm: React.FC<ConnectionSettingsFormTypes> = ({ closePopup }) => {
  // Local state for form inputs
  const [protocol, setProtocol] = useState<Protocol>('http');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [token, setToken] = useState('');
  const [isApiToken, setIsApiToken] = useState(false);
  const [selectedContextId, setSelectedContextId] = useState('default');
  const [isConnected, setIsConnected] = useState(false);

  // UI state
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [availableContexts, setAvailableContexts] = useState<{id: string, url: string}[]>([{id: 'default', url: 'universe:///'}]);
  const [contextsFetched, setContextsFetched] = useState(false);
  const [isFetchingContexts, setIsFetchingContexts] = useState(false);

  // Reference to track form changes
  const formChangedRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const FETCH_COOLDOWN_MS = 5000;

  // Initialize form with stored config values when component mounts
  useEffect(() => {
    // Load initial values from config
    const loadConfig = async () => {
      try {
        await configStore.init();
        const config = configStore.getAll();

        console.log('[ConnectionSettingsForm] Loading initial config values:', config);

        setProtocol(config.transport.protocol);
        setHost(config.transport.host || '');
        setPort(String(config.transport.port || ''));
        setToken(config.transport.token || '');
        setIsApiToken(config.transport.isApiToken || false);
        setSelectedContextId(config.transport.contextId || 'default');

        console.log('[ConnectionSettingsForm] Initialized with stored config values');
      } catch (err) {
        console.error('[ConnectionSettingsForm] Error loading initial config:', err);
        showErrorMessage('Failed to load configuration. Using defaults.');
      }
    };

    loadConfig();

    // Listen for connection status changes
    const handleConnectionStatus = (message: any) => {
      if (message && message.type === RUNTIME_MESSAGES.socket_status) {
        setIsConnected(!!message.payload);
      }
    };

    // Check current connection status
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.socket_status });

    // Set up listener for context and connection changes
    browser.runtime.onMessage.addListener(handleConnectionStatus);
    browser.runtime.onMessage.addListener(handleContextUpdates);

    // Remove listeners on cleanup
    return () => {
      browser.runtime.onMessage.removeListener(handleConnectionStatus);
      browser.runtime.onMessage.removeListener(handleContextUpdates);
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  // Handle incoming messages for context updates
  const handleContextUpdates = useCallback((message: any) => {
    if (message && message.type === RUNTIME_MESSAGES.user_contexts_list_updated && Array.isArray(message.payload)) {
      console.log('[ConnectionSettingsForm] Got contexts list:', message.payload.length);
      setAvailableContexts(message.payload);
      setContextsFetched(true);
      setIsFetchingContexts(false);
    }
  }, []);

  // Fetch available contexts
  const fetchAvailableContexts = useCallback(async (force = false) => {
    const now = Date.now();
    if (isFetchingContexts && !force) {
      console.log('[ConnectionSettingsForm] Already fetching contexts');
      return;
    }

    if (now - lastFetchTimeRef.current < FETCH_COOLDOWN_MS && !force) {
      console.log('[ConnectionSettingsForm] Context fetch on cooldown');
      return;
    }

    setIsFetchingContexts(true);
    lastFetchTimeRef.current = now;

    try {
      console.log('[ConnectionSettingsForm] Requesting contexts list from background');
      await browser.runtime.sendMessage({
        action: 'context:list',
        one_time: true  // Mark as one-time request to avoid loop detection
      });
    } catch (error) {
      console.error('[ConnectionSettingsForm] Error fetching contexts:', error);
      setIsFetchingContexts(false);
    }
  }, [isFetchingContexts]);

  // Function to reset connection attempts in background
  const resetConnectionAttemptsInBackground = async () => {
    try {
      await browser.runtime.sendMessage({ action: 'reset_connection_attempts' });
      console.log('[ConnectionSettingsForm] Connection attempts reset');
    } catch (error) {
      console.error('[ConnectionSettingsForm] Failed to reset connection attempts:', error);
    }
  };

  // Function to save connection settings
  const saveConnectionSettings = async () => {
    formChangedRef.current = false;

    try {
      // Format port correctly
      const numericPort = port ? parseInt(port, 10) : 8001;

      // Create config update object
      const configUpdate = {
        transport: {
          protocol,
          host,
          port: numericPort,
          token,
          isApiToken,
          contextId: selectedContextId,
          pinToContext: '/'
        }
      };

      console.log('[ConnectionSettingsForm] Saving connection settings:', configUpdate);

      // Update config store with new values
      await configStore.update(configUpdate);

      // Verify the update worked
      const config = configStore.getAll();
      console.log('[ConnectionSettingsForm] Verification - config after update:', config);

      if (config.transport.host !== host ||
          config.transport.port !== numericPort ||
          config.transport.protocol !== protocol ||
          config.transport.token !== token ||
          config.transport.isApiToken !== isApiToken ||
          config.transport.contextId !== selectedContextId) {
        console.error('[ConnectionSettingsForm] Config verification failed - values don\'t match what was saved');
        throw new Error('Failed to update configuration - values not saved correctly');
      }

      console.log('[ConnectionSettingsForm] Saved new connection settings to config store');
      return true;
    } catch (error) {
      console.error('[ConnectionSettingsForm] Error saving settings to config store:', error);
      return false;
    }
  };

  // Test and save functions (now defined directly)
  const testConnection = async () => {
    setIsTestingConnection(true);

    try {
      // Validate token
      const currentToken = token.trim();
      if (!currentToken) {
        showErrorMessage('Please enter an authentication token.');
        setIsTestingConnection(false);
        return;
      }

      // Format port correctly
      const numericPort = port ? parseInt(port, 10) : 8001;

      // Create config update object
      const configUpdate = {
        transport: {
          protocol,
          host,
          port: numericPort,
          token: currentToken,
          isApiToken,
          contextId: selectedContextId,
          pinToContext: '/'
        }
      };

      console.log('[ConnectionSettingsForm] Testing connection - saving settings first');
      await configStore.update(configUpdate);

      // Reset connection and try to connect
      console.log('[ConnectionSettingsForm] Resetting connection attempts...');
      await browser.runtime.sendMessage({ action: 'reset_connection_attempts' });

      console.log('[ConnectionSettingsForm] Requesting socket retry...');
      const response = await browser.runtime.sendMessage({ action: 'socket:retry' });

      console.log('[ConnectionSettingsForm] Socket retry response:', response);

      if (response && response.status === 'success') {
        showSuccessMessage('Connection test successful!');
        // Try to fetch contexts
        setTimeout(() => fetchAvailableContexts(true), 1000);
      } else {
        showErrorMessage(`Connection test failed: ${response?.message || 'No response from server'}`);
      }
    } catch (err) {
      console.error('[ConnectionSettingsForm] Test connection error:', err);
      showErrorMessage(`Connection test error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveAndConnect = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent default button behavior
    e.preventDefault();

    console.log('[ConnectionSettingsForm] Save button clicked');
    setIsSavingConnection(true);

    try {
      // Validate token
      const currentToken = token.trim();
      if (!currentToken) {
        showErrorMessage('Please enter an authentication token.');
        setIsSavingConnection(false);
        return;
      }

      // Format port correctly
      const numericPort = port ? parseInt(port, 10) : 8001;

      // Create config update object
      const configUpdate = {
        transport: {
          protocol,
          host,
          port: numericPort,
          token: currentToken,
          isApiToken,
          contextId: selectedContextId,
          pinToContext: '/'
        }
      };

      console.log('[ConnectionSettingsForm] Saving connection settings');
      await configStore.update(configUpdate);

      // Important: Wait for reset and connection attempt to complete
      console.log('[ConnectionSettingsForm] Resetting connection attempts...');
      await browser.runtime.sendMessage({ action: 'reset_connection_attempts' });

      console.log('[ConnectionSettingsForm] Requesting socket retry...');
      const response = await browser.runtime.sendMessage({ action: 'socket:retry' });
      console.log('[ConnectionSettingsForm] Socket retry response:', response);

      // We got a response, so connection attempt is complete
      if (response && response.status === 'success') {
        showSuccessMessage('Connection successful!');
      } else {
        // Still save but warn the user
        showSuccessMessage('Settings saved, but connection attempt may have failed: ' +
                           (response?.message || 'No response from server'));
      }

      // Fetch contexts regardless of connection status
      setTimeout(() => fetchAvailableContexts(true), 1000);

      // Close popup with delay
      if (closePopup) {
        setTimeout(() => {
          try {
            closePopup(e as any);
          } catch (err) {
            console.error('[ConnectionSettingsForm] Error closing popup:', err);
          }
        }, 1500); // Increased delay to allow contexts to be fetched
      }
    } catch (err) {
      console.error('[ConnectionSettingsForm] Error saving settings:', err);
      showErrorMessage('Error saving settings or connecting');
    } finally {
      setIsSavingConnection(false);
    }
  };

  // Load defaults from config
  const resetFormToDefaults = async () => {
    // Get current config
    const config = configStore.getAll();

    // Reset form fields
    setProtocol(config.transport.protocol);
    setHost(config.transport.host);
    setPort(String(config.transport.port || ''));
    setToken(config.transport.token || '');
    setIsApiToken(config.transport.isApiToken || false);
    setSelectedContextId(config.transport.contextId || 'default');

    // Reset form changed state
    formChangedRef.current = false;
  };

  // Form input change handlers with validation
  const handleProtocolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    formChangedRef.current = true;
    setProtocol(e.target.value as Protocol);
  };

  const handleHostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    formChangedRef.current = true;
    setHost(e.target.value);
  };

  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    formChangedRef.current = true;
    // Allow only numeric values for port
    const numericValue = e.target.value.replace(/\D/g, '');
    setPort(numericValue);
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    formChangedRef.current = true;
    setToken(e.target.value);
  };

  const handleApiTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    formChangedRef.current = true;
    setIsApiToken(e.target.checked);
  };

  const handleContextChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    formChangedRef.current = true;
    setSelectedContextId(e.target.value);
  };

  return (
    <div className="connection-settings-form">
      <div className="input-container">
        <label className="form-label" htmlFor="connection-setting-protocol">Protocol</label>
        <div className="form-control" id="connection-setting-protocol">
          <select
            className="browser-default"
            value={protocol}
            onChange={handleProtocolChange}
            disabled={isTestingConnection || isSavingConnection}
          >
            <option value="http">http</option>
            <option value="https">https</option>
          </select>
        </div>
      </div>

      <div className="input-container">
        <label className="form-label" htmlFor="connection-setting-host">Host</label>
        <div className="form-control">
          <input
            type="text"
            id="connection-setting-host"
            value={host}
            onChange={handleHostChange}
            placeholder="e.g., localhost or 127.0.0.1"
            disabled={isTestingConnection || isSavingConnection}
          />
        </div>
      </div>

      <div className="input-container">
        <label className="form-label" htmlFor="connection-setting-port">Port</label>
        <div className="form-control">
          <input
            type="text"
            id="connection-setting-port"
            value={port}
            onChange={handlePortChange}
            placeholder="e.g., 8001"
            disabled={isTestingConnection || isSavingConnection}
          />
        </div>
      </div>

      <div className="input-container">
        <label className="form-check-label" htmlFor="connection-setting-isApiToken">
          <input
            type="checkbox"
            id="connection-setting-isApiToken"
            className="form-check-input"
            checked={isApiToken}
            onChange={handleApiTokenChange}
            disabled={isTestingConnection || isSavingConnection}
          />
          Use API Key
        </label>
      </div>

      <div className="input-container">
        <label className="form-label" htmlFor="connection-setting-token">{isApiToken ? 'API Key' : 'Auth Token'}</label>
        <div className="form-control token-input" style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type={showToken ? "text" : "password"}
            id="connection-setting-token"
            value={token}
            onChange={handleTokenChange}
            placeholder={isApiToken ? "Enter your API Key" : "Enter your authentication token"}
            style={{ flexGrow: 1, marginRight: '5px' }}
            disabled={isTestingConnection || isSavingConnection}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="btn-small grey"
            style={{ padding: '0 10px', lineHeight: 'initial' }}
            disabled={isTestingConnection || isSavingConnection}
          >
            {showToken ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div className="input-container">
        <label className="form-label" htmlFor="connection-setting-context">Default Context</label>
        <div className="form-control">
          <select
            className="browser-default"
            id="connection-setting-context"
            value={selectedContextId}
            onChange={handleContextChange}
            disabled={isTestingConnection || isSavingConnection}
          >
            {/* Always include default option */}
            <option value="default">Default (universe:///)</option>

            {/* Map available contexts if fetched */}
            {contextsFetched && availableContexts.length > 0 && availableContexts.map(ctx => (
              <option key={ctx.id} value={ctx.id}>
                {ctx.url} ({ctx.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="input-container popup-button-container" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          className="btn grey waves-effect waves-light"
          style={{ height: '3rem', flex: 1, padding: '5px', lineHeight: 'unset' }}
          disabled={isTestingConnection || isSavingConnection}
          onClick={resetFormToDefaults}
        >
          Reset Form
        </button>

        <button
          className="btn grey waves-effect waves-light"
          style={{ height: '3rem', flex: 1, padding: '5px', lineHeight: 'unset' }}
          disabled={isTestingConnection || isSavingConnection || !token.trim()}
          onClick={testConnection}
        >
          {isTestingConnection ? 'Testing...' : 'Test Connection'}
        </button>

        <button
          className="btn blue waves-effect waves-light"
          style={{ height: '3rem', flex: 1, padding: '5px', lineHeight: 'unset' }}
          disabled={isTestingConnection || isSavingConnection || !token.trim()}
          onClick={saveAndConnect}
        >
          {isSavingConnection ? 'Saving...' : 'Save & Connect'}
        </button>
      </div>
    </div>
  );
};

export default ConnectionSettingsForm;
