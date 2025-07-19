import React, { useEffect, useState } from 'react';
import { browser } from '@/general/utils';
import { RUNTIME_MESSAGES } from '@/general/constants';
import { useToast } from '../../../hooks/use-toast';
import { useUserInfo, useContextList, useConfig, useSelectedContext } from '@/popup/hooks/useStorage';
import { useSelector } from 'react-redux';
import { detectBrowser, generateBrowserInstanceName } from '@/general/utils';
import styles from './ConnectionSettingsForm.module.scss';

interface AuthenticationSettingsFormProps {
  onConnectionChange?: (connected: boolean) => void;
}

type AuthType = 'user-password' | 'api-token';

// Simple connectivity test function
const testServerConnectivity = async (serverUrl: string): Promise<{ success: boolean; message: string }> => {
  try {
    console.log(`[ConnectivityTest] Testing ${serverUrl}/rest/v2/ping`);
    const response = await fetch(`${serverUrl}/rest/v2/ping`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (response.ok) {
      return { success: true, message: 'Server is reachable' };
    } else {
      return { success: false, message: `Server returned ${response.status}: ${response.statusText}` };
    }
  } catch (error: any) {
    console.error('[ConnectivityTest] Error:', error);
    if (error.name === 'TimeoutError') {
      return { success: false, message: 'Connection timeout - server may be unreachable' };
    }
    return { success: false, message: `Network error: ${error.message}` };
  }
};

const AuthenticationSettingsForm: React.FC<AuthenticationSettingsFormProps> = ({ onConnectionChange }) => {
  const [userInfo] = useUserInfo();
  const [contexts] = useContextList();
  const [config, setConfig] = useConfig();
  const [savedSelectedContext, setSavedSelectedContext] = useSelectedContext({ savePrev: true });
  const { toast } = useToast();
  const variables = useSelector((state: { variables: IVarState }) => state.variables);

  // Form state
  const [browserInstanceName, setBrowserInstanceName] = useState('');
  const [serverUrl, setServerUrl] = useState('http://127.0.0.1:8001');
  const [authType, setAuthType] = useState<AuthType>('user-password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [selectedContext, setSelectedContext] = useState<IContext | null>(null);

  // State management - simplified with better reset logic
  const [isTestingConnectivity, setIsTestingConnectivity] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [showPassword, setShowPassword] = useState(false);
  const [showApiToken, setShowApiToken] = useState(false);
  const [savedTransportConfig, setSavedTransportConfig] = useState<any>(null); // Store the saved config for websocket test

  // Helper function to reset all loading states
  const resetAllStates = () => {
    setIsTestingConnectivity(false);
    setIsAuthenticating(false);
    setIsConnecting(false);
  };

  // Helper function to handle API responses with better error reporting
  const handleApiResponse = async (response: Response, endpoint: string) => {
    console.log(`[Auth] ${endpoint} response status:`, response.status);

    const contentType = response.headers.get('content-type');
    let responseText;
    try {
      responseText = await response.text();
      console.log(`[Auth] ${endpoint} raw response:`, responseText.substring(0, 200));
    } catch (error) {
      console.error(`[Auth] ${endpoint} failed to read response text:`, error);
      throw new Error(`Failed to read response from ${endpoint}`);
    }

    if (!response.ok) {
      if (contentType && contentType.includes('application/json')) {
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        } catch (parseError) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } else {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
    }

    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Expected JSON response from ${endpoint}, got: ${contentType}`);
    }

    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      console.error(`[Auth] ${endpoint} failed to parse success response as JSON:`, parseError);
      throw new Error(`Invalid JSON response from ${endpoint}`);
    }
  };

  type TransportConfig = {
    protocol: IProtocol;
    host: string;
    port: number;
    token: string;
    pinToContext: string;
    isApiToken: boolean;
  };

  // Simplified connectivity test
  const handleTestConnectivity = async () => {
    if (isTestingConnectivity) return;

    setIsTestingConnectivity(true);
    console.log(`[ConnectivityTest] Testing connectivity to: ${serverUrl}`);

    try {
      const result = await testServerConnectivity(serverUrl);

      if (result.success) {
        toast({
          title: "Connectivity Test Passed",
          description: result.message,
        });
      } else {
        toast({
          title: "Connectivity Test Failed",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('[ConnectivityTest] Unexpected error:', error);
      toast({
        title: "Connectivity Test Error",
        description: error.message || 'Unexpected error during connectivity test',
        variant: "destructive"
      });
    } finally {
      setIsTestingConnectivity(false);
    }
  };

  const authenticateWithUserPassword = async (): Promise<TransportConfig | null> => {
    console.log(`[Auth] authenticateWithUserPassword called`);

    if (!email || !password || !browserInstanceName) {
      toast({
        title: "Authentication Error",
        description: "Email, password, and browser instance name are required",
        variant: "destructive"
      });
      return null;
    }

    try {
      const urlPattern = /^(https?):\/\/([^:]+):(\d+)$/;
      const match = serverUrl.match(urlPattern);

      if (!match) {
        throw new Error('Invalid server URL format');
      }

      const [, protocol, host, portStr] = match;
      const port = parseInt(portStr);

      console.log(`[Auth] Attempting login to: ${serverUrl}/rest/v2/auth/login`);

      // First, authenticate and get JWT token
      const loginResponse = await fetch(`${serverUrl}/rest/v2/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          strategy: 'auto'
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      const loginData = await handleApiResponse(loginResponse, '/rest/v2/auth/login');
      const jwtToken = loginData.data?.token;

      if (!jwtToken) {
        throw new Error('No token received from login');
      }

      console.log(`[Auth] Login successful, creating API token with name: ${browserInstanceName}`);

      // Now create an API token using the JWT token
      const tokenResponse = await fetch(`${serverUrl}/rest/v2/auth/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({
          name: browserInstanceName,
          description: `Browser extension token for ${browserInstanceName}`
        }),
        signal: AbortSignal.timeout(10000)
      });

      const tokenData = await handleApiResponse(tokenResponse, '/rest/v2/auth/tokens');
      const apiTokenValue = tokenData.data?.token;

      if (!apiTokenValue) {
        throw new Error('No API token received');
      }

      console.log(`[Auth] API token created successfully`);

      return {
        protocol: protocol as IProtocol,
        host,
        port,
        token: apiTokenValue,
        pinToContext: selectedContext?.url || 'universe:///',
        isApiToken: true
      };

    } catch (error: any) {
      console.error('[Auth] Authentication failed:', error);
      throw error; // Re-throw for caller to handle
    }
  };

  const validateApiToken = async (): Promise<TransportConfig | null> => {
    console.log(`[Auth] validateApiToken called`);

    if (!apiToken) {
      toast({
        title: "Validation Error",
        description: "API token is required",
        variant: "destructive"
      });
      return null;
    }

    try {
      const urlPattern = /^(https?):\/\/([^:]+):(\d+)$/;
      const match = serverUrl.match(urlPattern);

      if (!match) {
        throw new Error('Invalid server URL format');
      }

      const [, protocol, host, portStr] = match;
      const port = parseInt(portStr);

      console.log(`[Auth] Validating API token at: ${serverUrl}/rest/v2/auth/token/verify`);

      // Validate API token
      const verifyResponse = await fetch(`${serverUrl}/rest/v2/auth/token/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: apiToken
        }),
        signal: AbortSignal.timeout(10000)
      });

      const verifyData = await handleApiResponse(verifyResponse, '/rest/v2/auth/token/verify');

      if (!verifyData.data?.valid) {
        throw new Error('Invalid token');
      }

      console.log(`[Auth] Token validation successful`);

      return {
        protocol: protocol as IProtocol,
        host,
        port,
        token: apiToken,
        pinToContext: selectedContext?.url || 'universe:///',
        isApiToken: true
      };

    } catch (error: any) {
      console.error('[Auth] Token validation failed:', error);
      throw error; // Re-throw for caller to handle
    }
  };

  // Simplified authentication only (no websocket testing)
  const handleAuthenticate = async () => {
    if (isAuthenticating) return;

    setIsAuthenticating(true);
    console.log(`[Auth] Starting authentication with authType: ${authType}`);

    try {
      let transportConfig: TransportConfig | null = null;

      if (authType === 'user-password') {
        transportConfig = await authenticateWithUserPassword();
      } else {
        transportConfig = await validateApiToken();
      }

      if (!transportConfig) {
        throw new Error('Authentication failed - no transport config received');
      }

      console.log(`[Auth] Authentication successful, saving configuration...`);

      // Save the configuration
      const updatedConfig: IConfigProps = {
        sync: config?.sync || {
          tabBehaviorOnContextChange: 'Close Current and Open New' as IContextChangeBehavior,
          autoOpenCanvasTabs: true
        },
        browserIdentity: {
          syncOnlyTaggedTabs: config?.browserIdentity?.syncOnlyTaggedTabs || false,
          browserTag: browserInstanceName
        },
        session: config?.session || { id: "Default", baseUrl: "/" },
        transport: transportConfig
      };

      await setConfig(updatedConfig);
      // Store the transport config for websocket testing
      setSavedTransportConfig(transportConfig);

      toast({
        title: "Authentication Successful",
        description: "Credentials saved. You can now test the connection.",
      });

    } catch (error: any) {
      console.error('[Auth] Authentication failed:', error);
      toast({
        title: "Authentication Failed",
        description: error.message || 'Failed to authenticate with server',
        variant: "destructive"
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Separate websocket connection test using the saved transport config
  const handleTestConnection = async () => {
    if (isConnecting) return;

    setIsConnecting(true);
    setConnectionStatus('unknown');

    console.log(`[Auth] Testing websocket connection...`);

    try {
      // Use saved transport config if available, fallback to current config
      const testConfig = savedTransportConfig ? {
        ...config,
        transport: savedTransportConfig
      } : config;

      if (!testConfig?.transport?.token) {
        throw new Error('No authentication token available. Please save credentials first.');
      }

      console.log(`[Auth] Using config for websocket test:`, {
        protocol: testConfig.transport.protocol,
        host: testConfig.transport.host,
        port: testConfig.transport.port,
        hasToken: !!testConfig.transport.token,
        isApiToken: testConfig.transport.isApiToken
      });

      let timeoutId: NodeJS.Timeout;

      const messageListener = (message: any) => {
        if (message.type === RUNTIME_MESSAGES.socket_test_success) {
          setConnectionStatus('connected');
          clearTimeout(timeoutId);
          browser.runtime.onMessage.removeListener(messageListener);

          toast({
            title: "Connection Successful",
            description: "Connected to Canvas server successfully"
          });

          // Fetch contexts after successful connection
          browser.runtime.sendMessage({
            action: RUNTIME_MESSAGES.context_list
          }).then(() => {
            console.log('Context list request sent');
          }).catch(error => {
            console.error('Failed to request context list:', error);
          });

        } else if (message.type === RUNTIME_MESSAGES.socket_test_error) {
          setConnectionStatus('disconnected');
          clearTimeout(timeoutId);
          browser.runtime.onMessage.removeListener(messageListener);

          toast({
            title: "Connection Failed",
            description: message.payload || 'WebSocket connection failed',
            variant: "destructive"
          });
        }
      };

      browser.runtime.onMessage.addListener(messageListener);

      timeoutId = setTimeout(() => {
        browser.runtime.onMessage.removeListener(messageListener);
        setConnectionStatus('disconnected');
        toast({
          title: "Connection Timeout",
          description: "Connection test timeout - please try again",
          variant: "destructive"
        });
      }, 15000); // 15 second timeout

      // Send test connection message using the saved config
      browser.runtime.sendMessage({
        action: RUNTIME_MESSAGES.socket_test,
        config: testConfig
      });

    } catch (error: any) {
      console.error('[Auth] Connection test failed:', error);
      setConnectionStatus('disconnected');
      toast({
        title: "Connection Failed",
        description: error.message || 'Failed to test connection',
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await browser.runtime.sendMessage({
        action: RUNTIME_MESSAGES.socket_disconnect
      });

      setConnectionStatus('disconnected');
      resetAllStates();

      toast({
        title: "Disconnected",
        description: "Disconnected from Canvas server"
      });

    } catch (error: any) {
      console.error('Disconnect failed:', error);
      toast({
        title: "Disconnect Error",
        description: error.message || 'Failed to disconnect properly',
        variant: "destructive"
      });
    }
  };

  const handleContextChange = async (context: IContext | null) => {
    setSelectedContext(context);

    try {
      if (context) {
        await browser.runtime.sendMessage({
          action: RUNTIME_MESSAGES.context_set_url,
          payload: { url: context.url }
        });

        await setSavedSelectedContext(context);

        toast({
          title: "Context Changed",
          description: `Switched to context: ${context.id}`,
        });
      } else {
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

  // Auto-select first context when contexts become available
  useEffect(() => {
    if (contexts.length > 0 && !selectedContext && variables.connected) {
      const firstContext = contexts[0];
      setSelectedContext(firstContext);
      handleContextChange(firstContext);
    }
  }, [contexts, selectedContext, variables.connected]);

  // Initialize form values from config
  useEffect(() => {
    if (config?.transport) {
      const transport = config.transport;
      setServerUrl(`${transport.protocol}://${transport.host}:${transport.port}`);
      if (transport.token) {
        setApiToken(transport.token);
        setAuthType('api-token');
        // Store the existing transport config
        setSavedTransportConfig(transport);
      }
    }

    if (config?.browserIdentity?.browserTag) {
      setBrowserInstanceName(config.browserIdentity.browserTag);
    } else {
      // Auto-generate browser instance name
      const autoName = generateBrowserInstanceName();
      setBrowserInstanceName(autoName);
    }
  }, [config]);

  useEffect(() => {
    if (savedSelectedContext) {
      setSelectedContext(savedSelectedContext);
    }
  }, [savedSelectedContext]);

  useEffect(() => {
    // Update connection status based on Redux state
    setConnectionStatus(variables.connected ? 'connected' : 'disconnected');
  }, [variables.connected]);

  useEffect(() => {
    // Notify parent component about connection changes
    if (onConnectionChange) {
      onConnectionChange(variables.connected);
    }
  }, [variables.connected, onConnectionChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetAllStates();
    };
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#10b981';
      case 'disconnected': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = () => {
    if (isTestingConnectivity) return 'Testing connectivity...';
    if (isAuthenticating) return 'Authenticating...';
    if (isConnecting) return 'Connecting...';
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      default: return 'Ready to connect';
    }
  };

  const handleUrlChange = (value: string) => {
    const urlPattern = /^(https?):\/\/([^:]+):(\d+)$/;
    const match = value.match(urlPattern);

    if (match) {
      setServerUrl(value);
    } else {
      setServerUrl(value); // Allow partial input
    }
  };

  // Determine if form should be disabled - only disable the specific operation in progress
  // Only disable form when there's an active network operation that should prevent changes
  const shouldDisableCredentialFields = isAuthenticating;
  const shouldDisableConnectionFields = isConnecting || isTestingConnectivity;

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

      {/* Browser Instance Name */}
      <div className={styles.inputContainer}>
        <label className={styles.formLabel} htmlFor="browser-instance-name">
          Name this browser instance
        </label>
        <div className={styles.formControl}>
          <input
            type="text"
            id="browser-instance-name"
            value={browserInstanceName}
            onChange={(e) => setBrowserInstanceName(e.target.value)}
            placeholder="chrome@hostname"
            disabled={shouldDisableCredentialFields}
          />
        </div>
      </div>

      {/* Canvas Server URL */}
      <div className={styles.inputContainer}>
        <label className={styles.formLabel} htmlFor="server-url">
          Canvas Server URL
        </label>
        <div className={styles.formControl}>
          <input
            type="text"
            id="server-url"
            value={serverUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="http://127.0.0.1:8001"
            disabled={shouldDisableConnectionFields}
          />
        </div>
        <div style={{ marginTop: '8px' }}>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={handleTestConnectivity}
            disabled={shouldDisableConnectionFields}
            style={{ fontSize: '12px', padding: '4px 8px' }}
          >
            {isTestingConnectivity ? 'Testing...' : 'Test Server'}
          </button>
        </div>
      </div>

      {/* Auth Type Selection */}
      <div className={styles.inputContainer}>
        <label className={styles.formLabel}>Authentication Type</label>
        <div className={styles.formControl}>
          <select
            className="browser-default"
            value={authType}
            onChange={(e) => setAuthType(e.target.value as AuthType)}
            disabled={shouldDisableCredentialFields}
          >
            <option value="user-password">User + Password</option>
            <option value="api-token">API Token</option>
          </select>
        </div>
      </div>

      {/* User + Password Fields */}
      {authType === 'user-password' && (
        <>
          <div className={styles.inputContainer}>
            <label className={styles.formLabel} htmlFor="email">Email</label>
            <div className={styles.formControl}>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                disabled={shouldDisableCredentialFields}
              />
            </div>
          </div>

          <div className={styles.inputContainer}>
            <label className={styles.formLabel} htmlFor="password">Password</label>
            <div className={styles.formControl}>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setShowPassword(true)}
                onBlur={() => setShowPassword(false)}
                placeholder="Enter your password"
                disabled={shouldDisableCredentialFields}
              />
            </div>
          </div>
        </>
      )}

      {/* API Token Field */}
      {authType === 'api-token' && (
        <div className={styles.inputContainer}>
          <label className={styles.formLabel} htmlFor="api-token">API Token</label>
          <div className={styles.formControl}>
            <input
              type={showApiToken ? "text" : "password"}
              id="api-token"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              onFocus={() => setShowApiToken(true)}
              onBlur={() => setShowApiToken(false)}
              placeholder="canvas-..."
              disabled={shouldDisableCredentialFields}
            />
          </div>
        </div>
      )}

      {/* Authentication Button */}
      <div className={styles.inputContainer}>
        <button
          className={styles.btn}
          onClick={handleAuthenticate}
          disabled={shouldDisableCredentialFields}
          style={{ width: '100%' }}
        >
          {isAuthenticating ? 'Authenticating...' : 'Save Credentials'}
        </button>
      </div>

      {/* Context Selection */}
      {contexts.length > 0 && (
        <div className={styles.inputContainer}>
          <label className={styles.formLabel} htmlFor="context-select">
            Bind to Context
          </label>
          <div className={styles.formControl}>
            <select
              className="browser-default"
              id="context-select"
              value={selectedContext ? `${selectedContext.userId}/${selectedContext.id}` : 'default'}
              onChange={(e) => {
                const selectedValue = e.target.value;
                if (selectedValue && selectedValue !== 'default') {
                  const foundContext = contexts.find(context => `${context.userId}/${context.id}` === selectedValue);
                  if (foundContext) {
                    handleContextChange(foundContext);
                  }
                } else {
                  handleContextChange(null);
                }
              }}
              disabled={!variables.connected}
            >
              <option value="default">Select a context...</option>
              {contexts.map((context) => (
                <option key={context.id} value={`${context.userId}/${context.id}`}>
                  {context.id} | {context.url} {context.userId !== userInfo?.userId ? `(${context.userId})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Connection Test / Disconnect Button */}
      <div className={styles.inputContainer}>
        {!variables.connected ? (
          <button
            className={styles.btn}
            onClick={handleTestConnection}
            disabled={isConnecting || !savedTransportConfig}
            style={{ width: '100%' }}
            title={!savedTransportConfig ? 'Please save credentials first' : ''}
          >
            {isConnecting ? 'Testing Connection...' : 'Test Connection'}
          </button>
        ) : (
          <button
            className={`${styles.btn} red`}
            onClick={handleDisconnect}
            style={{ width: '100%', backgroundColor: '#ef4444', color: 'white' }}
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
};

export default AuthenticationSettingsForm;
