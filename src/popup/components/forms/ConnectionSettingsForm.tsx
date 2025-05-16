import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { setConfig } from '../../redux/config/configActions';
import { Dispatch } from 'redux';
import { browser } from '@/general/utils';
import { RUNTIME_MESSAGES, SOCKET_EVENTS } from '@/general/constants';
import { showErrorMessage, showSuccessMessage } from '@/popup/utils';

interface ConnectionSettingsFormTypes {
  closePopup?: React.MouseEventHandler<HTMLDivElement>;
}

const ConnectionSettingsForm: React.FC<ConnectionSettingsFormTypes> = ({ closePopup }) => {
  const variables: IVarState = useSelector((state: { variables: IVarState }) => state.variables);
  const config: IConfigProps = useSelector((state: { config: IConfigProps }) => state.config);
  const dispatch = useDispatch<Dispatch<any>>();
  const [transport, setTransport] = useState({ ...config.transport });
  const [isApiToken, setIsApiToken] = useState(config.transport.isApiToken || false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [availableContexts, setAvailableContexts] = useState<{id: string, url: string}[]>([{id: 'default', url: 'universe:///'}]);
  const [selectedContext, setSelectedContext] = useState(config.transport.contextId || 'default');
  const [contextsFetched, setContextsFetched] = useState(false);
  const [isFetchingContexts, setIsFetchingContexts] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  // For caching and debouncing
  const lastFetchTimeRef = useRef<number>(0);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const FETCH_COOLDOWN_MS = 5000; // Only fetch once every 5 seconds

  // Set up context update event listener
  useEffect(() => {
    const handleContextUpdates = (message) => {
      if (!message || !message.type) return;

      // Handle context-related update events
      if (message.type === RUNTIME_MESSAGES.user_contexts_list_updated) {
        console.log('[ConnectionSettingsForm] Received context list update event:', message.payload);

        if (Array.isArray(message.payload)) {
          const contexts = message.payload.map(ctx => ({
            id: ctx.id || 'default',
            url: ctx.url || 'universe:///'
          }));

          if (contexts.length > 0) {
            setAvailableContexts(contexts);
            setContextsFetched(true);
          }
        }
      }
    };

    // Add listener for context updates
    browser.runtime.onMessage.addListener(handleContextUpdates);

    // Clean up listener on unmount
    return () => {
      browser.runtime.onMessage.removeListener(handleContextUpdates);
    };
  }, []);

  // Memoize fetchAvailableContexts to prevent recreation on each render
  const fetchAvailableContexts = useCallback(async (force = false) => {
    const now = Date.now();

    // Skip fetching if already in progress
    if (isFetchingContexts || isTestingConnection) {
      console.log('[ConnectionSettingsForm] Skipping fetch - already in progress');
      return;
    }

    // Skip if we've fetched recently, unless force=true
    if (!force && now - lastFetchTimeRef.current < FETCH_COOLDOWN_MS) {
      console.log(`[ConnectionSettingsForm] Skipping fetch - last fetch was ${now - lastFetchTimeRef.current}ms ago (cooldown: ${FETCH_COOLDOWN_MS}ms)`);
      return;
    }

    // Clear any pending fetch
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    setIsFetchingContexts(true);
    lastFetchTimeRef.current = now;

    try {
      console.log('[ConnectionSettingsForm] Fetching available contexts...');
      const response = await browser.runtime.sendMessage({
        action: 'context:list',
        one_time: true // Signal this is a one-time request, not to be repeated
      });

      console.log('[ConnectionSettingsForm] Context list response:', response);

      if (response && response.payload && Array.isArray(response.payload)) {
        console.log('[ConnectionSettingsForm] Fetched contexts:', response.payload);
        const contexts = response.payload.map(ctx => ({
          id: ctx.id || 'default',
          url: ctx.url || 'universe:///'
        }));

        if (contexts.length > 0) {
          setAvailableContexts(contexts);
          setContextsFetched(true);

          // If there's no selected context yet, select the first one
          if (!selectedContext || selectedContext === 'default' || selectedContext === 'unknown') {
            setSelectedContext(contexts[0].id);
          } else {
            // Make sure the selected context exists in the list
            const contextExists = contexts.some(ctx => ctx.id === selectedContext);
            if (!contextExists && contexts.length > 0) {
              console.log(`[ConnectionSettingsForm] Selected context ${selectedContext} not found, using first available`);
              setSelectedContext(contexts[0].id);
            }
          }
        }
      }
    } catch (error) {
      console.error('[ConnectionSettingsForm] Error fetching contexts:', error);
    } finally {
      setIsFetchingContexts(false);
    }
  }, [isTestingConnection, selectedContext]);

  // Load saved config from localStorage on component mount
  useEffect(() => {
    const loadSavedConfig = async () => {
      try {
        // Try to get saved config from local storage
        const savedConfig = await browser.storage.local.get('connectionSettings');
        console.log('[ConnectionSettingsForm] Loaded saved config:', savedConfig);

        if (savedConfig && savedConfig.connectionSettings) {
          const { transport: savedTransport, isApiToken: savedIsApiToken } = savedConfig.connectionSettings;

          if (savedTransport) {
            setTransport(savedTransport);

            // Update Redux state with saved config
            dispatch(setConfig({
              ...config,
              transport: savedTransport
            }));

            // Send to background script
            browser.runtime.sendMessage({
              action: RUNTIME_MESSAGES.config_set,
              value: {
                ...config,
                transport: savedTransport
              }
            });
          }

          if (savedIsApiToken !== undefined) {
            setIsApiToken(savedIsApiToken);
          }

          if (savedTransport && savedTransport.contextId) {
            setSelectedContext(savedTransport.contextId);
          }
        }
      } catch (error) {
        console.error('[ConnectionSettingsForm] Error loading saved config:', error);
      }
    };

    loadSavedConfig();
  }, []);

  // Update local state when config changes
  useEffect(() => {
    console.log('[ConnectionSettingsForm] Config or transport changed, updating local state');
    setTransport({ ...config.transport });
    setIsApiToken(config.transport.isApiToken || false);

    // Set selected context from config when available
    if (config.transport.contextId) {
      setSelectedContext(config.transport.contextId);
    }
  }, [config.transport]);

  // Fetch contexts once when component mounts and connection is established
  useEffect(() => {
    // Only fetch once on mount if connected
    if (variables.connected && !contextsFetched && !isFetchingContexts) {
      console.log('[ConnectionSettingsForm] Initial context fetch on component mount');
      fetchAvailableContexts(true); // force=true to bypass cooldown
    }
  }, [variables.connected, contextsFetched, fetchAvailableContexts, isFetchingContexts]);

  const resetConnectionAttempts = async () => {
    try {
      // Send message to background to reset connection attempts
      await browser.runtime.sendMessage({
        action: 'reset_connection_attempts'
      });
      console.log('[ConnectionSettingsForm] Reset connection attempts');
      setConnectionAttempts(0);
    } catch (error) {
      console.error('[ConnectionSettingsForm] Error resetting connection attempts:', error);
    }
  };

  const testConnection = async () => {
    console.log('[ConnectionSettingsForm] testConnection clicked');

    // Check if token is provided
    if (!transport.token || transport.token.trim() === '') {
      showErrorMessage('Please enter an authentication token before testing the connection');
      return;
    }

    setIsTestingConnection(true);
    setContextsFetched(false); // Reset to force refetch after connection

    // Reset connection attempts to avoid "Too many connection attempts" error
    await resetConnectionAttempts();

    try {
      // Log the current token value for debugging
      console.log(`[ConnectionSettingsForm] Current token value: "${transport.token}"`);

      const updatedTransport = {
        ...transport,
        isApiToken: isApiToken,
        contextId: selectedContext
      };

      console.log('[ConnectionSettingsForm] Using transport settings:', updatedTransport);

      // Save to local storage
      await browser.storage.local.set({
        connectionSettings: {
          transport: updatedTransport,
          isApiToken
        }
      });

      const response = await browser.runtime.sendMessage({
        action: RUNTIME_MESSAGES.socket_retry,
        config: {
          ...config,
          transport: updatedTransport
        }
      });

      console.log('[ConnectionSettingsForm] Test connection response:', response);

      if (response && response.status === 'success') {
        showSuccessMessage('Connection successful!');
        // Wait a moment for the connection to stabilize
        setTimeout(() => {
          fetchAvailableContexts();
        }, 1000);
      } else {
        showErrorMessage('Connection failed. Please check your settings.');
      }
    } catch (error) {
      console.error('[ConnectionSettingsForm] Connection test error:', error);
      showErrorMessage('Connection failed. Please check your settings.');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveConnectionSettings = async (e: any) => {
    console.log('[ConnectionSettingsForm] saveConnectionSettings clicked');

    // Check if token is provided
    if (!transport.token || transport.token.trim() === '') {
      showErrorMessage('Please enter an authentication token before saving');
      return;
    }

    if (closePopup) closePopup(e);
    setIsSavingConnection(true);

    // Reset connection attempts to avoid "Too many connection attempts" error
    await resetConnectionAttempts();

    try {
      // Log the current token value for debugging
      console.log(`[ConnectionSettingsForm] Current token value: "${transport.token}"`);

      const updatedTransport = {
        ...transport,
        isApiToken: isApiToken,
        contextId: selectedContext
      };

      console.log('[ConnectionSettingsForm] Using transport settings:', {
        ...updatedTransport,
        token: updatedTransport.token ? '(token present)' : '(no token)'
      });

      // Save settings to localStorage for persistence
      await browser.storage.local.set({
        connectionSettings: {
          transport: updatedTransport,
          isApiToken
        }
      });

      // Update Redux state with the form values
      dispatch(setConfig({
        ...config,
        transport: updatedTransport
      }));

      // Send to background script
      await browser.runtime.sendMessage({
        action: RUNTIME_MESSAGES.config_set,
        value: {
          ...config,
          transport: updatedTransport
        }
      });

      // Reconnect socket after a short delay
      setTimeout(() => {
        browser.runtime.sendMessage({
          action: RUNTIME_MESSAGES.socket_retry,
          config: {
            ...config,
            transport: updatedTransport
          }
        });
      }, 500);

      showSuccessMessage('Settings saved successfully!');
    } catch (error) {
      console.error('[ConnectionSettingsForm] Save settings error:', error);
      showErrorMessage('Failed to save settings');
    } finally {
      setIsSavingConnection(false);
    }
  };

  return (
    <div className="connection-settings-form">
      <div className="input-container">
        <label className="form-label" htmlFor="connection-setting-protocol">Protocol</label>
        <div className="form-control" id="connection-setting-protocol">
          <select
            className="browser-default"
            value={transport.protocol}
            onChange={(e) => setTransport({ ...transport, protocol: e.target.value as IProtocol })}
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
            value={transport.host}
            onChange={(e) => setTransport({ ...transport, host: e.target.value })}
            placeholder="e.g., localhost or 127.0.0.1"
          />
        </div>
      </div>

      <div className="input-container">
        <label className="form-label" htmlFor="connection-setting-port">Port</label>
        <div className="form-control">
          <input
            type="text"
            id="connection-setting-port"
            value={transport.port}
            onChange={(e) => setTransport({
              ...transport,
              port: !e.target.value.length ? "" : (isNaN(Number(e.target.value)) ? transport.port : Number(e.target.value))
            })}
            placeholder="e.g., 8000"
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
            onChange={(e) => {
              console.log('[ConnectionSettingsForm] isApiToken checkbox changed');
              setIsApiToken(e.target.checked);
            }}
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
            value={transport.token}
            onChange={(e) => {
              console.log(`[ConnectionSettingsForm] Token changed to: ${e.target.value.substring(0, 4)}...`);
              setTransport({ ...transport, token: e.target.value });
            }}
            placeholder={isApiToken ? "Enter your API Key" : "Enter your authentication token"}
            style={{ flexGrow: 1, marginRight: '5px' }}
          />
          <button
            type="button"
            onClick={() => {
              console.log('[ConnectionSettingsForm] show/hide token clicked');
              setShowToken(!showToken);
            }}
            className="btn-small grey"
            style={{ padding: '0 10px', lineHeight: 'initial' }}
          >
            {showToken ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div className="input-container">
        <label className="form-label" htmlFor="connection-setting-context">Context ID</label>
        <div className="form-control">
          <select
            className="browser-default"
            value={selectedContext}
            onChange={(e) => setSelectedContext(e.target.value)}
          >
            {availableContexts.map((context) => (
              <option key={context.id} value={context.id}>
                {context.id} ({context.url})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="input-container popup-button-container" style={{ display: 'flex', gap: '1rem' }}>
        <button
          className="btn grey waves-effect waves-light"
          style={{ height: '3rem', flex: 1, padding: '5px', lineHeight: 'unset' }}
          disabled={isTestingConnection || isSavingConnection}
          onClick={testConnection}
        >
          {isTestingConnection ? 'Testing...' : 'Test Connection'}
        </button>

        <button
          className="btn blue waves-effect waves-light"
          style={{ height: '3rem', flex: 1, padding: '5px', lineHeight: 'unset' }}
          disabled={isTestingConnection || isSavingConnection}
          onClick={saveConnectionSettings}
        >
          {isSavingConnection ? 'Saving...' : 'Save & Connect'}
        </button>
      </div>
    </div>
  );
};

export default ConnectionSettingsForm;
