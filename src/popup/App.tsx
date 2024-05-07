import React, { useEffect, useState } from 'react';
import "./App.css";
import Header from './components/Header';
import Footer from './components/Footer';
import ConnectedState from './components/ConnectedState';
import DisconnectedState from './components/DisconnectedState';
import { requestUpdateTabs, requestVariableUpdate } from './utils';
import ConnectionPopup from './components/ConnectionPopup';
import store from './redux/store';
import { useSelector } from 'react-redux';
import { loadInitialConfigState } from './redux/config/configActions';
import { useDispatch } from 'react-redux';
import { Dispatch } from 'redux';
import { RUNTIME_MESSAGES } from '@/general/constants';
import { messageListener } from './listener';
import { ToastContainer } from "react-toastify";
import { loadInitialPinnedTabsState } from './redux/variables/varActions';
import { browser } from '@/general/utils';

const App: React.FC = () => {
  const config = useSelector((state: { config: IConfigProps }) => state.config);
  const tabs = useSelector((state: { tabs: ITabsInfo }) => state.tabs);
  const variables = useSelector((state: { variables: IVarState }) => state.variables);
  const dispatch = useDispatch<Dispatch<any>>();

  const [popupOpen, setPopupOpen] = useState<boolean>(false);

  useEffect(() => {
    store.dispatch(loadInitialConfigState());
    store.dispatch(loadInitialPinnedTabsState());
    requestVariableUpdate({ action: RUNTIME_MESSAGES.config_get });
  }, []);

  useEffect(() => {
    console.log("context url is", JSON.stringify(variables.context?.url));
    requestVariableUpdate({ action: RUNTIME_MESSAGES.socket_status });
    requestVariableUpdate({ action: RUNTIME_MESSAGES.context_get });

    browser.runtime.onMessage.addListener(messageListener(dispatch, variables));

    return () => {
      browser.runtime.onMessage.removeListener(messageListener(dispatch, variables));
    }
  }, [variables.context.url]);

  useEffect(() => {
    console.log("variables.connected", variables.connected);
    if (variables.connected) {
      requestUpdateTabs();
    }
  }, [variables.connected]);

  useEffect(() => {
    console.log(variables.connected, variables.context, tabs);
  }, [variables.connected, variables.context, tabs]);

  const setConnectionDetailsClicked: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    setPopupOpen(true);
  }

  const closePopup = () => {
    setPopupOpen(false);
  }

  return (
    <>
      {variables.connected && config ? <Header url={variables.context?.url} /> : null}
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
