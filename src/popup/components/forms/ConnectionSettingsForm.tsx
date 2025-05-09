import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { setConfig } from '../../redux/config/configActions';
import { Dispatch } from 'redux';
import { browser } from '@/general/utils';
import SearchableSelectBox from '@/popup/common-components/inputs/SearchableSelectBox';
import { DEFAULT_SESSION, RUNTIME_MESSAGES } from '@/general/constants';
import { setSessionList } from '@/popup/redux/variables/varActions';
import { showErrorMessage, showSuccessMessage } from '@/popup/utils';

interface ConnectionSettingsFormTypes {
  closePopup?: React.MouseEventHandler<HTMLDivElement>;
}

const ConnectionSettingsForm: React.FC<ConnectionSettingsFormTypes> = ({ closePopup }) => {
  const variables: IVarState = useSelector((state: { variables: IVarState }) => state.variables);
  const config: IConfigProps = useSelector((state: { config: IConfigProps }) => state.config);
  const dispatch = useDispatch<Dispatch<any>>();
  const [transport, setTransport] = useState({ ...config.transport });
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [availableContexts, setAvailableContexts] = useState<string[]>(['default']);
  const [selectedContext, setSelectedContext] = useState('default');

  useEffect(() => {
    setTransport({ ...config.transport });
  }, [config.transport]);

  const testConnection = async () => {
    setIsTestingConnection(true);
    try {
      const response = await browser.runtime.sendMessage({
        action: RUNTIME_MESSAGES.socket_retry,
        config: {
          ...config,
          transport: {
            ...transport,
            contextId: selectedContext
          }
        }
      });

      if (response && response.status === 'success') {
        showSuccessMessage('Connection successful!');
        // Fetch available contexts after successful connection
        const contextsResponse = await browser.runtime.sendMessage({
          action: RUNTIME_MESSAGES.context_get
        });
        if (contextsResponse && contextsResponse.payload) {
          const contexts = Array.isArray(contextsResponse.payload) ?
            contextsResponse.payload : ['default'];
          setAvailableContexts(contexts);
        }
      } else {
        showErrorMessage('Connection failed. Please check your settings.');
      }
    } catch (error) {
      showErrorMessage('Connection failed. Please check your settings.');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveConnectionSettings = async (e: any) => {
    if (closePopup) closePopup(e);
    setIsSavingConnection(true);
    try {
      const updatedTransport = {
        ...transport,
        contextId: selectedContext
      };

      dispatch(setConfig({ ...config, transport: updatedTransport }));
      await browser.runtime.sendMessage({
        action: RUNTIME_MESSAGES.config_set,
        value: { ...config, transport: updatedTransport }
      });

      setTimeout(() => {
        browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.socket_retry });
      }, 100);

      showSuccessMessage('Settings saved successfully!');
    } catch (error) {
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

      <div className="input-container">
        <label className="form-label" htmlFor="connection-setting-context">Context ID</label>
        <div className="form-control">
          <select
            className="browser-default"
            value={selectedContext}
            onChange={(e) => setSelectedContext(e.target.value)}
          >
            {availableContexts.map((context) => (
              <option key={context} value={context}>
                {context}
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
