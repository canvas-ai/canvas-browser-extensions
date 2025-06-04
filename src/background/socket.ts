import config from '@/general/config';
import io, { ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import { canvasFetchContext, requestFetchTabsForContext } from './canvas';
import index from './TabIndex';
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
  private reconnectionTimer: NodeJS.Timeout | null = null;
  private shouldAutoReconnect: boolean = true;

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

  private startReconnectionTimer() {
    this.clearReconnectionTimer();

    if (!this.shouldAutoReconnect) {
      return;
    }

    console.log('background.js | [socket.io] Starting reconnection timer (5 seconds)');
    this.reconnectionTimer = setTimeout(() => {
      console.log('background.js | [socket.io] Attempting automatic reconnection...');
      this.initializeSocket(true);
    }, 5000);
  }

  private clearReconnectionTimer() {
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }
  }

  public enableAutoReconnect() {
    this.shouldAutoReconnect = true;
  }

  public disableAutoReconnect() {
    this.shouldAutoReconnect = false;
    this.clearReconnectionTimer();
  }

  public destroy() {
    this.disableAutoReconnect();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isInitializing = false;
  }

  public forceReconnect() {
    console.log('background.js | [socket.io] Force reconnection requested');
    this.clearReconnectionTimer();
    this.initializeSocket(true);
  }

  public isAutoReconnectEnabled() {
    return this.shouldAutoReconnect;
  }

  public isReconnectionTimerActive() {
    return this.reconnectionTimer !== null;
  }

  public setAutoReconnectForSetup(enabled: boolean) {
    // Temporarily disable/enable auto-reconnect for setup testing
    // This prevents connection error logging during setup
    this.shouldAutoReconnect = enabled;
  }

  initializeSocket(reconn = true) {
    if (this.isInitializing) {
      console.log('background.js | [socket.io] Socket initialization already in progress');
      return;
    }

    this.clearReconnectionTimer();

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
      this.startReconnectionTimer();
      return;
    }

    this.socket.on('connect', () => {
      console.log('background.js | [socket.io] Browser Client connected to Canvas');
      console.log('background.js | [socket.io] Using token:', config.transport.token);

      this.clearReconnectionTimer();

      this.sendSocketEvent(SOCKET_EVENTS.connect);
      this.isInitializing = false;

      // After successful connection, fetch the current context
      canvasFetchContext().then((ctx: IContext) => {
        console.log('background.js | [socket.io] Received context: ', ctx);
        // Update storage - this will trigger the storage listener in index.ts
        browser.storage.local.set({
          CNVS_CONTEXT: ctx,
          CNVS_SELECTED_CONTEXT: ctx
        });
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
      // Only log connection errors if we were previously connected or if auto-reconnect is enabled
      // This prevents spam during initial setup when server might not be running
      if (this.shouldAutoReconnect || this.socket?.connected) {
        console.log(`background.js | [socket.io] Browser Connection to "${this.connectionUri()}" failed`);
        console.log("ERROR: " + error.message);
      }
      this.isInitializing = false;

      this.startReconnectionTimer();
    });

    this.socket.on('connect_timeout', () => {
      this.sendSocketEvent(SOCKET_EVENTS.connect_timeout);
      // Only log timeout errors if we were actively trying to connect (not during setup)
      if (this.shouldAutoReconnect) {
        console.log('background.js | [socket.io] Canvas Connection Timeout');
      }
      this.isInitializing = false;

      this.startReconnectionTimer();
    });

    this.socket.on('disconnect', () => {
      this.sendSocketEvent(SOCKET_EVENTS.disconnect);
      console.log('background.js | [socket.io] Browser Client disconnected from Canvas');
      this.isInitializing = false;

      this.startReconnectionTimer();
    });

    this.socket.on("authenticated", (data: { userId: string, email: string }) => {
      this.sendSocketEvent(SOCKET_EVENTS.authenticated, data);
    });

    // Context-related events - now update storage directly
    this.socket.on('context:update', (ctx: { payload: IContext }) => {
      console.log('background.js | [socket.io] Received context update:', ctx);
      // Update storage - this will trigger the storage listener in index.ts
      browser.storage.local.set({
        CNVS_CONTEXT: ctx.payload,
        CNVS_SELECTED_CONTEXT: ctx.payload
      });
    });
    this.socket.on('context:url:set', (payload) => {
      console.log('background.js | [socket.io] Received context:url:set event:', payload);
      // Fetch current context and update its URL
      browser.storage.local.get(['CNVS_SELECTED_CONTEXT']).then((result) => {
        const currentContext = result.CNVS_SELECTED_CONTEXT;
        if (currentContext) {
          const updatedContext = { ...currentContext, url: payload.url };
          browser.storage.local.set({
            CNVS_CONTEXT: updatedContext,
            CNVS_SELECTED_CONTEXT: updatedContext
          });
        }
      });
    });

    const contextListResult = (payload: IContext[]) => {
      console.log('background.js | [socket.io] Received context list:', payload);
      browser.storage.local.set({ contexts: payload });
    };

    this.socket.on('context:list', contextListResult);
    this.socket.on('context:list:result', contextListResult);

    // Document event listeners
    this.socket.on('document:insert', this.handleDocumentInsert.bind(this));
    this.socket.on('document:update', this.handleDocumentUpdate.bind(this));
    this.socket.on('document:remove', this.handleDocumentRemove.bind(this));
    this.socket.on('document:delete', this.handleDocumentDelete.bind(this));
    this.socket.on('documents:delete', this.handleDocumentsDelete.bind(this));
  }

  private async handleDocumentInsert(payload: any) {
    console.log('background.js | [socket.io] Document inserted:', payload);

    // Check if this is for our current context
    const currentContext = await browser.storage.local.get(['CNVS_SELECTED_CONTEXT']);
    const context = currentContext.CNVS_SELECTED_CONTEXT;

    if (!context || (payload.contextId !== context.id.split("/")[1] && payload.contextId !== context.id)) {
      console.log('background.js | Document insert event not for current context, ignoring', payload.contextId, context.id);
      return;
    }

    // Check if featureArray includes "data/abstraction/tab" and context URL matches
    if (payload.featureArray && 
        payload.featureArray.includes("data/abstraction/tab") && 
        payload.url === context.url) {
      
      console.log('background.js | [socket.io] Tab document inserted for matching context, adding to canvas tabs');
      
      // Extract tab documents from the payload
      const documents = payload.documents || (payload.document ? [payload.document] : []);
      
      documents.forEach((doc: any, docIndex: number) => {
        if (doc && doc.schema === "data/abstraction/tab" && doc.data) {
          // Create a canvas tab object with the document ID
          const canvasTab: ICanvasTab = {
            ...doc.data,
            docId: payload.documentIds ? payload.documentIds[docIndex] : payload.documentId,
            url: doc.data.url,
            title: doc.data.title || doc.data.url
          };
          
          console.log('background.js | [socket.io] Adding tab to canvas tabs:', canvasTab);
          
          // Add to canvas tabs index (silent to avoid duplicate UI updates)
          index.insertCanvasTabSilent(canvasTab);
        }
      });
      
      // Update local tabs data to stay in sync
      console.log('background.js | [socket.io] Updating local canvas tabs data due to tab document insert');
      updateLocalCanvasTabsData();

      // Force immediate UI update
      await index.updateBrowserTabs();

      // Notify UI of the change
      sendRuntimeMessage({
        type: RUNTIME_MESSAGES.success_message,
        payload: `Tab(s) synced to canvas from context`
      });
      
      return; // Exit early since we handled the tab-specific logic
    }

    // For document inserts, we might want to open new tabs if they are URLs
    if (payload.documents || payload.document) {
      const documents = payload.documents || [payload.document];
      const tabUrls = documents
        .filter((doc: any) => {
          if (!doc || !doc.url) return false;
          try {
            new URL(doc.url);
            return true;
          } catch {
            return false;
          }
        })
        .map((doc: any) => doc.url);

      if (tabUrls.length > 0) {
        await config.load(); // Ensure config is loaded
        if (config.sync.autoOpenCanvasTabs) {
          console.log(`background.js | Opening ${tabUrls.length} new tabs for inserted documents`);
          // Import and use existing utilities
          const { getPinnedTabs } = await import('@/general/utils');
          const { browserOpenTabArray } = await import('./utils');

          const pinnedTabs = await getPinnedTabs();
          const urlsToOpen = tabUrls.filter((url: string) => !pinnedTabs.some(u => u === url));

          if (urlsToOpen.length > 0) {
            await browserOpenTabArray(urlsToOpen.map((url: string) => ({ url })));
          }
        }
      }
    }

    // Update local tabs data to stay in sync
    console.log('background.js | [socket.io] Updating local canvas tabs data due to document insert');
    updateLocalCanvasTabsData();

    // Force immediate UI update
    await index.updateBrowserTabs();

    // Notify UI of the change
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.success_message,
      payload: `${payload.documentIds?.length || payload.documentId ? 1 : 0} document(s) added to context`
    });
  }

  private async handleDocumentUpdate(payload: any) {
    console.log('background.js | [socket.io] Document updated:', payload);

    // Check if this is for our current context
    const currentContext = await browser.storage.local.get(['CNVS_SELECTED_CONTEXT']);
    const context = currentContext.CNVS_SELECTED_CONTEXT;

    if (!context || payload.contextId !== context.id) {
      console.log('background.js | Document update event not for current context, ignoring');
      return;
    }

    // Update local tabs data to stay in sync
    console.log('background.js | [socket.io] Updating local canvas tabs data due to document update');
    updateLocalCanvasTabsData();

    // Force immediate UI update
    await index.updateBrowserTabs();

    // Notify UI of the change
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.success_message,
      payload: `${payload.documentIds?.length || payload.documentId ? 1 : 0} document(s) updated in context`
    });
  }

  private async handleDocumentRemove(payload: any) {
    console.log('background.js | [socket.io] Document removed:', payload);

    // Check if this is for our current context
    const currentContext = await browser.storage.local.get(['CNVS_SELECTED_CONTEXT']);
    const context = currentContext.CNVS_SELECTED_CONTEXT;

    if (!context || payload.contextId !== context.id) {
      console.log('background.js | Document remove event not for current context, ignoring');
      return;
    }

    // For document removal, we might want to close corresponding tabs based on config
    await config.load(); // Ensure config is loaded
    if (config.sync.tabBehaviorOnContextChange === "Close Current and Open New" || config.sync.tabBehaviorOnContextChange === "Save and Close Current and Open New") {
      // For now, we'll just update the tabs data and let the existing sync logic handle it
      // TODO: Implement sophisticated document-to-tab matching if needed
      console.log('background.js | Document removed, updating local tabs data');
    }

    // Update local tabs data to stay in sync
    console.log('background.js | [socket.io] Updating local canvas tabs data due to document remove');
    updateLocalCanvasTabsData();

    // Force immediate UI update
    await index.updateBrowserTabs();

    // Notify UI of the change
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.success_message,
      payload: `${payload.documentIds?.length || payload.documentId ? 1 : 0} document(s) removed from context`
    });
  }

  private async handleDocumentDelete(payload: any) {
    console.log('background.js | [socket.io] Document deleted:', payload);

    // Check if this is for our current context
    const currentContext = await browser.storage.local.get(['CNVS_SELECTED_CONTEXT']);
    const context = currentContext.CNVS_SELECTED_CONTEXT;

    if (!context || payload.contextId !== context.id) {
      console.log('background.js | Document delete event not for current context, ignoring');
      return;
    }

    // Update local tabs data to stay in sync
    console.log('background.js | [socket.io] Updating local canvas tabs data due to document delete');
    updateLocalCanvasTabsData();

    // Force immediate UI update
    await index.updateBrowserTabs();

    // Notify UI of the change
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.success_message,
      payload: `${payload.documentIds?.length || payload.documentId ? 1 : 0} document(s) permanently deleted`
    });
  }

  private async handleDocumentsDelete(payload: any) {
    // This is the same as handleDocumentDelete but for the plural event
    console.log('background.js | [socket.io] Documents deleted:', payload);

    // Check if this is for our current context
    const currentContext = await browser.storage.local.get(['CNVS_SELECTED_CONTEXT']);
    const context = currentContext.CNVS_SELECTED_CONTEXT;

    if (!context || payload.contextId !== context.id) {
      console.log('background.js | Documents delete event not for current context, ignoring');
      return;
    }

    // Update local tabs data to stay in sync
    console.log('background.js | [socket.io] Updating local canvas tabs data due to documents delete');
    updateLocalCanvasTabsData();

    // Force immediate UI update
    await index.updateBrowserTabs();

    // Notify UI of the change
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.success_message,
      payload: `${payload.count || payload.documentIds?.length || 0} documents permanently deleted`
    });
  }

  sendSocketEvent(e: string, data?: any) {
    sendRuntimeMessage({ type: RUNTIME_MESSAGES.socket_event, payload: { event: e, data } });
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

  on(event: string, callback: (res: any) => void) {
    this.socket!.on(event, callback);
  }

  removeAllListeners(event: string) {
    this.socket!.removeAllListeners(event);
  }

  isConnected() {
    return this.socket !== null && this.socket.connected;
  }

  requestContextList(): Promise<IContext[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('context:list', (response: any) => {
        console.log('background.js | [socket.io] Received context:list response:', response);

        if (response && response.status === 'success') {
          resolve(response.payload);
        } else {
          reject(new Error(response?.message || 'Failed to fetch contexts'));
        }
      });
    });
  }

  requestContextDocuments(contextId: string, featureArray: string[] = [], filterArray: any[] = [], options: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('context:documents:list', {
        contextId,
        featureArray,
        filterArray,
        options
      }, (response: any) => {
        console.log('background.js | [socket.io] Received context:documents:list response:', response);

        if (response && response.status === 'success') {
          resolve(response.payload);
        } else {
          reject(new Error(response?.message || 'Failed to fetch documents'));
        }
      });
    });
  }

  requestContextGet(contextId: string): Promise<IContext> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('context:get', contextId, (response: any) => {
        console.log('background.js | [socket.io] Received context:get response:', response);

        if (response && response.status === 'success') {
          resolve(response.payload.context);
        } else {
          reject(new Error(response?.message || 'Failed to fetch context'));
        }
      });
    });
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
  console.log('background.js | Fetching latest canvas tabs from server...');
  requestFetchTabsForContext().then((tabs: chrome.tabs.Tab[]) => {
    if (!tabs) {
      sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error fetching tabs from Canvas'});
      return console.log('ERROR: background.js | Error fetching tabs from Canvas');
    }
    console.log(`background.js | Received ${tabs.length} canvas tabs from server`);
    // Get current tabs before updating to calculate the difference
    const currentTabs = index.getCanvasTabArray();
    // Use silent method to avoid duplicate UI updates
    index.insertCanvasTabArraySilent(tabs, true);

    // Notify UI about the changes
    const { onContextTabsUpdated } = require('./utils');
    if (tabs.length === 0 && currentTabs.length > 0) {
      // All tabs were removed
      onContextTabsUpdated({
        canvasTabs: { removedTabs: currentTabs }
      });
    } else if (tabs.length > 0) {
      // Tabs were added/updated - for simplicity, we'll just set all tabs
      // A more sophisticated approach would calculate insertedTabs and removedTabs
      onContextTabsUpdated({
        canvasTabs: { insertedTabs: tabs }
      });
    }
  }).then(() => {
    index.updateBrowserTabs();
  }).catch((error) => {
    console.error('background.js | Error updating local canvas tabs data:', error);
  });
}

