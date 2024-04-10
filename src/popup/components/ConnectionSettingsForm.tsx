import React, { useEffect, useState } from 'react';
import cx from 'classnames';
import styles from "./ConnectionSettingsForm.module.css";
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { setConfig } from '../redux/config/configActions';
import { Dispatch } from 'redux';

interface ConnectionSettingsFormTypes {
  closePopup?: React.MouseEventHandler<HTMLDivElement>;
  retrying: boolean;
}

const ConnectionSettingsForm: React.FC<ConnectionSettingsFormTypes> = ({ closePopup, retrying }) => {
  const config: IConfigProps = useSelector((state: any) => state.config);
  const dispatch = useDispatch<Dispatch<any>>();
  const [transport, setTransport] = useState({...config.transport});
  useEffect(() => {
    setTransport({...config.transport});
  }, [config.transport]);

  const saveConnectionSettings = (e: any, config: IConfigProps) => {
    if(closePopup) closePopup(e);
    dispatch(setConfig(config));
    chrome.runtime.sendMessage({ action: 'config:set:item', key: "transport", value: transport }, (response) => {
      chrome.runtime.sendMessage({ action: 'socket:retry' });
    });
  }

  return (
    <div className="connection-settings-form">
      <div className="input-container">
        <label className="form-label" htmlFor="connection-setting-protocol">Protocol</label>
        <div className="form-control" id="connection-setting-protocol">
          <select 
            className="browser-default" 
            defaultValue={transport.protocol} 
            onChange={(e) => setTransport({...transport, protocol: e.target.value as IProtocol})}
          >
            <option value="http">http</option>
            <option value="https">https</option>
          </select>
        </div>
      </div>

      <div className="input-container">
        <label className="form-label" htmlFor="connection-setting-host">Host</label>
        <div className="form-control">
          <input type="input" id="connection-setting-host" value={transport.host} onChange={(e) => setTransport({...transport, host: e.target.value })} />
        </div>
      </div>

      <div className="input-container">
        <label className="form-label" htmlFor="connection-setting-port">Port</label>
        <div className="form-control">
          <input
            type="input" id="connection-setting-port" value={transport.port}
            onChange={(e) => setTransport({
              ...transport,
              port: !e.target.value.length ? "" : (isNaN(Number(e.target.value)) ? transport.port : Number(e.target.value)) })} />
        </div>
      </div>

      <div className="input-container">
        <label className="form-label" htmlFor="connection-setting-token">Auth Token</label>
        <div className="form-control">
          <input type="input" id="connection-setting-token" value={transport.token} onChange={(e) => setTransport({...transport, token: e.target.value })} />
        </div>
      </div>

      <div className="input-container">
        <label className="form-label" htmlFor="connection-setting-pinToContext">Pin To Context</label>
        <div className="form-control">
          <input type="input" id="connection-setting-pinToContext" value={transport.pinToContext} onChange={(e) => setTransport({...transport, pinToContext: e.target.value })} />
        </div>
      </div>

      <div className="input-container popup-button-container" style={{ alignContent: "flex-end" }}>
        <button 
          className="btn blue waves-effect waves-light" 
          style={{ height: '3rem', width: '100%', padding: '5px', lineHeight: 'unset' }} 
          disabled={retrying} 
          onClick={(e) => saveConnectionSettings(e, { ...config, transport })}
        >Save and Connect</button>
      </div>
    </div>
  );
};

export default ConnectionSettingsForm;