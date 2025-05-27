import React, { useEffect, useState } from 'react';
import { browser } from '@/general/utils';
import { RUNTIME_MESSAGES } from '@/general/constants';
import { showErrorMessage, showSuccessMessage } from '@/popup/utils';
import { useUserInfo, useContextList, useConfig, useSelectedContext } from '@/popup/hooks/useStorage';

interface ConnectionSettingsFormTypes {
  closePopup?: React.MouseEventHandler<HTMLDivElement>;
}

const ConnectionSettingsForm: React.FC<ConnectionSettingsFormTypes> = ({ closePopup }) => {
  
  const [userInfo] = useUserInfo();
  const [contexts] = useContextList();
  const [config, setConfig] = useConfig();
  const [savedSelectedContext, setSavedSelectedContext] = useSelectedContext();
  
  const [selectedContext, setSelectedContext] = useState<IContext | null>(null);
  const [transport, setTransport] = useState(config?.transport || { protocol: 'http' as IProtocol, host: '127.0.0.1', port: 8001, token: '', pinToContext: '/', isApiToken: true });
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isLoadingContexts, setIsLoadingContexts] = useState(false);

  useEffect(() => {
    if (config?.transport) {
      setTransport({ ...config.transport });
    }
  }, [config?.transport]);

  useEffect(() => {
    return () => {
      setIsTestingConnection(false);
      setIsSavingConnection(false);
    };
  }, []);

  useEffect(() => {
    if (savedSelectedContext) {
      setSelectedContext(savedSelectedContext);
    }
  }, [savedSelectedContext]);

  useEffect(() => {
    const fetchContexts = async () => {
      try {
        await browser.runtime.sendMessage({
          action: RUNTIME_MESSAGES.context_list
        });
      } catch (error) {
        console.error('Failed to fetch contexts:', error);
      }
    };
    fetchContexts();
  }, [transport.token]);

  useEffect(() => {
    if (contexts.length > 0 && selectedContext) {
      const contextExists = contexts.find(ctx => 
        ctx.id === selectedContext.id && ctx.userId === selectedContext.userId
      );
      
      if (!contextExists) {
        setSelectedContext(null);
      }
    }
  }, [contexts, selectedContext]);

  const testConnection = async () => {
    if (isTestingConnection) return; // Prevent multiple simultaneous tests
    setIsTestingConnection(true);
    
    try {
      // Set up a timeout to clean up the listener if no response comes
      let timeoutId: NodeJS.Timeout;
      
      // Set up listeners for test-specific success/error messages
      const messageListener = (message: any) => {
        if (message.type === RUNTIME_MESSAGES.socket_test_success) {
          showSuccessMessage(message.payload);
          
          // Clear timeout and clean up listener
          clearTimeout(timeoutId);
          browser.runtime.onMessage.removeListener(messageListener);
          setIsTestingConnection(false);
        } else if (message.type === RUNTIME_MESSAGES.socket_test_error) {
          showErrorMessage(message.payload);
          
          // Clear timeout and clean up listener
          clearTimeout(timeoutId);
          browser.runtime.onMessage.removeListener(messageListener);
          setIsTestingConnection(false);
        }
      };

      // Add the listener
      browser.runtime.onMessage.addListener(messageListener);

      // Set up timeout after listener is defined
      timeoutId = setTimeout(() => {
        browser.runtime.onMessage.removeListener(messageListener);
        showErrorMessage('Connection test timeout - please try again');
        setIsTestingConnection(false);
      }, 10000); // 10 second timeout for connection test

      // Send test connection message (without saving config)
      browser.runtime.sendMessage({
        action: RUNTIME_MESSAGES.socket_test,
        config: {
          ...config,
          transport: {
            ...transport
          }
        }
      });

      // Clean up timeout if component unmounts
      return () => {
        clearTimeout(timeoutId);
        browser.runtime.onMessage.removeListener(messageListener);
      };
    } catch (error) {
      console.error('Connection test failed:', error);
      showErrorMessage('Connection failed. Please check your settings.');
      setIsTestingConnection(false);
    }
  };

  const saveConnectionSettings = async (e: any) => {
    if (isSavingConnection) return; // Prevent multiple simultaneous saves
    if (closePopup) closePopup(e);
    setIsSavingConnection(true);
    try {
      if (!config) return;
      
      const updatedConfig = { ...config, transport };
      await setConfig(updatedConfig);
      
      if (selectedContext) {
        await setSavedSelectedContext(selectedContext);
      }
      
      // Set up listeners for success/error messages
      const messageListener = (message: any) => {
        if (message.type === RUNTIME_MESSAGES.success_message && message.payload === 'Settings saved successfully!') {
          showSuccessMessage('Settings saved successfully!');
          
          const retryTimeout = setTimeout(() => {
            browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.socket_retry });
          }, 100);
          
          // Clean up listener
          browser.runtime.onMessage.removeListener(messageListener);
          setIsSavingConnection(false);
          
          return () => clearTimeout(retryTimeout);
        } else if (message.type === RUNTIME_MESSAGES.error_message && message.payload.includes('Failed to save settings')) {
          showErrorMessage(message.payload);
          
          // Clean up listener
          browser.runtime.onMessage.removeListener(messageListener);
          setIsSavingConnection(false);
        }
      };

      // Add the listener
      browser.runtime.onMessage.addListener(messageListener);

      // Set up a timeout to clean up the listener if no response comes
      const timeoutId = setTimeout(() => {
        browser.runtime.onMessage.removeListener(messageListener);
        showErrorMessage('Request timeout - please try again');
        setIsSavingConnection(false);
      }, 5000); // 5 second timeout

      // Send save config message
      browser.runtime.sendMessage({
        action: RUNTIME_MESSAGES.config_set,
        value: updatedConfig
      });

      handleContextChange(selectedContext);

      // Clean up timeout if component unmounts
      return () => {
        clearTimeout(timeoutId);
        browser.runtime.onMessage.removeListener(messageListener);
      };
    } catch (error) {
      console.error('Failed to save settings:', error);
      showErrorMessage('Failed to save settings');
      setIsSavingConnection(false);
    }
  };

  const handleContextChange = async (context: IContext | null) => {
    try {
      setTransport({ ...transport, pinToContext: context?.url || 'universe:///' });
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
              value={selectedContext ? `${selectedContext.userId}/${selectedContext.id}` : `${userInfo?.userId}/default`}
              onChange={(e) => setSelectedContext(contexts.find(context => `${context.userId}/${context.id}` === e.target.value) || null)}
              disabled={isLoadingContexts}
            >
              {contexts.map((context) => (
                <option key={context.id} value={`${context.userId}/${context.id}`} selected={`${context.userId}/${context.id}` === `${selectedContext?.userId}/${selectedContext?.id}`}>
                  {context.url} {context.userId !== userInfo?.userId ? '(Shared)' : ''}
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
