// Context Integration module for Canvas Extension
// Handles proper integration with Canvas server Context class events

import { browserStorage } from './browser-storage.js';
import { webSocketClient } from './websocket-client.js';
import { syncEngine } from './sync-engine.js';

export class ContextIntegration {
  constructor() {
    this.currentContextId = null;
    this.isInitialized = false;
    this.eventHandlers = new Map();
  }

  // Initialize context integration
  async initialize() {
    try {
      console.log('ContextIntegration: Initializing...');

      // Get current context
      const currentContext = await browserStorage.getCurrentContext();
      if (currentContext?.id) {
        this.currentContextId = currentContext.id;
        console.log('ContextIntegration: Current context:', this.currentContextId);
      }

      // Setup WebSocket event handlers for Context class events
      this.setupContextEventHandlers();

      this.isInitialized = true;
      console.log('ContextIntegration: Initialized successfully');
      return true;
    } catch (error) {
      console.error('ContextIntegration: Failed to initialize:', error);
      return false;
    }
  }

  // Setup Context class event handlers
  setupContextEventHandlers() {
    console.log('ContextIntegration: Setting up Context class event handlers...');

    // Handle context lifecycle events
    webSocketClient.on('context.created', (data) => {
      console.log('ContextIntegration: Context created:', data);
      this.handleContextCreated(data);
    });

    webSocketClient.on('context.updated', (data) => {
      console.log('ContextIntegration: Context updated:', data);
      this.handleContextUpdated(data);
    });

    webSocketClient.on('context.url.set', (data) => {
      console.log('ContextIntegration: Context URL changed:', data);
      this.handleContextUrlChanged(data);
    });

    webSocketClient.on('context.deleted', (data) => {
      console.log('ContextIntegration: Context deleted:', data);
      this.handleContextDeleted(data);
    });

    webSocketClient.on('context.locked', (data) => {
      console.log('ContextIntegration: Context locked:', data);
      this.handleContextLocked(data);
    });

    webSocketClient.on('context.unlocked', (data) => {
      console.log('ContextIntegration: Context unlocked:', data);
      this.handleContextUnlocked(data);
    });

    // Handle ACL events
    webSocketClient.on('context.acl.updated', (data) => {
      console.log('ContextIntegration: Context ACL updated:', data);
      this.handleContextAclUpdated(data);
    });

    webSocketClient.on('context.acl.revoked', (data) => {
      console.log('ContextIntegration: Context ACL revoked:', data);
      this.handleContextAclRevoked(data);
    });

    // Handle document events with Context integration
    webSocketClient.on('document.inserted', (data) => {
      this.handleDocumentEvent('inserted', data);
    });

    webSocketClient.on('document.updated', (data) => {
      this.handleDocumentEvent('updated', data);
    });

    webSocketClient.on('document.removed', (data) => {
      this.handleDocumentEvent('removed', data);
    });

    webSocketClient.on('document.deleted', (data) => {
      this.handleDocumentEvent('deleted', data);
    });

    webSocketClient.on('document.removed.batch', (data) => {
      this.handleDocumentEvent('removed.batch', data);
    });

    webSocketClient.on('document.deleted.batch', (data) => {
      this.handleDocumentEvent('deleted.batch', data);
    });
  }

  // Handle context created
  async handleContextCreated(data) {
    if (data.id === this.currentContextId) {
      console.log('ContextIntegration: Our context was created');
      // Refresh context data
      await this.refreshCurrentContext();
    }
  }

  // Handle context updated
  async handleContextUpdated(data) {
    if (data.id === this.currentContextId) {
      console.log('ContextIntegration: Our context was updated');
      // Refresh context data and possibly re-sync
      await this.refreshCurrentContext();

      // Trigger partial sync if needed
      if (syncEngine.isInitialized) {
        await syncEngine.performIncrementalSync(this.currentContextId);
      }
    }
  }

  // Handle context URL changed
  async handleContextUrlChanged(data) {
    if (data.id === this.currentContextId) {
      console.log('ContextIntegration: Our context URL changed to:', data.url);

      // Update stored context
      const currentContext = await browserStorage.getCurrentContext();
      if (currentContext) {
        currentContext.url = data.url;
        await browserStorage.setCurrentContext(currentContext);
      }

      // Notify sync engine of context change
      if (syncEngine.isInitialized) {
        await syncEngine.performFullSync(this.currentContextId);
      }
    }
  }

