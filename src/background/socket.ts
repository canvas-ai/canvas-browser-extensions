import config from '@/general/config';
import io, { ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import { canvasFetchUserContexts, canvasFetchContext, canvasFetchTabsForContext } from './canvas';
import index from './TabIndex';
import { context, updateContext } from './context';
import { sendRuntimeMessage } from './utils';
import { RUNTIME_MESSAGES, SOCKET_EVENTS } from '@/general/constants';
import { IContext } from "@/types/IContext";

// Track connection attempts
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;
let lastConnectionTime = 0;
const CONNECTION_THROTTLE_MS = 5000; // 5 seconds between connection attempts

// Reset the connection attempt counter
export const resetConnectionAttempts = () => {
  console.log('background.js | Resetting connection attempts counter from', connectionAttempts, 'to 0');
  connectionAttempts = 0;
  lastConnectionTime = 0;
};

const getSocketOptions = (): Partial<ManagerOptions & SocketOptions> => {
  return {
    withCredentials: true,
    secure: config.transport.protocol === 'https',
    transports: ['websocket'],
    auth: {
      token: config.transport.token,
    },
    reconnectionAttempts: 3,
    reconnectionDelay: 5000,
  };
};

class MySocket {
  socket: Socket;
  private currentContextId: string | null = null;
  private currentWorkspaceId: string | null = null;

  // Keep track of recently sent events to prevent notification storms
  private lastSentEvents = new Map<string, number>();
  private EVENT_THROTTLE_MS = 1000; // Throttle notifications to once per second per event type
  private isReconnecting = false;

  constructor() {
    this.socket = io(this.connectionUri(), getSocketOptions());
    this.initializeSocketEventListeners();
    this.connect();
  }

  private connectionUri(): string {
    return `${config.transport.protocol}://${config.transport.host}:${config.transport.port}`;
  }

  connect() {
    // Check if too many connection attempts
    const now = Date.now();
    if (now - lastConnectionTime < CONNECTION_THROTTLE_MS) {
      console.warn(`background.js | [socket.io] Connection throttled. Last attempt was ${now - lastConnectionTime}ms ago.`);
      sendRuntimeMessage({
        type: RUNTIME_MESSAGES.error_message,
        payload: 'Connection throttled. Please wait a few seconds before retrying.'
      });
      return;
    }

    if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
      console.warn(`background.js | [socket.io] Too many connection attempts (${connectionAttempts}). Please wait before trying again.`);
      sendRuntimeMessage({
        type: RUNTIME_MESSAGES.error_message,
        payload: 'Too many connection attempts. Please wait a minute before trying again.'
      });

      // Auto-reset after some time
      setTimeout(() => {
        resetConnectionAttempts();
      }, 60000); // 1 minute

      return;
    }

    if (this.socket.connected) {
      console.log('background.js | [socket.io] Already connected.');
      return;
    }

    // Update attempt tracking
    connectionAttempts++;
    lastConnectionTime = now;

    this.socket.auth = getSocketOptions().auth || {};
    console.log(`background.js | [socket.io] Attempting to connect to Canvas at: ${this.connectionUri()} (attempt ${connectionAttempts})`);
    this.socket.connect();
  }

  reconnect() {
    if (this.isReconnecting) {
      console.log('background.js | [socket.io] Already attempting to reconnect. Ignoring duplicate request.');
      return;
    }

    this.isReconnecting = true;

    // Check if too many connection attempts
    const now = Date.now();
    if (now - lastConnectionTime < CONNECTION_THROTTLE_MS) {
      console.warn(`background.js | [socket.io] Reconnection throttled. Last attempt was ${now - lastConnectionTime}ms ago.`);
      sendRuntimeMessage({
        type: RUNTIME_MESSAGES.error_message,
        payload: 'Connection throttled. Please wait a few seconds before retrying.'
      });

      // Reset flag after delay
      setTimeout(() => {
        this.isReconnecting = false;
      }, CONNECTION_THROTTLE_MS);

      return;
    }

    if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
      console.warn(`background.js | [socket.io] Too many connection attempts (${connectionAttempts}). Please wait before trying again.`);
      sendRuntimeMessage({
        type: RUNTIME_MESSAGES.error_message,
        payload: 'Too many connection attempts. Please wait a minute before trying again or reload the extension.'
      });

      // Reset flag after delay
      setTimeout(() => {
        this.isReconnecting = false;
      }, 5000);

      return;
    }

    // Update attempt tracking
    connectionAttempts++;
    lastConnectionTime = now;

    if (this.socket) {
      // Get fresh auth options with latest token
      const freshOptions = getSocketOptions();
      const tokenPreview = config.transport.token
        ? `${config.transport.token.substring(0, 4)}...`
        : 'no token';

      console.log(`background.js | [socket.io] Attempting to reconnect with token ${tokenPreview}... (attempt ${connectionAttempts})`);

      // Update auth before reconnecting
      this.socket.auth = freshOptions.auth || {};

      this.socket.disconnect().connect();
    } else {
      console.log('background.js | [socket.io] Socket not initialized, creating new connection.');
      this.socket = io(this.connectionUri(), getSocketOptions());
      this.initializeSocketEventListeners();
      this.connect();
    }

    // Reset reconnecting flag after a short delay
    setTimeout(() => {
      this.isReconnecting = false;
    }, 2000);
  }

  private initializeSocketEventListeners() {
    this.socket.on(SOCKET_EVENTS.connect, async () => {
      console.log(`background.js | [socket.io] Connected to Canvas. Socket ID: ${this.socket.id}`);
      // Reset connection attempts on successful connection
      resetConnectionAttempts();
      this.sendSocketEvent(SOCKET_EVENTS.connect);
    });

    this.socket.on(SOCKET_EVENTS.AUTHENTICATED, async (data: { userId: string; email: string }) => {
      console.log('background.js | [socket.io] Authenticated successfully with Canvas:', data);
      console.log(`background.js | [socket.io] Using configured contextId: ${config.transport.contextId || 'none'}`);
      this.sendSocketEvent(SOCKET_EVENTS.AUTHENTICATED);

      try {
        console.log('background.js | [socket.io] Fetching user contexts...');
        const contexts: IContext[] = await canvasFetchUserContexts();
        console.log(`background.js | [socket.io] Received ${contexts.length} contexts:`,
                    contexts.map(c => `${c.id} (${c.url})`).join(', '));

        sendRuntimeMessage({
          type: RUNTIME_MESSAGES.user_contexts_list_updated,
          payload: contexts
        });

        if (contexts && contexts.length > 0) {
          // If we have a configured contextId, try to find it in the list
          const configuredContextId = config.transport.contextId;
          let initialActiveContext = contexts[0]; // Default to first

          if (configuredContextId) {
            const matchingContext = contexts.find(c => c.id === configuredContextId);
            if (matchingContext) {
              console.log(`background.js | [socket.io] Using configured context: ${configuredContextId}`);
              initialActiveContext = matchingContext;
            } else {
              console.warn(`background.js | [socket.io] Configured context ${configuredContextId} not found in available contexts`);
            }
          }

          console.log(`background.js | [socket.io] Setting active context: ${initialActiveContext.id} (${initialActiveContext.url})`);
          updateContext(initialActiveContext);

          if (initialActiveContext.workspaceId) {
            console.log(`background.js | [socket.io] Subscribing to workspace: ${initialActiveContext.workspaceId}`);
            this.subscribeToWorkspace(initialActiveContext.workspaceId);
          }
          if (initialActiveContext.id) {
            console.log(`background.js | [socket.io] Subscribing to context: ${initialActiveContext.id}`);
            this.subscribeToContext(initialActiveContext.id);
            updateLocalCanvasTabsData(initialActiveContext.id);
          }
        } else {
          updateContext(undefined);
          console.log('background.js | [socket.io] No contexts returned for user, using default/unknown.');
        }

      } catch (error) {
        console.error('background.js | [socket.io] Error during post-authentication setup (fetching contexts):', error);
        sendRuntimeMessage({
          type: RUNTIME_MESSAGES.error_message,
          payload: 'Error fetching initial data (user contexts) from Canvas after authentication'
        });
      }
    });

    this.socket.on(SOCKET_EVENTS.ERROR, (error: any) => {
      console.error('background.js | [socket.io] Received error from server:', error);

      // If we get a connection limit error, increase the wait time
      if (error && typeof error.message === 'string' &&
          error.message.toLowerCase().includes('too many connection attempts')) {
        // Force connection throttling
        lastConnectionTime = Date.now();
        connectionAttempts = MAX_CONNECTION_ATTEMPTS;

        // Show error to user
        sendRuntimeMessage({
          type: RUNTIME_MESSAGES.error_message,
          payload: 'Server connection limit reached. Please wait a minute before trying again.'
        });
      }

      this.sendSocketEvent(SOCKET_EVENTS.ERROR, {
        message: error?.message || 'Unknown server error',
        isTokenError: error && typeof error.message === 'string' && error.message.toLowerCase().includes('token')
      });
    });

    this.socket.on(SOCKET_EVENTS.connect_error, (error: Error) => {
      this.sendSocketEvent(SOCKET_EVENTS.connect_error, { message: error.message });
      console.error(`background.js | [socket.io] Connection to "${this.connectionUri()}" failed: ${error.message}`);
    });

    this.socket.on(SOCKET_EVENTS.connect_timeout, () => {
      this.sendSocketEvent(SOCKET_EVENTS.connect_timeout);
      console.warn('background.js | [socket.io] Canvas Connection Timeout');
    });

    this.socket.on(SOCKET_EVENTS.disconnect, (reason: Socket.DisconnectReason) => {
      this.sendSocketEvent(SOCKET_EVENTS.disconnect, { reason });
      console.warn(`background.js | [socket.io] Disconnected from Canvas. Reason: ${reason}`);
    });

    this.socket.on(SOCKET_EVENTS.SUBSCRIBED, (data: { topic: string; id?: string }) => {
      console.log(`background.js | [socket.io] Successfully subscribed to ${data.topic}${data.id ? ':' + data.id : ''}`);
      this.sendSocketEvent(SOCKET_EVENTS.SUBSCRIBED, data);
    });

    this.socket.on(SOCKET_EVENTS.UNSUBSCRIBED, (data: { topic: string; id?: string }) => {
      console.log(`background.js | [socket.io] Successfully unsubscribed from ${data.topic}${data.id ? ':' + data.id : ''}`);
      this.sendSocketEvent(SOCKET_EVENTS.UNSUBSCRIBED, data);
    });

    this.socket.on(SOCKET_EVENTS.CONTEXT_UPDATED, (payload: Partial<IContext> & { operation?: string; document?: any; documentArray?: any[] }) => {
      console.log('background.js | [socket.io] Received CONTEXT_UPDATED:', payload);
      if (payload && payload.id === this.currentContextId) {
        if (payload.url || payload.baseUrl || payload.workspaceId) {
            updateContext(payload as IContext);
        } else {
            console.log('background.js | [socket.io] CONTEXT_UPDATED with operation, re-fetching context for safety.');
            canvasFetchContext().then(ctx => updateContext(ctx));
        }

        if (payload.operation && typeof payload.operation === 'string' && payload.operation.startsWith('document')) {
            updateLocalCanvasTabsData(payload.id);
        }
      }
    });

    this.socket.on(SOCKET_EVENTS.WORKSPACE_UPDATED, (payload: { workspaceId: string; /* other properties */ }) => {
      console.log('background.js | [socket.io] Received WORKSPACE_UPDATED:', payload);
      if (payload && payload.workspaceId === this.currentWorkspaceId) {
        canvasFetchContext().then(ctx => updateContext(ctx));
      }
    });

    this.socket.on(SOCKET_EVENTS.WORKSPACE_TREE_UPDATED, (payload: { workspaceId: string; /* other properties */ }) => {
      console.log('background.js | [socket.io] Received WORKSPACE_TREE_UPDATED:', payload);
      if (payload && payload.workspaceId === this.currentWorkspaceId) {
        canvasFetchContext().then(ctx => updateContext(ctx));
      }
    });

    // Listen for context:url:changed and update context in UI
    this.socket.on(SOCKET_EVENTS.CONTEXT_URL_CHANGED, async (payload: { id: string, url: string }) => {
      console.log('[socket.io] Received CONTEXT_URL_CHANGED:', payload);

      try {
        // Skip if we don't have a payload with required properties
        if (!payload || !payload.id || !payload.url) {
          console.warn('[socket.io] Skipping invalid CONTEXT_URL_CHANGED event - missing required properties');
          return;
        }

        // Check if this is our current active context
        const isCurrentContext = payload.id === this.currentContextId;

        // Check if this is our configured context (even if not current)
        const isConfiguredContext = payload.id === config.transport.contextId;

        // If this context isn't relevant to us, skip processing
        if (!isCurrentContext && !isConfiguredContext) {
          console.log(`[socket.io] Ignoring CONTEXT_URL_CHANGED for non-relevant context ${payload.id}`);
          return;
        }

        // Check if the URL is actually different to avoid loops
        if (context && context.url === payload.url) {
          console.log(`[socket.io] Ignoring CONTEXT_URL_CHANGED - URL is the same: ${payload.url}`);
          return;
        }

        console.log(`[socket.io] Processing CONTEXT_URL_CHANGED for context ${payload.id}`);

        // Always fetch the full context object to get all properties
        try {
          const ctx = await this.getContext(payload.id);
          if (ctx) {
            console.log(`[socket.io] Updating context with new data:`, ctx);

            // Tag the update as server-initiated to prevent echo
            const updatedCtx = {
              ...ctx,
              // Add a flag to indicate this update came from server
              updatedAt: new Date().toISOString(),
              serverInitiated: true
            };

            updateContext(updatedCtx);

            // Force immediate UI update with explicit URL change notification
            setTimeout(() => {
              console.log('[socket.io] Sending follow-up URL update for reliability');
              sendRuntimeMessage({
                type: RUNTIME_MESSAGES.context_get_url,
                payload: ctx.url
              });
            }, 100);
          } else {
            console.warn('[socket.io] Could not fetch context after URL change event');

            // As a fallback, create a minimal context update with the new URL
            if (context && context.id === payload.id) {
              console.log('[socket.io] Using fallback: updating existing context with new URL');
              updateContext({
                ...context,
                url: payload.url,
                updatedAt: new Date().toISOString(),
                serverInitiated: true
              });
            }
          }
        } catch (fetchError) {
          console.error('[socket.io] Error fetching context after URL change:', fetchError);

          // Still update the URL as a fallback to ensure UI gets the change
          if (context && context.id === payload.id) {
            updateContext({
              ...context,
              url: payload.url,
              updatedAt: new Date().toISOString(),
              serverInitiated: true
            });
          }
        }
      } catch (err) {
        console.error('[socket.io] Error handling CONTEXT_URL_CHANGED event:', err);
      }
    });
  }

  subscribe(topic: string, id?: string) {
    const subscriptionId = id ? `${topic}:${id}` : topic;
    console.log(`background.js | [socket.io] Subscribing to ${subscriptionId}`);
    this.socket.emit(SOCKET_EVENTS.SUBSCRIBE, { topic, id });
    if (topic === 'context' && id) this.currentContextId = id;
    if (topic === 'workspace' && id) this.currentWorkspaceId = id;
  }

  unsubscribe(topic: string, id?: string) {
    const subscriptionId = id ? `${topic}:${id}` : topic;
    console.log(`background.js | [socket.io] Unsubscribing from ${subscriptionId}`);
    this.socket.emit(SOCKET_EVENTS.UNSUBSCRIBE, { topic, id });
    if (topic === 'context' && id === this.currentContextId) this.currentContextId = null;
    if (topic === 'workspace' && id === this.currentWorkspaceId) this.currentWorkspaceId = null;
  }

  async subscribeToCurrentContext() {
    const currentCtx: IContext = context;
    if (currentCtx && currentCtx.id && currentCtx.id !== 'unknown') {
      this.subscribeToContext(currentCtx.id);
    }
    if (currentCtx && currentCtx.workspaceId && currentCtx.workspaceId !== 'unknown') {
      this.subscribeToWorkspace(currentCtx.workspaceId);
    }
  }

  subscribeToWorkspace(workspaceId: string) {
    if (this.currentWorkspaceId && this.currentWorkspaceId !== workspaceId) {
      this.unsubscribe('workspace', this.currentWorkspaceId);
    }
    this.subscribe('workspace', workspaceId);
  }

  subscribeToContext(contextId: string) {
    if (this.currentContextId && this.currentContextId !== contextId) {
      this.unsubscribe('context', this.currentContextId);
    }
    this.subscribe('context', contextId);
  }

  sendSocketEvent(e: string, payload?: any) {
    // Skip non-critical socket events like 'ping', 'pong', etc.
    const nonCriticalEvents = ['ping', 'pong', 'subscribed', 'unsubscribed'];
    if (nonCriticalEvents.includes(e)) {
      console.log(`[socket.io] Skipping non-critical event notification: ${e}`);
      return;
    }

    // Implement throttling to prevent notification storms
    const now = Date.now();
    const lastSent = this.lastSentEvents.get(e) || 0;
    if (now - lastSent < this.EVENT_THROTTLE_MS) {
      console.log(`[socket.io] Throttling socket event notification: ${e} (sent ${now - lastSent}ms ago)`);
      return;
    }

    // Update the timestamp for this event type
    this.lastSentEvents.set(e, now);

    // Log what we're sending to help with debugging
    console.log(`[socket.io] Broadcasting socket event to UI: ${e}`);

    // Send the notification
    sendRuntimeMessage({
      type: RUNTIME_MESSAGES.socket_event,
      payload: {
        event: e,
        ...(payload || {}),
        timestamp: now
      }
    });
  }

  emit(event: string, ...args: any[]): Promise<any> {
    if (!this.socket.connected) {
      console.warn(`background.js | [socket.io] Socket not connected. Cannot emit event '${event}'.`);
      return Promise.reject(new Error("Socket not connected"));
    }
    return new Promise((resolve, reject) => {
        const ack = typeof args[args.length - 1] === 'function' ? args.pop() : null;

        this.socket.emit(event, ...args, (response: any) => {
            if (response && response.status === 'error') {
                console.error(`background.js | [socket.io] Error response for event '${event}':`, response);
                if (ack) ack(response);
                return reject(response);
            }
            if (ack) ack(response);
            resolve(response);
        });
    });
  }

  isConnected(): boolean {
    return this.socket.connected;
  }

  disconnect() {
    if (this.socket) {
      console.log('background.js | [socket.io] Disconnecting socket.');
      this.socket.disconnect();
    }
  }

  // --- Websocket-centric API helpers ---
  async listContexts(): Promise<IContext[]> {
    return this.emit('context:list')
      .then((response: any) => {
        if (response?.status === 'success' && Array.isArray(response?.payload)) {
          return response.payload;
        }
        console.error('background.js | [socket.io] Failed to list contexts:', response);
        return [];
      })
      .catch((err: any) => {
        console.error('background.js | [socket.io] Error listing contexts:', err);
        return [];
      });
  }

  async getContext(contextId: string): Promise<IContext> {
    return this.emitWithResponse('context:get', contextId);
  }

  async getContextUrl(contextId: string): Promise<string> {
    const res = await this.emitWithResponse('context:url:get', contextId);
    return res.url;
  }

  async setContextUrl(contextId: string, url: string): Promise<string> {
    const res = await this.emitWithResponse('context:url:set', { contextId, url });
    return res.url;
  }

  async listDocuments(contextId: string, featureArray: string[] = [], filterArray: string[] = [], options: object = {}): Promise<any[]> {
    const res = await this.emitWithResponse('context:documents:list', { contextId, featureArray, filterArray, options });
    return res;
  }

  async insertDocuments(contextId: string, documents: any[], featureArray = [], options = {}): Promise<any> {
    return this.emitWithResponse('context:documents:insert', { contextId, documents, featureArray, options });
  }

  async updateDocuments(contextId: string, documents: any[], featureArray = [], options = {}): Promise<any> {
    return this.emitWithResponse('context:documents:update', { contextId, documents, featureArray, options });
  }

  async removeDocuments(contextId: string, documentIdArray: string[]): Promise<any> {
    return this.emitWithResponse('context:documents:remove', { contextId, documentIdArray });
  }

  async deleteDocuments(contextId: string, documentIdArray: string[]): Promise<any> {
    return this.emitWithResponse('context:documents:delete', { contextId, documentIdArray });
  }

  // --- Single document websocket-centric API helpers ---
  async insertDocument(contextId: string, document: any, featureArray = [], options = {}): Promise<any> {
    return this.emitWithResponse('context:document:insert', { contextId, document, featureArray, options });
  }

  async updateDocument(contextId: string, document: any, featureArray = [], options = {}): Promise<any> {
    return this.emitWithResponse('context:document:update', { contextId, document, featureArray, options });
  }

  async removeDocument(contextId: string, documentId: string): Promise<any> {
    return this.emitWithResponse('context:document:remove', { contextId, documentId });
  }

  async deleteDocument(contextId: string, documentId: string): Promise<any> {
    return this.emitWithResponse('context:document:delete', { contextId, documentId });
  }

  // --- Generic emit helper for new API ---
  private emitWithResponse(event: string, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // Check if socket is connected before emitting
        if (!this.socket.connected) {
          console.warn(`background.js | [socket.io] Socket not connected. Cannot emit event '${event}'.`);
          return reject(new Error(`Socket not connected when trying to emit ${event}`));
        }

        // Add a timeout to prevent hanging on unresponsive servers
        const timeoutId = setTimeout(() => {
          console.warn(`background.js | [socket.io] Timeout waiting for response to event '${event}'`);
          reject(new Error(`Timeout waiting for response to ${event}`));
        }, 10000); // 10 second timeout

        this.socket.emit(event, payload, (response: any) => {
          clearTimeout(timeoutId);

          if (!response) return reject(new Error('No response from server'));
          if (response.status === 'error') {
            if (typeof response === 'object') {
              console.error(`[socket.io] Error response for event '${event}':`, JSON.stringify(response));
            } else {
              console.error(`[socket.io] Error response for event '${event}':`, response);
            }
            return reject(new Error(response.message || JSON.stringify(response)));
          }
          resolve(response.payload);
        });
      } catch (err) {
        console.error(`background.js | [socket.io] Exception when emitting event '${event}':`, err);
        reject(err);
      }
    });
  }
}

