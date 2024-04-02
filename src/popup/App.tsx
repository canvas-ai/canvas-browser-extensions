import React, { useEffect, useState } from 'react';
import cx from 'classnames';
import "./App.css";
import Header from './components/Header';
import Footer from './components/Footer';
import ConnectedState from './components/ConnectedState';
import DisconnectedState from './components/DisconnectedState';
import { fetchVariable, updateTabs } from './utils';
import ConnectionPopup from './components/ConnectionPopup';
import store from './redux/store';
import { useSelector } from 'react-redux';
import { loadInitialConfigState } from './redux/config/configActions';
import { useDispatch } from 'react-redux';
import { setBrowserTabs, setCanvasTabs } from './redux/tabs/tabActions';
import { Dispatch } from 'redux';

const App: React.FC = () => {
  const config = useSelector((state: any) => state.config);
  const tabs = useSelector((state: any) => state.tabs);
  const dispatch = useDispatch<Dispatch<any>>();

  const [connected, setConnected] = useState<boolean>(false);
  const [retrying, setRetrying] = useState(false);
  const [context, setContext] = useState<any>({});
  const [popupOpen, setPopupOpen] = useState<boolean>(false);

  useEffect(() => {
    store.dispatch(loadInitialConfigState());
    // TODO: Rework to use a single request to background.js for initial variables
    Promise.all([
      fetchVariable({ action: 'socket:status' }),
      fetchVariable({ action: 'context:get' })
    ]).then((values) => {
      // TODO: Handle errors
      setConnected(values[0]);
      if(values[0]) updateTabs(dispatch);
      setContext(values[1]);
    }).catch(error => {
      console.error("Error loading variables:", error);
    });

    const messageListener = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      console.log('UI | Message received: ', message);
      if (message.type === 'context:url') {
        const url = message.data;
        console.log(`UI | Got context URL: "${url}"`)
        setContext((ctx: any) => ({ ...ctx, url }));
      }

      if(message === "tabs:updated") {
        setTimeout(() => {
          updateTabs(dispatch);
        }, 1000);
      }

      if (message.type === 'socket-event') {
        const sockevent = message.data.event;
        console.log(`UI | Got a new socket event: "${sockevent}"`);
        switch (sockevent) {
          case "connecting":
            setConnected(false);
            setRetrying(true);
            break;
          case 'connect':
            setConnected(true);
            setRetrying(false);
            break;
          case 'disconnect':
            setConnected(false);
            setRetrying(false);
            break;
          case 'connect_error':
            setConnected(false); // maybe could show the last connection error
            setRetrying(false);
            break;
          case 'connect_timeout':
            setConnected(false); // maybe could show timeout error
            setRetrying(false);
            break;
          default:
            console.log(`ERROR: UI | Unknown socket event: "${sockevent}"`);
        }
      }
    }

    // const interval = setInterval(() => {
    //   fetchVariable({ action: 'socket:status' }).then(sockStatus => {
    //     console.log(JSON.stringify({ sockStatus }));
    //     setConnected(sockStatus);  
    //   });
    // }, 1000);

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      // clearInterval(interval)
    }
  }, [context?.url]);

  const canvasConnected = () => {
    // fetchVariable({ action: 'config:get' }).then((config: IConfig) => {
    //   setConfig(config);
    // });
    updateTabs(dispatch);
  }

  const canvasDisconnected = () => {

  }

  useEffect(() => {
    if (connected) {
      canvasConnected();
    } else {
      canvasDisconnected();
    }
  }, [connected]);

  useEffect(() => {
    console.log(connected, context, tabs);
  }, [connected, context, tabs]);

  const setConnectionDetailsClicked: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    // fetchVariable({ action: 'config:get' }).then((config: IConfig) => {
    //   setConfig(config);
    // });
    setPopupOpen(true);
  }

  const closePopup = () => {
    setPopupOpen(false);
  }

  return (
    <>
      {connected && config ? <Header url={context?.url} /> : null}
      <main>
        {
          connected && config ?
            <ConnectedState 
              retrying={retrying}
            /> :
            <DisconnectedState
              retrying={retrying}
              setRetrying={setRetrying}
              setConnectionDetailsClicked={setConnectionDetailsClicked}
              connectionHost={`${config?.transport.protocol}://${config?.transport.host}:${config?.transport.port}`}
            />
        }
      </main>
      {connected ? <Footer /> : null}

      {config ? <ConnectionPopup open={popupOpen} closePopup={closePopup} retrying={retrying} /> : null}
    </>
  );
};

export default App;
