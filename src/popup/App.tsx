import React, { useEffect, useState, useCallback } from 'react';
import "./App.css";
import Header from './components/Header';
import Footer from './components/Footer';
import ConnectedState from './components/ConnectedState';
import DisconnectedState from './components/DisconnectedState';
import { requestUpdateSessionsList, requestUpdateTabs, requestVariableUpdate } from './utils';
import ConnectionPopup from './components/ConnectionPopup';
import store from './redux/store';
import { useSelector } from 'react-redux';
import { loadInitialConfigState } from './redux/config/configActions';
import { useDispatch } from 'react-redux';
import { Dispatch } from 'redux';
import { RUNTIME_MESSAGES } from '@/general/constants';
import { messageListener } from './listener';
import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import { loadInitialPinnedTabsState } from './redux/variables/varActions';
import { browser } from '@/general/utils';

const App: React.FC = () => {
  const config = useSelector((state: { config: IConfigProps }) => state.config);
  const tabs = useSelector((state: { tabs: ITabsInfo }) => state.tabs);
  const variables = useSelector((state: { variables: IVarState }) => state.variables);
  const dispatch = useDispatch<Dispatch<any>>();

  const [popupOpen, setPopupOpen] = useState<boolean>(false);
  const [initialLoadDone, setInitialLoadDone] = useState<boolean>(false);

  // Create a stable message listener reference
  const stableMessageListener = useCallback(
    messageListener(dispatch, variables),
    [dispatch, variables] // Only recreate if dispatch or variables changes
  );

  // Initial setup - only run once
  useEffect(() => {
    console.log("App: Initial setup - loading config and requesting updates");
    store.dispatch(loadInitialConfigState());
    store.dispatch(loadInitialPinnedTabsState());

    // Request initial state
    requestVariableUpdate({ action: RUNTIME_MESSAGES.config_get });
    requestVariableUpdate({ action: RUNTIME_MESSAGES.socket_status });
    requestVariableUpdate({ action: RUNTIME_MESSAGES.context_get });

    setInitialLoadDone(true);

    // Set up message listener
    browser.runtime.onMessage.addListener(stableMessageListener);

    // Cleanup on unmount
    return () => {
      browser.runtime.onMessage.removeListener(stableMessageListener);
    };
  }, [stableMessageListener]);

  // Handle connection state changes
  useEffect(() => {
    if (variables.connected && initialLoadDone) {
      console.log("App: Connected - requesting tabs and sessions");
      requestUpdateTabs();

      // Only request sessions list once when connected
      if (variables.connected) {
        requestUpdateSessionsList();
      }
    }
  }, [variables.connected, initialLoadDone]);

  // Log context changes to help with debugging
  useEffect(() => {
    if (initialLoadDone && variables.context?.url) {
      console.log("App: Context URL changed to:", variables.context.url);
    }
  }, [variables.context?.url, initialLoadDone]);

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
