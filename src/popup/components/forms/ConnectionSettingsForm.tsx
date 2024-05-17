import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { setConfig } from '../../redux/config/configActions';
import { Dispatch } from 'redux';
import { browser } from '@/general/utils';
import SearchableSelectBox from '@/popup/common-components/inputs/SearchableSelectBox';
import { DEFAULT_SESSION, RUNTIME_MESSAGES } from '@/general/constants';
import { setSessionList } from '@/popup/redux/variables/varActions';
import { showErrorMessage } from '@/popup/utils';

interface ConnectionSettingsFormTypes {
  closePopup?: React.MouseEventHandler<HTMLDivElement>;
}

const ConnectionSettingsForm: React.FC<ConnectionSettingsFormTypes> = ({ closePopup }) => {
  const variables: IVarState = useSelector((state: { variables: IVarState }) => state.variables);
  const config: IConfigProps = useSelector((state: { config: IConfigProps }) => state.config);
  const dispatch = useDispatch<Dispatch<any>>();
  const [transport, setTransport] = useState({ ...config.transport });
  useEffect(() => {
    setTransport({ ...config.transport });
  }, [config.transport]);

  const sessions: ISession[] = variables.sessions.map(session => ({ id: session.id, baseUrl: session.baseUrl }));
  const [selectedSession, setSelectedSession] = useState(DEFAULT_SESSION.id);
  const [addableSession, setAddableSession] = useState({
    id: "",
    baseUrl: "/"
  });
  const [showAddSessionForm, setShowAddSessionForm] = useState(false);

  useEffect(() => {
    setSelectedSession(config.session.id || DEFAULT_SESSION.id);
  }, [config.session.id]);

  const sessionChanged = (option: any) => {
    setSelectedSession(option.value);
  }

  const onAddSessionClicked = (session: string) => {
    setShowAddSessionForm(true);
  }

  const saveConnectionSettings = (e: any, config: IConfigProps) => {
    if (closePopup) closePopup(e);
    dispatch(setConfig(config));
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.config_set, value: config }, (response) => {
      setTimeout(() => {
        browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.socket_retry });
      }, 100);
    });
  }

  const getSessionByID = (id: string) => {
    return sessions.find(s => s.id === id) || DEFAULT_SESSION;
  }

  const validateBaseUrl = (baseUrl: string) => {
    baseUrl = baseUrl
    .split("/")
    .filter((part, i, arr) => !(!i && part.length) && (!i || part.length || i === arr.length - 1))
    .map(part => part.replace(/[^a-z0-9_-]/gi, '')).join("/");
    return baseUrl.startsWith("/") ? baseUrl : "/" + baseUrl;
  }

  const saveSession = (addableSession: ISession) => {
    addableSession.baseUrl = '/' + addableSession.baseUrl.split("/").filter(part => part.length).map(part => part.toLowerCase()).join("/");
    if(!addableSession.id.length)
      return showErrorMessage("Session ID is required!");
    if(sessions.some(session => session.id.toLowerCase() === addableSession.id.toLowerCase()))
      return showErrorMessage("The session ID already exists!");

    dispatch(setSessionList([...sessions, addableSession]));
    setShowAddSessionForm(false);
    setSelectedSession(addableSession.id);
    setAddableSession({ baseUrl: "/", id: "" });
  }

  return (
    <>
      {showAddSessionForm ? (
        <div className="add-session-form">
          <div className="input-container">
            <label className="form-label" htmlFor="session-id">ID(example: home)</label>
            <div className="form-control">
              <input type="text" id="session-id" value={addableSession.id} onChange={(e) => setAddableSession({ ...addableSession, id: e.target.value })} />
            </div>
          </div>

          <div className="input-container">
            <label className="form-label" htmlFor="session-base-url">Base URL(example: /home)</label>
            <div className="form-control">
              <input
                type="text" 
                id="session-base-url"
                value={addableSession.baseUrl}
                onChange={(e) => setAddableSession({ ...addableSession, baseUrl: validateBaseUrl(e.target.value) })}
              />
            </div>
          </div>

          <div className="input-container popup-button-container" style={{ alignContent: "flex-start" }}>
            <button
              className="btn red waves-effect waves-light"
              style={{ height: '3rem', width: '100%', padding: '5px', lineHeight: 'unset' }}
              disabled={variables.retrying}
              onClick={(e) => setShowAddSessionForm(false)}
            >CANCEL</button>
          </div>

          <div className="input-container popup-button-container" style={{ alignContent: "flex-end" }}>
            <button
              className="btn blue waves-effect waves-light"
              style={{ height: '3rem', width: '100%', padding: '5px', lineHeight: 'unset' }}
              disabled={variables.retrying}
              onClick={() => saveSession(addableSession)}
            >ADD</button>
          </div>
        </div>
      ) : (
        <div className="connection-settings-form">
          <div className="input-container">
            <label className="form-label" htmlFor="connection-setting-protocol">Protocol</label>
            <div className="form-control" id="connection-setting-protocol">
              <select
                className="browser-default"
                defaultValue={transport.protocol}
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
              <input type="text" id="connection-setting-host" value={transport.host} onChange={(e) => setTransport({ ...transport, host: e.target.value })} />
            </div>
          </div>

          <div className="input-container">
            <label className="form-label" htmlFor="connection-setting-port">Port</label>
            <div className="form-control">
              <input
                type="text" id="connection-setting-port" value={transport.port}
                onChange={(e) => setTransport({
                  ...transport,
                  port: !e.target.value.length ? "" : (isNaN(Number(e.target.value)) ? transport.port : Number(e.target.value))
                })} />
            </div>
          </div>

          <div className="input-container">
            <label className="form-label" htmlFor="connection-setting-token">Auth Token</label>
            <div className="form-control">
              <input type="password" id="connection-setting-token" value={transport.token} onChange={(e) => setTransport({ ...transport, token: e.target.value })} />
            </div>
          </div>

          <div className="input-container">
            <label className="form-label" htmlFor="connection-setting-pinToContext">Pin Session To Context</label>
            <div className="form-control">
              <SearchableSelectBox
                options={sessions.map(session => ({ label: session.id, value: session.id, note: session.baseUrl }))}
                onChange={sessionChanged}
                addText={`Add new session`}
                defaultValue={selectedSession}
                onAdd={onAddSessionClicked}

                addable
                reversed
                alwaysShowAddOption
              />
            </div>
          </div>

          <div className="input-container popup-button-container" style={{ alignContent: "flex-end" }}>
            <button
              className="btn blue waves-effect waves-light"
              style={{ height: '3rem', width: '100%', padding: '5px', lineHeight: 'unset' }}
              disabled={variables.retrying}
              onClick={(e) => saveConnectionSettings(e, { ...config, transport, session: getSessionByID(selectedSession) })}
            >Save and Connect</button>
          </div>
        </div>
      )}
    </>

  );
};

export default ConnectionSettingsForm;