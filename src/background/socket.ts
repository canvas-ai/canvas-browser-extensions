import { io, Socket, ManagerOptions, SocketOptions } from 'socket.io-client';
import config from "@/general/config";
import index from "./TabIndex";
import { sendRuntimeMessage, onContextTabsUpdated } from "./utils";
import { RUNTIME_MESSAGES, SOCKET_EVENTS } from "@/general/constants";
import { canvasFetchContext, requestFetchTabsForContext } from "./canvas";
import { browser } from "@/general/utils";

const extractUserEmail = (): string => {
  try {
    const manifest = chrome.runtime.getManifest();
    const oauth2 = manifest.oauth2;
    if (oauth2 && oauth2.scopes && oauth2.scopes.includes('email')) {
      // Return a placeholder or attempt to get actual user email if available
      return 'user@canvas.local';
    }
  } catch (error) {
    console.log('background.js | [socket.io] No user email available, using placeholder');
  }
  return 'user@canvas.local';
};

const getContextId = (contextName: string = 'default') => {
  return contextName;
};

const getSocketOptions = (): Partial<ManagerOptions & SocketOptions> => {
  return {
    withCredentials: true,
    upgrade: false,
    secure: false,
    transports: ['websocket'],
    reconnection: false,
    auth: {
      token: config.transport.token,
      isApiToken: config.transport.isApiToken || false
    },
    query: {
      userEmail: extractUserEmail()
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
  }

  connect() {
    if (!this.socket) {
      console.log('background.js | [socket.io] Creating new socket connection');
      this.socket = io(this.connectionUri(), getSocketOptions());
    } else if (!this.socket.connected) {
      console.log('background.js | [socket.io] Reconnecting existing socket');
      this.socket.connect();
    }
  }

  connectionUri() {
    return `${config.transport.protocol}://${config.transport.host}:${config.transport.port}`;
  }

  reconnect() {
    if (this.socket) {
      console.log('background.js | [socket.io] Disconnecting existing socket');
      this.socket.disconnect();
      this.socket = null;
    }
    console.log('background.js | [socket.io] Creating new socket for reconnection');
    this.socket = io(this.connectionUri(), getSocketOptions());
  }

  private startReconnectionTimer() {
    if (!this.shouldAutoReconnect) {
      console.log('background.js | [socket.io] Auto-reconnect disabled, skipping reconnection timer');
      return;
    }

    if (this.reconnectionTimer) {
      return; // Timer already active
    }

    console.log('background.js | [socket.io] Starting reconnection timer (5 seconds)');
    this.reconnectionTimer = setTimeout(() => {
      console.log('background.js | [socket.io] Reconnection timer fired, attempting to reconnect');
      this.clearReconnectionTimer();
      this.initializeSocket(true);
    }, 5000);
  }

  private clearReconnectionTimer() {
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
      console.log('background.js | [socket.io] Reconnection timer cleared');
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
    this.clearReconnectionTimer();
    this.reconnect();
  }

  public isAutoReconnectEnabled() {
    return this.shouldAutoReconnect;
  }

  public isReconnectionTimerActive() {
    return this.reconnectionTimer !== null;
  }

  public setAutoReconnectForSetup(enabled: boolean) {
    this.shouldAutoReconnect = enabled;
    if (!enabled) {
      this.clearReconnectionTimer();
    }
  }

  initializeSocket(reconn = true) {
    if (this.isInitializing) {
      console.log('background.js | [socket.io] Socket initialization already in progress');
      return;
    }

    this.clearReconnectionTimer();

    this.isInitializing = true;
    console.log('background.js | [socket.io] Initializing WebSocket connection to /websocket');

    // Create or reconnect socket
    if (reconn) {
      this.reconnect();
    } else {
      this.connect();
    }

    if (!this.socket) {
      console.error('background.js | [socket.io] Failed to create socket');
      this.isInitializing = false;
      this.startReconnectionTimer();
      return;
    }

    // Set up event listeners
    this.socket.on('connect', () => {
      console.log('background.js | [socket.io] Browser Client connected to Canvas WebSocket');
      console.log('background.js | [socket.io] Using token:', config.transport.token ? '[TOKEN SET]' : '[NO TOKEN]');

      this.clearReconnectionTimer();

      this.sendSocketEvent(SOCKET_EVENTS.connect);
      this.isInitializing = false;

      // After successful connection, fetch the current context via REST API
      canvasFetchContext().then((ctx: IContext) => {
        console.log('background.js | [socket.io] Received context via REST: ', ctx);
        // Update storage - this will trigger the storage listener in index.ts
        browser.storage.local.set({
          CNVS_CONTEXT: ctx,
          CNVS_SELECTED_CONTEXT: ctx
        });
      }).catch(error => {
        console.error('background.js | [socket.io] Error fetching context via REST:', error);
        sendRuntimeMessage({
          type: RUNTIME_MESSAGES.error_message,
          payload: 'Error fetching context from Canvas'
        });
      });

      updateLocalCanvasTabsData();
    });

    this.socket.on('authenticated', (data) => {
      console.log('background.js | [socket.io] Socket authenticated with user data:', data);
      this.sendSocketEvent(SOCKET_EVENTS.authenticated, data);

      // Fetch contexts after authentication
      console.log('background.js | [socket.io] Fetching contexts after authentication...');
      import('./canvas').then(({ canvasFetchContextList }) => {
        return canvasFetchContextList();
      }).then(contexts => {
        console.log('background.js | [socket.io] Contexts fetched after authentication:', contexts);
        browser.storage.local.set({ contexts });
        sendRuntimeMessage({ type: RUNTIME_MESSAGES.context_list, payload: contexts });
      }).catch(error => {
        console.error('background.js | [socket.io] Error fetching contexts after authentication:', error);
      });
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

    // Context-related events - update storage directly
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

    // Context list updates
    const contextListResult = (payload: IContext[]) => {
      console.log('background.js | [socket.io] Received context list:', payload);
      browser.storage.local.set({ contexts: payload });
    };

    this.socket.on('context:list', contextListResult);
    this.socket.on('context:list:result', contextListResult);

    // Workspace and Context Document Events
    this.socket.on('workspace:document:inserted', this.handleDocumentInsert.bind(this));
    this.socket.on('workspace:document:updated', this.handleDocumentUpdate.bind(this));
    this.socket.on('workspace:document:removed', this.handleDocumentRemove.bind(this));
    this.socket.on('workspace:document:deleted', this.handleDocumentDelete.bind(this));

    this.socket.on('context:document:inserted', this.handleDocumentInsert.bind(this));
    this.socket.on('context:document:updated', this.handleDocumentUpdate.bind(this));
    this.socket.on('context:document:removed', this.handleDocumentRemove.bind(this));
    this.socket.on('context:document:deleted', this.handleDocumentDelete.bind(this));

    // Backend event names (with dots) - THESE ARE THE ACTUAL EVENTS EMITTED
    this.socket.on('document.inserted', this.handleDocumentInsert.bind(this));
    this.socket.on('document.updated', this.handleDocumentUpdate.bind(this));
    this.socket.on('document.removed', this.handleDocumentRemove.bind(this));
    this.socket.on('document.deleted', this.handleDocumentDelete.bind(this));

    // Legacy document events (for backwards compatibility)
    this.socket.on('document:insert', this.handleDocumentInsert.bind(this));
    this.socket.on('document:update', this.handleDocumentUpdate.bind(this));
    this.socket.on('document:remove', this.handleDocumentRemove.bind(this));
    this.socket.on('document:delete', this.handleDocumentDelete.bind(this));
    this.socket.on('documents:delete', this.handleDocumentsDelete.bind(this));
  }

  private async handleDocumentInsert(payload: any) {
    console.log('background.js | [socket.io] 🎉 DOCUMENT INSERT EVENT RECEIVED:', JSON.stringify(payload, null, 2));

    // Check if this is for our current context
    const currentContext = await browser.storage.local.get(['CNVS_SELECTED_CONTEXT']);
    const context = currentContext.CNVS_SELECTED_CONTEXT;

    if (!context) {
      console.log('background.js | No current context available, ignoring document insert event');
      return;
    }

    // Enhanced context ID checking - handle different formats
    const payloadContextId = payload.contextId;
    const currentContextId = context.id;

    // Extract the UUID part from context IDs that may have format like "contextId/contextId"
    const normalizeContextId = (id: string) => {
      if (!id) return '';
      return id.includes('/') ? id.split('/').pop() : id;
    };

    const normalizedPayloadContextId = normalizeContextId(payloadContextId);
    const normalizedCurrentContextId = normalizeContextId(currentContextId);

    if (normalizedPayloadContextId !== normalizedCurrentContextId) {
      console.log(`background.js | Document insert event not for current context - payload: ${payloadContextId} (normalized: ${normalizedPayloadContextId}), current: ${currentContextId} (normalized: ${normalizedCurrentContextId})`);
      return;
    }

    console.log(`background.js | Document insert event matches current context: ${normalizedCurrentContextId}`);

    // Fetch updated documents from REST API instead of using socket data
    console.log('background.js | [socket.io] Fetching updated tabs data via REST API due to document insert');
    updateLocalCanvasTabsData();

    // Force immediate UI update
    await index.updateBrowserTabs();

    // Notify UI of the change
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.success_message,
      payload: 'Document(s) added to context'
    });
  }

  private async handleDocumentUpdate(payload: any) {
    console.log('background.js | [socket.io] Document updated:', payload);

    // Check if this is for our current context
    const currentContext = await browser.storage.local.get(['CNVS_SELECTED_CONTEXT']);
    const context = currentContext.CNVS_SELECTED_CONTEXT;

    if (!context) {
      console.log('background.js | No current context available, ignoring document update event');
      return;
    }

    // Enhanced context ID checking - handle different formats
    const normalizeContextId = (id: string) => {
      if (!id) return '';
      return id.includes('/') ? id.split('/').pop() : id;
    };

    if (normalizeContextId(payload.contextId) !== normalizeContextId(context.id)) {
      console.log(`background.js | Document update event not for current context - payload: ${payload.contextId}, current: ${context.id}`);
      return;
    }

    // Fetch updated documents from REST API
    console.log('background.js | [socket.io] Fetching updated tabs data via REST API due to document update');
    updateLocalCanvasTabsData();

    // Force immediate UI update
    await index.updateBrowserTabs();

    // Notify UI of the change
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.success_message,
      payload: 'Document(s) updated in context'
    });
  }

  private async handleDocumentRemove(payload: any) {
    console.log('background.js | [socket.io] Document removed:', payload);

    // Check if this is for our current context
    const currentContext = await browser.storage.local.get(['CNVS_SELECTED_CONTEXT']);
    const context = currentContext.CNVS_SELECTED_CONTEXT;

    if (!context) {
      console.log('background.js | No current context available, ignoring document remove event');
      return;
    }

    // Enhanced context ID checking - handle different formats
    const normalizeContextId = (id: string) => {
      if (!id) return '';
      return id.includes('/') ? id.split('/').pop() : id;
    };

    if (normalizeContextId(payload.contextId) !== normalizeContextId(context.id)) {
      console.log(`background.js | Document remove event not for current context - payload: ${payload.contextId}, current: ${context.id}`);
      return;
    }

    // Fetch updated documents from REST API
    console.log('background.js | [socket.io] Fetching updated tabs data via REST API due to document remove');
    updateLocalCanvasTabsData();

    // Force immediate UI update
    await index.updateBrowserTabs();

    // Notify UI of the change
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.success_message,
      payload: 'Document(s) removed from context'
    });
  }

  private async handleDocumentDelete(payload: any) {
    console.log('background.js | [socket.io] Document deleted:', payload);

    // Check if this is for our current context
    const currentContext = await browser.storage.local.get(['CNVS_SELECTED_CONTEXT']);
    const context = currentContext.CNVS_SELECTED_CONTEXT;

    if (!context) {
      console.log('background.js | No current context available, ignoring document delete event');
      return;
    }

    // Enhanced context ID checking - handle different formats
    const normalizeContextId = (id: string) => {
      if (!id) return '';
      return id.includes('/') ? id.split('/').pop() : id;
    };

    if (normalizeContextId(payload.contextId) !== normalizeContextId(context.id)) {
      console.log(`background.js | Document delete event not for current context - payload: ${payload.contextId}, current: ${context.id}`);
      return;
    }

    // Fetch updated documents from REST API
    console.log('background.js | [socket.io] Fetching updated tabs data via REST API due to document delete');
    updateLocalCanvasTabsData();

    // Force immediate UI update
    await index.updateBrowserTabs();

    // Notify UI of the change
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.success_message,
      payload: 'Document(s) permanently deleted'
    });
  }

  private async handleDocumentsDelete(payload: any) {
    // This is the same as handleDocumentDelete but for the plural event
    console.log('background.js | [socket.io] Documents deleted:', payload);

    // Check if this is for our current context
    const currentContext = await browser.storage.local.get(['CNVS_SELECTED_CONTEXT']);
    const context = currentContext.CNVS_SELECTED_CONTEXT;

    if (!context) {
      console.log('background.js | No current context available, ignoring documents delete event');
      return;
    }

    // Enhanced context ID checking - handle different formats
    const normalizeContextId = (id: string) => {
      if (!id) return '';
      return id.includes('/') ? id.split('/').pop() : id;
    };

    if (normalizeContextId(payload.contextId) !== normalizeContextId(context.id)) {
      console.log(`background.js | Documents delete event not for current context - payload: ${payload.contextId}, current: ${context.id}`);
      return;
    }

    // Fetch updated documents from REST API
    console.log('background.js | [socket.io] Fetching updated tabs data via REST API due to documents delete');
    updateLocalCanvasTabsData();

    // Force immediate UI update
    await index.updateBrowserTabs();

    // Notify UI of the change
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.success_message,
      payload: `Multiple documents permanently deleted`
    });
  }

  sendSocketEvent(e: string, data?: any) {
    sendRuntimeMessage({ type: RUNTIME_MESSAGES.socket_event, payload: { event: e, data } });
  }

  emit(endpoint: string, ...args: any[]) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit(endpoint, ...args, (response: any) => {
        resolve(response);
      });
    });
  }

  on(event: string, callback: (res: any) => void) {
    this.socket?.on(event, callback);
  }

  removeAllListeners(event: string) {
    this.socket?.removeAllListeners(event);
  }

  isConnected() {
    return this.socket?.connected || false;
  }

  // Note: Removed requestContextList, requestContextDocuments, requestContextGet
  // These should now use REST API calls from canvas.ts
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
};

