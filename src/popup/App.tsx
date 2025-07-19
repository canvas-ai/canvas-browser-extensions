import React, { useEffect, useState } from 'react';
import "./App.css";
import Header from './components/Header';
import Footer from './components/Footer';
import ConnectedState from './components/ConnectedState';
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

  useEffect(() => {
    // Initialize config in storage
    initializeConfigInStorage();
    requestVariableUpdate({ action: RUNTIME_MESSAGES.config_get });
  }, []);

  useEffect(() => {
    // Only request context info when URL changes, not socket status
    // Socket status should be managed by connection events, not URL changes
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

      // Fetch contexts and current context when connected
      requestVariableUpdate({ action: RUNTIME_MESSAGES.context_list });

      // If connected, also fetch tabs with tab feature filter
      if (context?.id) {
        fetchTabsForContext(context.id);
      }
    }
  }, [variables.connected, context?.id]);

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

  // Show loading state while config is loading
  if (!config) {
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
        <ConnectedState connected={variables.connected} />
      </main>
      {variables.connected ? <Footer /> : null}

      {config ? <ConnectionPopup open={popupOpen} closePopup={closePopup} /> : null}
      <Toaster />
    </>
  );
};

export default App;