let socketInstance: MySocket | null = null;

export const getSocket = async (): Promise<MySocket> => {
  if (!config.load) {
    console.error("Config object does not have a load method. Cannot ensure config is loaded.");
  } else {
    await config.load();
  }

  if (socketInstance) {
    socketInstance.socket.auth = getSocketOptions().auth || {};
    if (!socketInstance.isConnected()) {
        console.log('background.js | [socket.io] Existing socket instance found but not connected. Attempting to connect.');
        socketInstance.connect();
    }
    return socketInstance;
  }

  console.log('background.js | [socket.io] Initializing new MySocket instance.');
  socketInstance = new MySocket();
  return socketInstance;
};

export const updateLocalCanvasTabsData = (contextId: string) => {
  if (!socketInstance || !socketInstance.isConnected()) {
    console.warn("background.js | [socket.io] Cannot update local canvas tabs data, socket not connected/authenticated.");
    return;
  }
  if (!contextId || contextId === 'unknown') {
    console.warn("background.js | [socket.io] Cannot update local canvas tabs data, invalid contextId provided:", contextId);
    return;
  }

  canvasFetchTabsForContext(contextId).then((tabArray: any[]) => {
    if (!tabArray || !Array.isArray(tabArray)) {
      sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: `Error fetching tabs for context ${contextId}` });
      return console.error(`ERROR: background.js | Error fetching tabs for context ${contextId}`, tabArray);
    }
    if (tabArray.length) {
        index.insertCanvasTabArray(tabArray);
    }
  }).then(() => {
    index.updateBrowserTabs();
  }).catch(error => {
      console.error(`background.js | Error in updateLocalCanvasTabsData for context ${contextId}:`, error);
      sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: `Failed to update local tab data for context ${contextId}.` });
  });
};

export default MySocket;
