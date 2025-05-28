import React, { useEffect, useState } from 'react';
import "./App.css";
import Header from './components/Header';
import Footer from './components/Footer';
import ConnectedState from './components/ConnectedState';
import DisconnectedState from './components/DisconnectedState';
import { requestUpdateSessionsList, requestUpdateTabs, requestUpdateUserInfo, requestVariableUpdate } from './utils';
import ConnectionPopup from './components/ConnectionPopup';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { Dispatch } from 'redux';
import { RUNTIME_MESSAGES } from '@/general/constants';
import { messageListener } from './listener';
import { ToastContainer } from "react-toastify";
import { browser } from '@/general/utils';
import { useContext, useConfig } from './hooks/useStorage';
import { initializeConfigInStorage } from './redux/config/configStorage';

const App: React.FC = () => {
  const variables = useSelector((state: { variables: IVarState }) => state.variables);
  const dispatch = useDispatch<Dispatch<any>>();
  
  // Use storage hooks
  const [context] = useContext();
  const [config] = useConfig();

  const [popupOpen, setPopupOpen] = useState<boolean>(false);

  useEffect(() => {
    // Initialize config in storage
    initializeConfigInStorage();
    requestVariableUpdate({ action: RUNTIME_MESSAGES.config_get });
  }, []);

  useEffect(() => {
    requestVariableUpdate({ action: RUNTIME_MESSAGES.socket_status });
    requestVariableUpdate({ action: RUNTIME_MESSAGES.context_get });
  }, [context?.url]);

  useEffect(() => {
    const listener = messageListener(dispatch, variables);
    browser.runtime.onMessage.addListener(listener);

    return () => {
      browser.runtime.onMessage.removeListener(listener);
    }
  }, [dispatch, variables]);

  useEffect(() => {
    if (variables.connected) {
      requestUpdateUserInfo();
      requestUpdateTabs();
      requestUpdateSessionsList();
    }
  }, [variables.connected]);

  const setConnectionDetailsClicked: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    setPopupOpen(true);
  }

  const closePopup = () => {
    setPopupOpen(false);
  }

  return (
    <>
      {variables.connected && config ? <Header /> : null}
      <main>
        {
          variables.connected && config ?
            <ConnectedState /> :
            <DisconnectedState
              setConnectionDetailsClicked={setConnectionDetailsClicked}
              connectionHost={`${config?.transport.protocol}://${config?.transport.host}:${config?.transport.port}`}
            />
        }
      </main>
      {variables.connected ? <Footer /> : null}

      {config ? <ConnectionPopup open={popupOpen} closePopup={closePopup} /> : null}
      <ToastContainer />
    </>
  );
};

export default App;