export const fetchContextList = async (): Promise<IContext[]> => {
  const socket = await getSocket();
  return socket.requestContextList();
}

export const fetchContextDocuments = async (contextId: string, featureArray: string[] = [], filterArray: any[] = [], options: any = {}): Promise<any> => {
  const socket = await getSocket();
  return socket.requestContextDocuments(contextId, featureArray, filterArray, options);
}

export const fetchContext = async (contextId: string): Promise<IContext> => {
  const socket = await getSocket();
  return socket.requestContextGet(contextId);
}

export const enableAutoReconnect = async () => {
  const socket = await getSocket();
  socket.enableAutoReconnect();
}

export const disableAutoReconnect = async () => {
  const socket = await getSocket();
  socket.disableAutoReconnect();
}

export const forceReconnect = async () => {
  const socket = await getSocket();
  socket.forceReconnect();
}

export const isAutoReconnectEnabled = async (): Promise<boolean> => {
  const socket = await getSocket();
  return socket.isAutoReconnectEnabled();
}

export const isReconnectionTimerActive = async (): Promise<boolean> => {
  const socket = await getSocket();
  return socket.isReconnectionTimerActive();
}

export const setAutoReconnectForSetup = async (enabled: boolean) => {
  const socket = await getSocket();
  socket.setAutoReconnectForSetup(enabled);
}