export const updateLocalCanvasTabsData = () => {
  // Use REST API to fetch current tabs for context
  requestFetchTabsForContext().then(tabs => {
    console.log(`background.js | [socket.io] Updated local canvas tabs data: ${tabs.length} tabs`);

    // Use silent method first to update storage
    index.insertCanvasTabArraySilent(tabs, true);

    // Then update browser tabs to recalculate sync status and notify UI
    index.updateBrowserTabs();
  }).catch(error => {
    console.error('background.js | [socket.io] Error updating local canvas tabs data:', error);
  });
};

// REST API wrapper functions (these now use canvas.ts REST API functions)
export const fetchContextList = async (): Promise<IContext[]> => {
  const { canvasFetchContextList } = await import('./canvas');
  return canvasFetchContextList();
};

export const fetchContextDocuments = async (contextId: string, featureArray: string[] = [], filterArray: any[] = [], options: any = {}): Promise<any> => {
  const { canvasFetchContextDocuments } = await import('./canvas');
  return canvasFetchContextDocuments(contextId, featureArray, filterArray, options);
};

export const fetchContext = async (contextId: string): Promise<IContext> => {
  const { canvasFetchContext } = await import('./canvas');
  return canvasFetchContext();
};

export const enableAutoReconnect = async () => {
  const socket = await getSocket();
  socket.enableAutoReconnect();
};

export const disableAutoReconnect = async () => {
  const socket = await getSocket();
  socket.disableAutoReconnect();
};

export const forceReconnect = async () => {
  const socket = await getSocket();
  socket.forceReconnect();
};

export const isAutoReconnectEnabled = async (): Promise<boolean> => {
  const socket = await getSocket();
  return socket.isAutoReconnectEnabled();
};

export const isReconnectionTimerActive = async (): Promise<boolean> => {
  const socket = await getSocket();
  return socket.isReconnectionTimerActive();
};

export const setAutoReconnectForSetup = async (enabled: boolean) => {
  const socket = await getSocket();
  socket.setAutoReconnectForSetup(enabled);
};
