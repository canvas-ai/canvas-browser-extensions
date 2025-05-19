import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { setConfig } from '../../redux/config/configActions';
import { Dispatch } from 'redux';
import { browser } from '@/general/utils';
import SearchableSelectBox from '@/popup/common-components/inputs/SearchableSelectBox';
import { RUNTIME_MESSAGES, SOCKET_MESSAGES } from '@/general/constants';
import { showErrorMessage, showSuccessMessage } from '@/popup/utils';

interface ConnectionSettingsFormTypes {
  closePopup?: React.MouseEventHandler<HTMLDivElement>;
}

interface IContextOption {
  id: string;
  url: string;
  isShared?: boolean;
  sharedVia?: string;
}

const ConnectionSettingsForm: React.FC<ConnectionSettingsFormTypes> = ({ closePopup }) => {
  const variables: IVarState = useSelector((state: { variables: IVarState }) => state.variables);
  const config: IConfigProps = useSelector((state: { config: IConfigProps }) => state.config);
  const dispatch = useDispatch<Dispatch<any>>();
  const [transport, setTransport] = useState({ ...config.transport });
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [contexts, setContexts] = useState<IContextOption[]>([]);
  const [isLoadingContexts, setIsLoadingContexts] = useState(false);

  useEffect(() => {
    setTransport({ ...config.transport });
  }, [config.transport]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Clean up any pending operations
      setIsTestingConnection(false);
      setIsSavingConnection(false);
    };
  }, []);

  // Fetch contexts when connection is successful
  useEffect(() => {
    const fetchContexts = async () => {
      if (!transport.token) return;

      setIsLoadingContexts(true);
      try {
        const response = await browser.runtime.sendMessage({
          action: RUNTIME_MESSAGES.context_list
        });

        if (response && response.status === 'success') {
          setContexts(response.payload || []);
        }
      } catch (error) {
        console.error('Failed to fetch contexts:', error);
      } finally {
        setIsLoadingContexts(false);
      }
    };

    fetchContexts();
  }, [transport.token]);

  const testConnection = async () => {
    if (isTestingConnection) return; // Prevent multiple simultaneous tests
    setIsTestingConnection(true);
    try {
      const response = await browser.runtime.sendMessage({
        action: RUNTIME_MESSAGES.socket_retry,
        config: {
          ...config,
          transport: {
            ...transport
          }
        }
      });

      if (response && response.status === 'success') {
        showSuccessMessage('Connection successful!');
        // Fetch contexts after successful connection
        const contextResponse = await browser.runtime.sendMessage({
          action: RUNTIME_MESSAGES.context_list
        });
        if (contextResponse && contextResponse.status === 'success') {
          setContexts(contextResponse.payload || []);
        }
      } else {
        showErrorMessage(response?.message || 'Connection failed. Please check your settings.');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      showErrorMessage('Connection failed. Please check your settings.');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveConnectionSettings = async (e: any) => {
    if (isSavingConnection) return; // Prevent multiple simultaneous saves
    if (closePopup) closePopup(e);
    setIsSavingConnection(true);
    try {
      dispatch(setConfig({ ...config, transport }));
      const response = await browser.runtime.sendMessage({
        action: RUNTIME_MESSAGES.config_set,
        value: { ...config, transport }
      });

      if (response && response.status === 'success') {
        // Use a single timeout for socket retry
        const retryTimeout = setTimeout(() => {
          browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.socket_retry });
        }, 100);

        showSuccessMessage('Settings saved successfully!');

        // Clean up timeout on unmount
        return () => clearTimeout(retryTimeout);
      } else {
        showErrorMessage(response?.message || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      showErrorMessage('Failed to save settings');
    } finally {
      setIsSavingConnection(false);
    }
  };

  const handleContextChange = async (contextId: string) => {
    try {
      await browser.runtime.sendMessage({
        action: RUNTIME_MESSAGES.context_set,
        value: contextId
      });
      setTransport({ ...transport, contextId });
    } catch (error) {
      console.error('Failed to switch context:', error);
      showErrorMessage('Failed to switch context');
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
        <label className="form-label" htmlFor="connection-setting-token">Auth Token</label>
        <div className="form-control token-input">
          <input
            type={showToken ? "text" : "password"}
            id="connection-setting-token"
            value={transport.token}
            onChange={(e) => setTransport({ ...transport, token: e.target.value })}
            onFocus={() => setShowToken(true)}
            onBlur={() => setShowToken(false)}
            placeholder="Enter your authentication token"
          />
        </div>
      </div>

      {transport.token && (
        <div className="input-container">
          <label className="form-label" htmlFor="connection-setting-context">Context</label>
          <div className="form-control">
            <select
              className="browser-default"
              id="connection-setting-context"
              value={transport.contextId || 'default'}
              onChange={(e) => handleContextChange(e.target.value)}
              disabled={isLoadingContexts}
            >
              <option value="default">Default</option>
              {contexts.map((context) => (
                <option key={context.id} value={context.id}>
                  {context.url} {context.isShared ? '(Shared)' : ''}
                </option>
              ))}
            </select>
            {isLoadingContexts && <span className="loading-text">Loading contexts...</span>}
          </div>
        </div>
      )}

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