  // Handle context deleted
  async handleContextDeleted(data) {
    if (data.id === this.currentContextId) {
      console.log('ContextIntegration: Our context was deleted!');

      // Clear current context
      await browserStorage.setCurrentContext(null);
      this.currentContextId = null;

      // Disconnect WebSocket
      await webSocketClient.disconnect();

      // Notify user (could emit event to popup)
      this.emit('context.deleted.current', data);
    }
  }

  // Handle context locked
  async handleContextLocked(data) {
    if (data.id === this.currentContextId) {
      console.log('ContextIntegration: Our context was locked');
      // Disable certain sync operations
      this.emit('context.locked', data);
    }
  }

  // Handle context unlocked
  async handleContextUnlocked(data) {
    if (data.id === this.currentContextId) {
      console.log('ContextIntegration: Our context was unlocked');
      // Re-enable sync operations
      this.emit('context.unlocked', data);
    }
  }

  // Handle ACL updates
  async handleContextAclUpdated(data) {
    if (data.id === this.currentContextId) {
      console.log('ContextIntegration: Our context ACL updated');
      // Refresh permissions and possibly adjust sync behavior
      await this.refreshCurrentContext();
    }
  }

  // Handle ACL revoked
  async handleContextAclRevoked(data) {
    if (data.id === this.currentContextId) {
      console.log('ContextIntegration: Our context ACL revoked');
      // Check if we still have access
      await this.refreshCurrentContext();
    }
  }

  // Handle document events with context awareness
  async handleDocumentEvent(eventType, data) {
    if (data.contextId === this.currentContextId) {
      console.log(`ContextIntegration: Document ${eventType} in our context:`, data);

      // Filter for tab documents
      if (this.isTabDocument(data)) {
        console.log(`ContextIntegration: Tab document ${eventType}:`, data);

        // Forward to sync engine with additional context information
        if (syncEngine.isInitialized) {
          await syncEngine.handleWebSocketEvent({
            type: `document.${eventType}`,
            ...data,
            contextIntegration: true
          });
        }
      }
    }
  }

  // Check if document is a tab document
  isTabDocument(data) {
    // Check single document
    if (data.document?.schema === 'data/abstraction/tab') {
      return true;
    }

    // Check document array
    if (data.documents?.some(doc => doc.schema === 'data/abstraction/tab')) {
      return true;
    }

    return false;
  }

  // Refresh current context data
  async refreshCurrentContext() {
    try {
      if (!this.currentContextId) {
        return null;
      }

      // This would typically fetch from API, but for now we'll keep cached version
      const currentContext = await browserStorage.getCurrentContext();
      console.log('ContextIntegration: Refreshed context:', currentContext?.id);
      return currentContext;
    } catch (error) {
      console.error('ContextIntegration: Failed to refresh context:', error);
      return null;
    }
  }

  // Switch to a new context
  async switchContext(newContextId) {
    try {
      console.log('ContextIntegration: Switching context from', this.currentContextId, 'to', newContextId);

      const oldContextId = this.currentContextId;
      this.currentContextId = newContextId;

      // Leave old context channel
      if (oldContextId && webSocketClient.isConnected()) {
        await webSocketClient.leaveContext();
      }

      // Join new context channel
      if (newContextId && webSocketClient.isConnected()) {
        await webSocketClient.joinContext(newContextId);
      }

      // Notify sync engine of context change
      if (syncEngine.isInitialized) {
        await syncEngine.handleContextChange(oldContextId, newContextId);
      }

      console.log('ContextIntegration: Context switch completed');
      return true;
    } catch (error) {
      console.error('ContextIntegration: Failed to switch context:', error);
      return false;
    }
  }

  // Get current context
  getCurrentContextId() {
    return this.currentContextId;
  }

  // Check if context is valid and accessible
  async validateContext(contextId = null) {
    const targetContextId = contextId || this.currentContextId;

    if (!targetContextId) {
      return false;
    }

    try {
      // This would typically check with API, but for now return true if we have an ID
      return true;
    } catch (error) {
      console.error('ContextIntegration: Context validation failed:', error);
      return false;
    }
  }

  // Event handling
  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
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
          console.error('ContextIntegration: Event handler error:', error);
        }
      });
    }
  }
}

// Create singleton instance
export const contextIntegration = new ContextIntegration();
export default contextIntegration;
