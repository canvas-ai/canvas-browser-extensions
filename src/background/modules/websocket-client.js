// WebSocket client module for Canvas Extension
// Handles real-time communication with Canvas server via socket.io

import { io } from 'socket.io-client';
import { browserStorage } from './browser-storage.js';

export class WebSocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.authenticated = false;
    this.contextId = null;
    this.serverUrl = null;
    this.apiToken = null;

    // Reconnection state
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.shouldReconnect = true;

    // Event handlers
    this.eventHandlers = new Map();

    // Connection state
    this.connectionState = 'disconnected'; // disconnected, connecting, connected, authenticated, error

    console.log('WebSocketClient initialized');
  }

  // Initialize WebSocket connection using proper socket.io client
  async connect(serverUrl, apiToken, contextId = null) {
    try {
      console.log('WebSocketClient: Starting connection to', serverUrl);

      this.serverUrl = serverUrl;
      // Prefer device token if present (works with new device token auth),
      // fallback to user token (API token / JWT).
      try {
        const settings = await browserStorage.getConnectionSettings();
        this.apiToken = settings?.deviceToken || apiToken;
      } catch (_) {
        this.apiToken = apiToken;
      }
      this.contextId = contextId;
      this.shouldReconnect = true;

      // Clear any existing connection
      await this.disconnect();

      return await this._attemptConnection();
    } catch (error) {
      console.error('WebSocketClient: Connection failed:', error);
      this.connectionState = 'error';
      this.emit('connection.error', { error: error.message });
      return false;
    }
  }

  // Internal connection attempt with proper socket.io client
  async _attemptConnection() {
    return new Promise((resolve, reject) => {
      try {
        this.connectionState = 'connecting';
        this.emit('connection.state', { state: 'connecting' });

        console.log('WebSocketClient: Connecting with socket.io client to:', this.serverUrl);

        // Create socket.io connection with authentication
        this.socket = io(this.serverUrl, {
          auth: {
            token: this.apiToken
          },
          autoConnect: true,
          reconnection: false, // We'll handle reconnection manually
          timeout: 10000,
          transports: ['websocket']
        });

        // Connection success
        this.socket.on('connect', () => {
          console.log('WebSocketClient: Socket.io connected successfully');
          this.connected = true;
          this.connectionState = 'connected';
          this.reconnectAttempts = 0; // Reset on successful connection

          this.emit('connection.state', { state: 'connected' });
        });

        // Authentication success
        this.socket.on('authenticated', (payload) => {
          console.log('WebSocketClient: Authenticated successfully:', payload);
          this.authenticated = true;
          this.connectionState = 'authenticated';

          this.emit('authenticated', payload);
          this.emit('connection.state', { state: 'authenticated' });

          // Join context channel if we have a context
          if (this.contextId) {
            this.joinContext(this.contextId);
          }

          resolve(true);
        });

        // Authentication error
        this.socket.on('authentication_error', (error) => {
          console.error('WebSocketClient: Authentication failed:', error);
          this.connectionState = 'error';
          this.emit('connection.error', { error: 'Authentication failed' });
          reject(new Error('Authentication failed'));
        });

        // Document events (real-time tab sync)
        this.socket.on('document.inserted', (payload) => this._handleDocumentEvent('document.inserted', payload));
        this.socket.on('document.updated', (payload) => this._handleDocumentEvent('document.updated', payload));
        this.socket.on('document.removed', (payload) => this._handleDocumentEvent('document.removed', payload));
        this.socket.on('document.deleted', (payload) => this._handleDocumentEvent('document.deleted', payload));
        this.socket.on('document.removed.batch', (payload) => this._handleDocumentEvent('document.removed.batch', payload));
        this.socket.on('document.deleted.batch', (payload) => this._handleDocumentEvent('document.deleted.batch', payload));

        // Context events
        this.socket.on('context.created', (payload) => this._handleContextEvent('context.created', payload));
        this.socket.on('context.updated', (payload) => this._handleContextEvent('context.updated', payload));
        this.socket.on('context.deleted', (payload) => this._handleContextEvent('context.deleted', payload));
        this.socket.on('context.url.set', (payload) => this._handleContextEvent('context.url.set', payload));

        // Connection events
        this.socket.on('disconnect', (reason) => {
          console.log('WebSocketClient: Socket.io disconnected:', reason);
          this._handleDisconnection();

          if (reason === 'io server disconnect') {
            // Server forced disconnect - don't reconnect automatically
            resolve(false);
          } else if (this.shouldReconnect) {
            // Client disconnect or network issues - attempt reconnect
            this._scheduleReconnect();
            resolve(false);
          } else {
            resolve(false);
          }
        });

        // Connection errors
        this.socket.on('connect_error', (error) => {
          console.error('WebSocketClient: Connection error:', error);
          this.connectionState = 'error';
          this.emit('connection.error', { error: error.message });
          reject(error);
        });

        // Start connection
        this.socket.connect();

      } catch (error) {
        console.error('WebSocketClient: Failed to create socket.io connection:', error);
        reject(error);
      }
    });
  }

  // Handle document events (tab sync)
  _handleDocumentEvent(eventName, payload) {
    console.log('WebSocketClient: Document event:', eventName, payload);

    // Filter only tab documents
    if (payload.document?.schema === 'data/abstraction/tab' ||
        payload.documents?.some(doc => doc.schema === 'data/abstraction/tab')) {

      this.emit('tab.event', {
        type: eventName,
        ...payload
      });
    }

    // Emit original event as well
    this.emit(eventName, payload);
  }

  // Handle context events
  _handleContextEvent(eventName, payload) {
    console.log('WebSocketClient: Context event:', eventName, payload);

    // If our context changed, we might need to rejoin
    if (eventName === 'context.url.set' && payload.contextId === this.contextId) {
      console.log('WebSocketClient: Our context URL changed');
      this.emit('context.changed', payload);
    }

    this.emit(eventName, payload);
  }

  // Handle disconnection
  _handleDisconnection() {
    console.log('WebSocketClient: Handling disconnection');

    this.connected = false;
    this.authenticated = false;
    this.connectionState = 'disconnected';

    this.emit('connection.state', { state: 'disconnected' });
    this.emit('disconnected');
  }

  // Send event to server using socket.io
  send(eventName, data = {}) {
    if (this.socket && this.socket.connected) {
      console.log('WebSocketClient: Sending event:', eventName, data);
      this.socket.emit(eventName, data);
      return true;
    } else {
      console.warn('WebSocketClient: Cannot send event - socket not connected');
      return false;
    }
  }

  // Send ping using socket.io
  ping() {
    if (this.socket && this.socket.connected) {
      this.socket.emit('ping');
      return true;
    }
    return false;
  }

  // Join context channel
  async joinContext(contextId) {
    console.log('WebSocketClient: Joining context:', contextId);

    this.contextId = contextId;

    if (this.authenticated) {
      // Subscribe to context events using socket.io
      const success = this.send('subscribe', {
        channel: `context:${contextId}`,
        contextId: contextId
      });

      if (success) {
        console.log('WebSocketClient: Successfully joined context:', contextId);
        this.emit('context.joined', { contextId });
        return true;
      }
    } else {
      console.log('WebSocketClient: Not authenticated yet, context will be joined after auth');
    }

    return false;
  }

  // Join workspace channel
  async joinWorkspace(workspaceId) {
    console.log('WebSocketClient: Joining workspace:', workspaceId);

    if (this.authenticated) {
      // Subscribe to workspace events using socket.io
      const success = this.send('subscribe', {
        channel: `workspace:${workspaceId}`,
        workspaceId: workspaceId
      });

      if (success) {
        console.log('WebSocketClient: Successfully joined workspace:', workspaceId);
        this.emit('workspace.joined', { workspaceId });
        return true;
      }
    } else {
      console.log('WebSocketClient: Not authenticated yet, workspace will be joined after auth');
    }

    return false;
  }

  // Leave context channel
  async leaveContext() {
    console.log('WebSocketClient: Leaving context:', this.contextId);

    if (this.authenticated && this.contextId) {
      const oldContextId = this.contextId;

      const success = this.send('unsubscribe', {
        channel: `context:${this.contextId}`,
        contextId: this.contextId
      });

      this.contextId = null;

      if (success) {
        console.log('WebSocketClient: Successfully left context:', oldContextId);
        this.emit('context.left', { contextId: oldContextId });
        return true;
      }
    }

    return false;
  }

  // Leave workspace channel
  async leaveWorkspace(workspaceId) {
    console.log('WebSocketClient: Leaving workspace:', workspaceId);

    if (this.authenticated && workspaceId) {
      const success = this.send('unsubscribe', {
        channel: `workspace:${workspaceId}`,
        workspaceId: workspaceId
      });

      if (success) {
        console.log('WebSocketClient: Successfully left workspace:', workspaceId);
        this.emit('workspace.left', { workspaceId });
        return true;
      }
    }

    return false;
  }

  // Disconnect WebSocket
  async disconnect() {
    console.log('WebSocketClient: Disconnecting...');

    this.shouldReconnect = false;

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Disconnect socket.io
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this._handleDisconnection();
  }

  // Schedule reconnection with exponential backoff
  _scheduleReconnect() {
    if (!this.shouldReconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('WebSocketClient: Max reconnect attempts reached or reconnection disabled');
      this.emit('connection.failed', {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    console.log(`WebSocketClient: Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      console.log(`WebSocketClient: Reconnect attempt ${this.reconnectAttempts}`);
      this.emit('connection.state', { state: 'reconnecting', attempt: this.reconnectAttempts });

      try {
        const success = await this._attemptConnection();
        if (!success) {
          this._scheduleReconnect();
        }
      } catch (error) {
        console.error('WebSocketClient: Reconnect failed:', error);
        this._scheduleReconnect();
      }
    }, delay);
  }

  // Event handling
  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  once(eventType, handler) {
    const onceHandler = (...args) => {
      handler(...args);
      this.off(eventType, onceHandler);
    };
    this.on(eventType, onceHandler);
  }

  off(eventType, handler) {
    if (this.eventHandlers.has(eventType)) {
      const handlers = this.eventHandlers.get(eventType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(eventType, data) {
    if (this.eventHandlers.has(eventType)) {
      this.eventHandlers.get(eventType).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('WebSocketClient: Event handler error:', error);
        }
      });
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.connected,
      authenticated: this.authenticated,
      contextId: this.contextId,
      state: this.connectionState,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Check if connected and authenticated
  isConnected() {
    return this.connected && this.authenticated;
  }

  // Get current context
  getCurrentContext() {
    return this.contextId;
  }
}

// Create singleton instance
export const webSocketClient = new WebSocketClient();
export default webSocketClient;