// Handle context switching - now simplified to just update server and storage
browser.runtime.onMessage.addListener((message: { action: string; value: string }, sender, sendResponse) => {
  if (message.action === RUNTIME_MESSAGES.context_set_url) {
    const contextId = getContextId(message.value);
    console.log(`background.js | [socket.io] Switching to context: ${contextId}`);

    if (socket && socket.isConnected()) {
      return new Promise((resolve) => {
        socket.emit('context:set', contextId, (response: any) => {
          if (response && response.status === 'success') {
            console.log('background.js | [socket.io] Context set successfully on server');

            // Update the context in the config
            config.set('transport', {
              ...config.transport,
              pinToContext: message.value
            });

            // Fetch the new context and update storage - storage listener will handle the rest
            canvasFetchContext().then((ctx: IContext) => {
              console.log('background.js | [socket.io] Fetched new context: ', ctx);
              // Update storage - this will trigger the storage listener in index.ts
              browser.storage.local.set({
                CNVS_CONTEXT: ctx,
                CNVS_SELECTED_CONTEXT: ctx
              });
              resolve({ status: 'success' });
            }).catch(error => {
              console.error('background.js | [socket.io] Error fetching new context:', error);
              sendRuntimeMessage({
                type: RUNTIME_MESSAGES.error_message,
                payload: 'Error fetching new context data'
              });
              resolve({ status: 'error', message: error.message });
            });
          } else {
            console.error('background.js | [socket.io] Failed to set context on server:', response);
            sendRuntimeMessage({
              type: RUNTIME_MESSAGES.error_message,
              payload: response?.message || 'Failed to switch context on server'
            });
            resolve({ status: 'error', message: response?.message || 'Failed to switch context' });
          }
        });
      });
    } else {
      console.error('background.js | [socket.io] Cannot switch context: socket not connected');
      sendRuntimeMessage({
        type: RUNTIME_MESSAGES.error_message,
        payload: 'Cannot switch context: not connected to server'
      });
      return Promise.resolve({ status: 'error', message: 'Socket not connected' });
    }
  }
  return Promise.resolve();
});

export default MySocket;
