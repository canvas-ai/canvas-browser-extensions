import React, { useState, useEffect } from 'react';
import { browser } from '@/general/utils';
import { RUNTIME_MESSAGES } from '@/general/constants';
import { useUserInfo, useContextList, useConfig, useSelectedContext } from '@/popup/hooks/useStorage';
import { useToast } from '../../hooks/use-toast';
import styles from './SetupWindow.module.scss';

interface SetupWindowProps {
  onSetupComplete: () => void;
}

const SetupWindow: React.FC<SetupWindowProps> = ({ onSetupComplete }) => {
  const [userInfo] = useUserInfo();
  const [contexts] = useContextList();
  const [config, setConfig] = useConfig();
  const [savedSelectedContext, setSavedSelectedContext] = useSelectedContext({ savePrev: true });
  const { toast } = useToast();

  // Use the same state patterns as ConnectionSettingsForm
  const [selectedContext, setSelectedContext] = useState<IContext | null>(null);
  const [transport, setTransport] = useState(config?.transport || {
    protocol: 'http' as IProtocol,
    host: '127.0.0.1',
    port: 8001,
    token: '',
    pinToContext: '/',
    isApiToken: true
  });
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Derived state for URL display
  const serverUrl = `${transport.protocol}://${transport.host}:${transport.port}`;

  useEffect(() => {
    if (config?.transport) {
      setTransport({ ...config.transport });
    }
  }, [config?.transport]);

  useEffect(() => {
    if (savedSelectedContext) {
      setSelectedContext(savedSelectedContext);
    }
  }, [savedSelectedContext]);

  useEffect(() => {
    // Add message listeners for context operations
    const messageListener = (message: any) => {
      if (message.type === RUNTIME_MESSAGES.context_list) {
        // Context list received - no toast needed, it's expected
      }
    };

    browser.runtime.onMessage.addListener(messageListener);

    return () => {
      browser.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

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
    if (isConnecting) return;
    setIsConnecting(true);

    try {
      let timeoutId: NodeJS.Timeout;

      const messageListener = (message: any) => {
        if (message.type === RUNTIME_MESSAGES.socket_test_success) {
          setConnectionStatus('connected');
          clearTimeout(timeoutId);
          browser.runtime.onMessage.removeListener(messageListener);
          setIsConnecting(false);

          // Fetch contexts immediately after successful test
          console.log('SetupWindow: Fetching contexts after successful test...');
          browser.runtime.sendMessage({
            action: RUNTIME_MESSAGES.context_list
          }).then(() => {
            console.log('SetupWindow: Context list request sent');
          }).catch(error => {
            console.error('SetupWindow: Failed to request context list:', error);
          });

          // First establish the main socket connection, then fetch contexts
          setTimeout(() => {
            console.log('SetupWindow: Establishing main socket connection...');
            // Save config first to ensure the main socket has the right credentials
            if (config) {
              const updatedConfig = { ...config, transport };
              browser.runtime.sendMessage({
                action: RUNTIME_MESSAGES.config_set,
                value: updatedConfig
              }).then(() => {
                // Now retry the socket connection with new config
                browser.runtime.sendMessage({
                  action: RUNTIME_MESSAGES.socket_retry
                }).then(() => {
                  // Wait a bit for connection to stabilize, then fetch contexts
                  setTimeout(() => {
                    console.log('SetupWindow: Requesting context list...');
                    browser.runtime.sendMessage({
                      action: RUNTIME_MESSAGES.context_list
                    }).catch(error => {
                      console.error('SetupWindow: Failed to request context list:', error);
                    });
                  }, 1000);
                }).catch(error => {
                  console.error('SetupWindow: Failed to retry socket connection:', error);
                });
              }).catch(error => {
                console.error('SetupWindow: Failed to save config:', error);
              });
            }
          }, 500);
        } else if (message.type === RUNTIME_MESSAGES.socket_test_error) {
          setConnectionStatus('disconnected');
          clearTimeout(timeoutId);
          browser.runtime.onMessage.removeListener(messageListener);
          setIsConnecting(false);
        }
      };

      browser.runtime.onMessage.addListener(messageListener);

      timeoutId = setTimeout(() => {
        browser.runtime.onMessage.removeListener(messageListener);
        setConnectionStatus('disconnected');
        setIsConnecting(false);
      }, 10000); // Increased timeout to 10 seconds

      browser.runtime.sendMessage({
        action: RUNTIME_MESSAGES.socket_test,
        config: {
          transport: {
            protocol: transport.protocol,
            host: transport.host,
            port: transport.port,
            token: transport.token,
            isApiToken: transport.isApiToken || true
          }
        }
      });

      console.log('SetupWindow: Sending socket test with config:', {
        protocol: transport.protocol,
        host: transport.host,
        port: transport.port,
        token: transport.token ? '[TOKEN SET]' : '[NO TOKEN]',
        isApiToken: transport.isApiToken || true
      });

    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('disconnected');
      setIsConnecting(false);
    }
  };

  const handleSaveAndClose = async () => {
    if (connectionStatus !== 'connected') {
      toast({
        title: "Connection Required",
        description: "Please establish a connection before saving",
        variant: "destructive"
      });
      return;
    }

    if (isSaving) return;
    setIsSaving(true);

    try {
      if (!config) return;

      const updatedConfig = { ...config, transport };
      await setConfig(updatedConfig);

      if (selectedContext) {
        await setSavedSelectedContext(selectedContext);
      }

      let timeoutId: NodeJS.Timeout;

      const messageListener = (message: any) => {
        if (message.type === RUNTIME_MESSAGES.config_set_success) {
          clearTimeout(timeoutId);
          browser.runtime.onMessage.removeListener(messageListener);
          setIsSaving(false);

          toast({
            title: "Settings Saved",
            description: "Your Canvas configuration has been saved successfully"
          });

          setTimeout(() => {
            browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.socket_retry });
            onSetupComplete();
          }, 100);
        } else if (message.type === RUNTIME_MESSAGES.error_message && message.payload.includes('Failed to save settings')) {
          clearTimeout(timeoutId);
          browser.runtime.onMessage.removeListener(messageListener);
          setIsSaving(false);

          toast({
            title: "Save Failed",
            description: "Failed to save your settings. Please try again.",
            variant: "destructive"
          });
        }
      };

      browser.runtime.onMessage.addListener(messageListener);

      timeoutId = setTimeout(() => {
        browser.runtime.onMessage.removeListener(messageListener);
        setIsSaving(false);
        toast({
          title: "Request Timeout",
          description: "The request timed out. Please try again.",
          variant: "destructive"
        });
      }, 5000);

      browser.runtime.sendMessage({
        action: RUNTIME_MESSAGES.config_set,
        value: updatedConfig
      });

      // Handle context change
      if (selectedContext) {
        setTransport({ ...transport, pinToContext: selectedContext?.url || 'universe:///' });
      }

    } catch (error) {
      console.error('Failed to save settings:', error);
      setIsSaving(false);
      toast({
        title: "Unexpected Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleContextChange = async (context: IContext | null) => {
    try {
      // Send context change message to background script
      if (context) {
        console.log('SetupWindow: Changing context to:', context);
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
    if (isConnecting) return 'Connecting...';
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Connection failed';
      default: return 'Ready to connect';
    }
  };

  return (
    <div className={styles.setupWindow}>
      <div className={styles.setupContent}>
        <div className={styles.setupHeader}>
          <h1 className={styles.setupTitle}>Canvas Setup</h1>
          <p className={styles.setupSubtitle}>Configure your connection to Canvas Server</p>
        </div>

        <div className={styles.setupForm}>
          {/* Connection Status */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Status</label>
            <div className={styles.statusIndicator}>
              <div
                className={styles.statusDot}
                style={{ backgroundColor: getStatusColor() }}
              />
              <span className={styles.statusText}>
                Canvas Server: {getStatusText()}
              </span>
            </div>
          </div>

          {/* Server URL */}
          <div className={styles.formGroup}>
            <label htmlFor="serverUrl" className={styles.formLabel}>
              Canvas Server URL
            </label>
            <input
              id="serverUrl"
              type="text"
              className={styles.formInput}
              value={serverUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="http://127.0.0.1:8001"
            />
          </div>

          {/* API Token */}
          <div className={styles.formGroup}>
            <label htmlFor="apiToken" className={styles.formLabel}>
              Canvas Server API Token
            </label>
            <input
              id="apiToken"
              type="password"
              className={styles.formInput}
              value={transport.token}
              onChange={(e) => setTransport({ ...transport, token: e.target.value })}
              placeholder="Enter your API token"
            />
          </div>

          {/* Context Selection - Always visible */}
          <div className={styles.formGroup}>
            <label htmlFor="context" className={styles.formLabel}>
              Bind to Context
            </label>
            <select
              id="context"
              className={styles.formSelect}
              value={selectedContext ? `${selectedContext.userId}/${selectedContext.id}` : 'default'}
              onChange={(e) => {
                if (e.target.value === 'default') {
                  setSelectedContext(null);
                  handleContextChange(null);
                } else {
                  const foundContext = contexts.find(context => `${context.userId}/${context.id}` === e.target.value);
                  setSelectedContext(foundContext || null);
                  if (foundContext) {
                    handleContextChange(foundContext);
                  }
                }
              }}
              disabled={connectionStatus !== 'connected'}
            >
              <option value="default" style={{ color: '#9ca3af' }}>
                default | universe:///
              </option>
              {contexts.map((context) => (
                <option key={context.id} value={`${context.userId}/${context.id}`}>
                  {context.id} | {context.url} {context.userId !== userInfo?.userId ? `(${context.userId})` : ''}
                </option>
              ))}
            </select>
            {connectionStatus === 'connected' && contexts.length === 0 && (
              <div className={styles.loadingText}>Loading contexts...</div>
            )}
          </div>

          {/* Action Buttons */}
          <div className={styles.formActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={testConnection}
              disabled={isConnecting || !transport.host || !transport.token}
            >
              {isConnecting ? 'Connecting...' : 'Connect to Canvas'}
            </button>

            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleSaveAndClose}
              disabled={isSaving || connectionStatus !== 'connected'}
            >
              {isSaving ? 'Saving...' : 'Save and Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupWindow;
