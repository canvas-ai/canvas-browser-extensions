import React, { useEffect, useState } from 'react';
import "./App.css";
import Header from './components/Header';
import Footer from './components/Footer';
import ConnectedState from './components/ConnectedState';
import DisconnectedState from './components/DisconnectedState';
import SetupWindow from './components/SetupWindow';
import { requestUpdateSessionsList, requestUpdateTabs, requestUpdateUserInfo, requestVariableUpdate } from './utils';
import ConnectionPopup from './components/ConnectionPopup';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { Dispatch } from 'redux';
import { RUNTIME_MESSAGES } from '@/general/constants';
import { messageListener } from './listener';
import { Toaster } from '../components/ui/toaster';
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
  const [showSetup, setShowSetup] = useState<boolean>(false);
  const [setupCheckComplete, setSetupCheckComplete] = useState<boolean>(false);
  const [justCompletedSetup, setJustCompletedSetup] = useState<boolean>(false);

  useEffect(() => {
    // Initialize config in storage
    initializeConfigInStorage();
    requestVariableUpdate({ action: RUNTIME_MESSAGES.config_get });
  }, []);

  // Check if setup is needed
  useEffect(() => {
    const checkSetupNeeded = async () => {
      if (!config) {
        setSetupCheckComplete(false);
        return;
      }

      // Don't immediately re-check setup if user just completed it
      if (justCompletedSetup) {
        return;
      }

      // Check if essential config is missing or using default values
      const hasTransportConfig = config.transport &&
                                config.transport.host &&
                                config.transport.token;

      // Check if token is empty or just whitespace
      const isEmptyToken = !config.transport?.token || config.transport.token.trim() === '';

      if (!hasTransportConfig || isEmptyToken) {
        setShowSetup(true);
        setSetupCheckComplete(true);
        return;
      }

      // If we have proper config, don't show setup - let the normal connection flow handle it
      setShowSetup(false);
      setSetupCheckComplete(true);

      // Still check connection status for normal flow
      requestVariableUpdate({ action: RUNTIME_MESSAGES.socket_status });
    };

    checkSetupNeeded();
  }, [config, justCompletedSetup]);

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
    if (variables.connected && !showSetup) {
      requestUpdateUserInfo();
      requestUpdateTabs();
      requestUpdateSessionsList();

      // Fetch contexts and current context when connected
      requestVariableUpdate({ action: RUNTIME_MESSAGES.context_list });

      // If connected, also fetch tabs with tab feature filter
      if (context?.id) {
        fetchTabsForContext(context.id);
      }
    }
  }, [variables.connected, showSetup, context?.id]);

  const fetchTabsForContext = async (contextId: string) => {
    try {
      // Use websocket to fetch documents with tab feature filter
      await browser.runtime.sendMessage({
        action: 'context:documents:list',
        payload: {
          contextId,
          featureArray: ['data/abstraction/tab'],
          filterArray: [],
          options: {}
        }
      });
    } catch (error) {
      console.error('Failed to fetch tabs for context:', error);
    }
  };

  const setConnectionDetailsClicked: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    setPopupOpen(true);
  }

  const closePopup = () => {
    setPopupOpen(false);
  }

  const handleSetupComplete = () => {
    setShowSetup(false);
    // Refresh the connection status
    requestVariableUpdate({ action: RUNTIME_MESSAGES.socket_status });
    setJustCompletedSetup(true);

    // Reset the flag after 5 seconds to allow normal setup checking
    setTimeout(() => {
      setJustCompletedSetup(false);
    }, 5000);
  };

  // Show setup window if needed and check is complete
  if (setupCheckComplete && showSetup) {
    return (
      <>
        <SetupWindow onSetupComplete={handleSetupComplete} />
        <Toaster />
      </>
    );
  }

  // Show loading state while checking setup requirements
  if (!setupCheckComplete) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div>Loading...</div>
        <Toaster />
      </div>
    );
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
      <Toaster />
    </>
  );
};

export default App;
