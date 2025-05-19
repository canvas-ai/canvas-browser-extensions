import config from '@/general/config';
import io, { ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import { canvasFetchContext, canvasFetchTabsForContext } from './canvas';
import index from './TabIndex';
import { setContext, setContextUrl, updateContext } from './context';
import { sendRuntimeMessage } from './utils';
import { RUNTIME_MESSAGES, SOCKET_EVENTS } from '@/general/constants';
import browser from 'webextension-polyfill';

const extractUserEmail = (): string => {
  try {
    if (config.transport.token && !config.transport.isApiToken) {
      const tokenParts = config.transport.token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        return payload.email || '';
      }
    }
  } catch (e) {
    console.warn('Failed to parse token for email:', e);
  }
  return '';
};

const getContextId = (contextName: string = 'default') => {
  const userEmail = extractUserEmail();
  return userEmail ? `${userEmail}/${contextName}` : contextName;
};

const getSocketOptions = (): Partial<ManagerOptions & SocketOptions> => {
  return {
    withCredentials: true,
    upgrade: false,
    secure: false,
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
    auth: {
      token: config.transport.token,
      isApiToken: config.transport.isApiToken || false
    }
  };
};

class MySocket {
  socket: Socket | null;
  private isInitializing: boolean = false;

  constructor() {
    this.socket = null;
    this.initializeSocket(false);
  }

  connect() {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.socket = io(this.connectionUri(), getSocketOptions());
    return this.socket;
  }

  connectionUri() {
    return `${config.transport.protocol}://${config.transport.host}:${config.transport.port}`;
  }

  reconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.connect();
  }

  initializeSocket(reconn = true) {
    if (this.isInitializing) {
      console.log('background.js | [socket.io] Socket initialization already in progress');
      return;
    }

    this.isInitializing = true;
    console.log('background.js | [socket.io] Initializing socket connection');

    if (reconn) {
      this.reconnect();
    } else {
      this.connect();
    }

    if (!this.socket) {
      console.error('background.js | [socket.io] Failed to initialize socket');
      this.isInitializing = false;
      return;
    }

    this.socket.on('connect', () => {
      console.log('background.js | [socket.io] Browser Client connected to Canvas');
      console.log('background.js | [socket.io] Using token:', config.transport.token);

      this.sendSocketEvent(SOCKET_EVENTS.connect);
      this.isInitializing = false;

      // After successful connection, fetch the current context
      canvasFetchContext().then((ctx: IContext) => {
        console.log('background.js | [socket.io] Received context: ', ctx);
        updateContext(ctx);
      }).catch(error => {
        console.error('background.js | [socket.io] Error fetching context:', error);
        sendRuntimeMessage({
          type: RUNTIME_MESSAGES.error_message,
          payload: 'Error fetching context from Canvas'
        });
      });

      updateLocalCanvasTabsData();
    });

    this.socket.on('connect_error', (error) => {
      this.sendSocketEvent(SOCKET_EVENTS.connect_error);
      console.log(`background.js | [socket.io] Browser Connection to "${this.connectionUri()}" failed`);
      console.log("ERROR: " + error.message);
      this.isInitializing = false;
    });

    this.socket.on('connect_timeout', () => {
      this.sendSocketEvent(SOCKET_EVENTS.connect_timeout);
      console.log('background.js | [socket.io] Canvas Connection Timeout');
      this.isInitializing = false;
    });

    this.socket.on('disconnect', () => {
      this.sendSocketEvent(SOCKET_EVENTS.disconnect);
      console.log('background.js | [socket.io] Browser Client disconnected from Canvas');
      this.isInitializing = false;
    });

    // Context-related events
    this.socket.on('context:update', setContext);
    this.socket.on('context:url:set', (payload) => {
      console.log('background.js | [socket.io] Received context:url:set event:', payload);
      setContextUrl({ payload: payload.url });
    });
    this.socket.on('context:list', (payload) => {
      console.log('background.js | [socket.io] Received context list:', payload);
      sendRuntimeMessage({
        type: RUNTIME_MESSAGES.context_list,
        payload
      });
    });
  }

  sendSocketEvent(e: string) {
    sendRuntimeMessage({ type: RUNTIME_MESSAGES.socket_event, payload: { event: e } });
  }

  emit(endpoint: string, ...args: any[]) {
    if (!this.socket || !this.socket.connected) {
      console.error('background.js | [socket.io] Cannot emit event, socket not connected');
      return Promise.reject(new Error('Socket not connected'));
    }
    return new Promise((resolve, reject) => {
      this.socket!.emit(endpoint, ...args, (response: any) => {
        if (response && response.status === 'error') {
          reject(new Error(response.message || 'Socket operation failed'));
        } else {
          resolve(response);
        }
      });
    });
  }

  isConnected() {
    return this.socket !== null && this.socket.connected;
  }
}

let socket: MySocket;

export const getSocket = async () => {
  await config.load();
  if (socket) {
    // Update socket options with latest config
    if (socket.socket) {
      socket.socket.auth = {
        token: config.transport.token,
        isApiToken: config.transport.isApiToken || false
      };
    }
    return socket;
  }
  socket = new MySocket();
  return socket;
}

export const updateLocalCanvasTabsData = () => {
  canvasFetchTabsForContext().then((res: any) => {
    if (!res || res.status !== 'success') {
      sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error fetching tabs from Canvas'});
      return console.log('ERROR: background.js | Error fetching tabs from Canvas');
    }
    index.insertCanvasTabArray(res.data);
  }).then(() => {
    index.updateBrowserTabs();
  });
}

// Handle context switching
browser.runtime.onMessage.addListener((message: { action: string; value: string }, sender, sendResponse) => {
  if (message.action === RUNTIME_MESSAGES.context_set_url) {
    const contextId = getContextId(message.value);
    if (socket && socket.isConnected()) {
      return new Promise((resolve) => {
        socket.emit('context:set', contextId, (response: any) => {
          if (response && response.status === 'success') {
            // Update the context in the config
            config.set('transport', {
              ...config.transport,
              pinToContext: message.value
            });

            // Fetch the new context
            canvasFetchContext().then((ctx: IContext) => {
              console.log('background.js | [socket.io] Switched to context: ', ctx);
              updateContext(ctx);
              resolve({ status: 'success' });
            }).catch(error => {
              console.error('background.js | [socket.io] Error switching context:', error);
              resolve({ status: 'error', message: error.message });
            });
          } else {
            resolve({ status: 'error', message: response?.message || 'Failed to switch context' });
          }
        });
      });
    } else {
      return Promise.resolve({ status: 'error', message: 'Socket not connected' });
    }
  }
  return Promise.resolve();
});

export default MySocket;
