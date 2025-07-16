import React, { useEffect, useState } from 'react';
import { browser } from '@/general/utils';
import { RUNTIME_MESSAGES } from '@/general/constants';
import { useToast } from '../../../hooks/use-toast';
import { useUserInfo, useContextList, useConfig, useSelectedContext } from '@/popup/hooks/useStorage';
import styles from './ConnectionSettingsForm.module.scss';

interface ConnectionSettingsFormTypes {
  closePopup?: React.MouseEventHandler<HTMLDivElement>;
}

const ConnectionSettingsForm: React.FC<ConnectionSettingsFormTypes> = ({ closePopup }) => {

  const [userInfo] = useUserInfo();
  const [contexts] = useContextList();
  const [config, setConfig] = useConfig();
  const [savedSelectedContext, setSavedSelectedContext] = useSelectedContext({ savePrev: true });
  const { toast } = useToast();

  const [selectedContext, setSelectedContext] = useState<IContext | null>(null);
  const [transport, setTransport] = useState(config?.transport || { protocol: 'http' as IProtocol, host: '127.0.0.1', port: 8001, token: '', pinToContext: '/', isApiToken: true });
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isLoadingContexts, setIsLoadingContexts] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');

  // Derived state for URL display
  const serverUrl = `${transport.protocol}://${transport.host}:${transport.port}`;

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

    // Fetch contexts when component mounts or when token changes
    if (transport.token) {
      fetchContexts();
    }
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
    setConnectionStatus('unknown');

    try {
      // Set up a timeout to clean up the listener if no response comes
      let timeoutId: NodeJS.Timeout;

      // Set up listeners for test-specific success/error messages
      const messageListener = (message: any) => {
        if (message.type === RUNTIME_MESSAGES.socket_test_success) {
          setConnectionStatus('connected');
          toast({
            title: "Connection Test",
            description: message.payload
          });

          // Fetch contexts immediately after successful test
          console.log('ConnectionSettingsForm: Fetching contexts after successful test...');
          browser.runtime.sendMessage({
            action: RUNTIME_MESSAGES.context_list
          }).then(() => {
            console.log('ConnectionSettingsForm: Context list request sent');
          }).catch(error => {
            console.error('ConnectionSettingsForm: Failed to request context list:', error);
          });

          // Clear timeout and clean up listener
          clearTimeout(timeoutId);
          browser.runtime.onMessage.removeListener(messageListener);
          setIsTestingConnection(false);
        } else if (message.type === RUNTIME_MESSAGES.socket_test_error) {
          setConnectionStatus('disconnected');
          toast({
            title: "Connection Failed",
            description: message.payload,
            variant: "destructive"
          });

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
        toast({
          title: "Connection Timeout",
          description: "Connection test timeout - please try again",
          variant: "destructive"
        });
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
      toast({
        title: "Connection Failed",
        description: "Connection failed. Please check your settings.",
        variant: "destructive"
      });
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

      await setSavedSelectedContext(selectedContext);

      // Set up a timeout to clean up the listener if no response comes
      let timeoutId: NodeJS.Timeout;

      // Set up listeners for success/error messages
      const messageListener = (message: any) => {
        if (message.type === RUNTIME_MESSAGES.config_set_success) {
          toast({
            title: "Settings Saved",
            description: message.payload
          });

          const retryTimeout = setTimeout(() => {
            browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.socket_retry });
          }, 100);

          // Clear timeout and clean up listener
          clearTimeout(timeoutId);
          browser.runtime.onMessage.removeListener(messageListener);
          setIsSavingConnection(false);

          return () => clearTimeout(retryTimeout);
        } else if (message.type === RUNTIME_MESSAGES.error_message && message.payload.includes('Failed to save settings')) {
          toast({
            title: "Save Failed",
            description: message.payload,
            variant: "destructive"
          });

          // Clear timeout and clean up listener
          clearTimeout(timeoutId);
          browser.runtime.onMessage.removeListener(messageListener);
          setIsSavingConnection(false);
        }
      };

      // Add the listener
      browser.runtime.onMessage.addListener(messageListener);

      // Set up timeout after listener is defined
      timeoutId = setTimeout(() => {
        browser.runtime.onMessage.removeListener(messageListener);
        toast({
          title: "Request Timeout",
          description: "Request timeout - please try again",
          variant: "destructive"
        });
        setIsSavingConnection(false);
      }, 5000); // 5 second timeout

      // Send save config message
      browser.runtime.sendMessage({
        action: RUNTIME_MESSAGES.config_set,
        value: updatedConfig
      });

      // Clean up timeout if component unmounts
      return () => {
        clearTimeout(timeoutId);
        browser.runtime.onMessage.removeListener(messageListener);
      };
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save settings",
        variant: "destructive"
      });
      setIsSavingConnection(false);
    }
  };

  const handleContextChange = async (context: IContext | null) => {
    try {
      setTransport({ ...transport, pinToContext: context?.url || 'universe:///' });

      // Send context change message to background script
      if (context) {
        console.log('ConnectionSettingsForm: Changing context to:', context);
        await browser.runtime.sendMessage({
          action: RUNTIME_MESSAGES.context_set_url,
          payload: { url: context.url }
        });

        // Update the selected context in storage
        await setSavedSelectedContext(context);

        toast({
          title: "Context Changed",
          description: `Switched to context: ${context.id}`,
        });
      } else {
        // Switch to default context
        await browser.runtime.sendMessage({
          action: RUNTIME_MESSAGES.context_set_url,
          payload: { url: 'universe:///' }
        });

        await setSavedSelectedContext(null);

        toast({
          title: "Context Changed",
          description: "Switched to default context",
        });
      }
    } catch (error) {
      console.error('Failed to switch context:', error);
      toast({
        title: "Context Error",
        description: "Failed to switch context",
        variant: "destructive"
      });
    }
  };

  const handleUrlChange = (value: string) => {
    const urlPattern = /^(https?):\/\/([^:]+):(\d+)$/;
    const match = value.match(urlPattern);

    if (match) {
      setTransport({
        ...transport,
        protocol: match[1] as IProtocol,
        host: match[2],
        port: parseInt(match[3])
      });
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#10b981';
      case 'disconnected': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = () => {
    if (isTestingConnection) return 'Testing connection...';
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Connection failed';
      default: return 'Ready to test';
    }
  };

  return (
    <div className={styles.connectionSettingsForm}>
      {/* Connection Status */}
      <div className={styles.inputContainer}>
        <label className={styles.formLabel}>Connection Status</label>
        <div className={styles.formControl}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            background: '#f9fafb'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: getStatusColor()
            }} />
            <span style={{ fontSize: '14px', color: '#374151' }}>
              {getStatusText()}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.inputContainer}>
        <label className={styles.formLabel} htmlFor="connection-setting-url">Canvas Server URL</label>
        <div className={styles.formControl}>
          <input
            type="text"
            id="connection-setting-url"
            value={serverUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="http://127.0.0.1:8001"
          />
        </div>
      </div>

      <div className={styles.inputContainer}>
        <label className={styles.formLabel} htmlFor="connection-setting-token">API Token</label>
        <div className={styles.formControl}>
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

      {contexts.length > 0 && (
        <div className={styles.inputContainer}>
          <label className={styles.formLabel} htmlFor="connection-setting-context">Context to Bind to</label>
          <div className={styles.formControl}>
            <select
              key={`context-select-${selectedContext?.id || 'none'}-${contexts.length}`}
              className="browser-default"
              id="connection-setting-context"
              value={selectedContext ? `${selectedContext.userId}/${selectedContext.id}` : 'default'}
              onChange={(e) => {
                const selectedValue = e.target.value;
                if (selectedValue && selectedValue !== 'default') {
                  const foundContext = contexts.find(context => `${context.userId}/${context.id}` === selectedValue);
                  if (foundContext) {
                    setSelectedContext(foundContext);
                    handleContextChange(foundContext);
                  }
                } else {
                  setSelectedContext(null);
                  handleContextChange(null);
                }
              }}
              disabled={isLoadingContexts}
            >
              {contexts.map((context) => (
                <option key={context.id} value={`${context.userId}/${context.id}`}>
                  {context.id} | {context.url} {context.userId !== userInfo?.userId ? `(${context.userId})` : ''}
                </option>
              ))}
            </select>
            {isLoadingContexts && <span className={styles.loadingText}>Loading contexts...</span>}
          </div>
        </div>
      )}

      <div className={styles.inputContainer}>
        <button
          className={styles.btn}
          disabled={isTestingConnection || isSavingConnection}
          onClick={testConnection}
        >
          {isTestingConnection ? 'Testing...' : 'Test Connection'}
        </button>

        <button
          className={styles.btn}
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
