// API Client module for Canvas Extension
// Handles REST API communication with Canvas server

import { browserStorage } from './browser-storage.js';

export class CanvasApiClient {
  constructor() {
    this.baseUrl = null;
    this.apiBasePath = '/rest/v2';
    this.apiToken = null;
    this.connected = false;
  }

  // Initialize client with connection settings
  initialize(serverUrl, apiBasePath, apiToken) {
    this.baseUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiBasePath = apiBasePath;
    this.apiToken = apiToken;
  }

  // Build full API URL
  buildUrl(endpoint) {
    return `${this.baseUrl}${this.apiBasePath}${endpoint}`;
  }

  // Build request headers
  buildHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }

    return headers;
  }

  // Generic HTTP request method
  async request(method, endpoint, data = null) {
    const url = this.buildUrl(endpoint);
    const headers = this.buildHeaders();

    const requestOptions = {
      method,
      headers,
      mode: 'cors'
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestOptions.body = JSON.stringify(data);
    }

    try {
      console.log(`API Request: ${method} ${url}`);
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log(`API Response: ${method} ${url}`, responseData);

      return responseData;
    } catch (error) {
      console.error(`API Error: ${method} ${url}`, error);
      throw error;
    }
  }

  // GET request
  async get(endpoint) {
    return await this.request('GET', endpoint);
  }

  // POST request
  async post(endpoint, data) {
    return await this.request('POST', endpoint, data);
  }

  // PUT request
  async put(endpoint, data) {
    return await this.request('PUT', endpoint, data);
  }

  // DELETE request
  async delete(endpoint) {
    return await this.request('DELETE', endpoint);
  }

    // Test connection to server
  async testConnection() {
    try {
      console.log(`Testing connection to ${this.baseUrl}${this.apiBasePath}`);

      // Test unauthenticated ping endpoint
      const pingUrl = `${this.baseUrl}${this.apiBasePath}/ping`;
      console.log(`Testing ping: ${pingUrl}`);

      const pingResponse = await fetch(pingUrl, {
        method: 'GET',
        mode: 'cors'
      });

      if (!pingResponse.ok) {
        throw new Error(`Ping failed: HTTP ${pingResponse.status} ${pingResponse.statusText}`);
      }

      const pingData = await pingResponse.json();
      console.log('Ping successful:', pingData);

      // Test authenticated user endpoint if we have a token
      if (!this.apiToken) {
        return {
          success: true,
          connected: true,
          authenticated: false,
          message: 'Server reachable but no API token provided',
          ping: pingData
        };
      }

      console.log('Testing authenticated endpoint...');
      const userResponse = await this.get('/auth/me');

      this.connected = true;
      return {
        success: true,
        connected: true,
        authenticated: true,
        user: userResponse.payload,
        message: 'Connection and authentication successful',
        ping: pingData
      };
    } catch (error) {
      console.error('Connection test failed:', error);
      this.connected = false;
      return {
        success: false,
        connected: false,
        authenticated: false,
        error: error.message,
        message: 'Connection failed'
      };
    }
  }

  // Authentication methods
  async getCurrentUser() {
    return await this.get('/auth/me');
  }

  // Context methods
  async getContexts() {
    return await this.get('/contexts');
  }

  async getContext(contextId) {
    return await this.get(`/contexts/${contextId}`);
  }



  async updateContext(contextId, contextData) {
    return await this.put(`/contexts/${contextId}`, contextData);
  }

  async updateContextUrl(contextId, url) {
    return await this.post(`/contexts/${contextId}/url`, { url });
  }

  // Context tree
  async getContextTree(contextId) {
    return await this.get(`/contexts/${contextId}/tree`);
  }

  async deleteContext(contextId) {
    return await this.delete(`/contexts/${contextId}`);
  }

  // Workspace methods
  async getWorkspaces() {
    return await this.get('/workspaces');
  }

  // Workspace lifecycle
  async openWorkspace(workspaceNameOrId) {
    return await this.post(`/workspaces/${encodeURIComponent(workspaceNameOrId)}/open`, {});
  }

  // Workspace tree
  async getWorkspaceTree(workspaceNameOrId) {
    return await this.get(`/workspaces/${encodeURIComponent(workspaceNameOrId)}/tree`);
  }

  async getWorkspaceDocuments(workspaceNameOrId, contextSpec = '/', featureArray = []) {
    const enhancedFeatureArray = [...featureArray];
    if (!enhancedFeatureArray.includes('data/abstraction/tab')) {
      enhancedFeatureArray.unshift('data/abstraction/tab');
    }

    let endpoint = `/workspaces/${encodeURIComponent(workspaceNameOrId)}/documents`;

    const params = new URLSearchParams();
    if (contextSpec) params.set('contextSpec', contextSpec);
    if (enhancedFeatureArray.length > 0) {
      enhancedFeatureArray.forEach(feature => params.append('featureArray', feature));
    }

    const query = params.toString();
    if (query) endpoint += `?${query}`;

    return await this.get(endpoint);
  }

  async insertWorkspaceDocument(workspaceNameOrId, document, contextSpec = '/', featureArray = []) {
    const data = {
      contextSpec,
      featureArray,
      documents: [document]
    };
    return await this.post(`/workspaces/${encodeURIComponent(workspaceNameOrId)}/documents`, data);
  }

  async insertWorkspaceDocuments(workspaceNameOrId, documents, contextSpec = '/', featureArray = []) {
    const data = {
      contextSpec,
      featureArray,
      documents
    };
    return await this.post(`/workspaces/${encodeURIComponent(workspaceNameOrId)}/documents`, data);
  }

  async removeWorkspaceDocuments(workspaceNameOrId, documentIds, contextSpec = '/', featureArray = []) {
    // DELETE with body supported by backend route
    const endpoint = `/workspaces/${encodeURIComponent(workspaceNameOrId)}/remove`;
    const url = new URL(this.buildUrl(endpoint));
    if (contextSpec) url.searchParams.set('contextSpec', contextSpec);
    if (Array.isArray(featureArray)) {
      for (const f of featureArray) url.searchParams.append('featureArray', f);
    }
    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: this.buildHeaders(),
      body: JSON.stringify(Array.isArray(documentIds) ? documentIds : [documentIds])
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return await response.json();
  }

  async deleteWorkspaceDocuments(workspaceNameOrId, documentIds, contextSpec = '/', featureArray = []) {
    // DELETE /workspaces/:id with body and query
    const endpoint = `/workspaces/${encodeURIComponent(workspaceNameOrId)}`;
    const url = new URL(this.buildUrl(endpoint));
    if (contextSpec) url.searchParams.set('contextSpec', contextSpec);
    if (Array.isArray(featureArray)) {
      for (const f of featureArray) url.searchParams.append('featureArray', f);
    }
    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: this.buildHeaders(),
      body: JSON.stringify(Array.isArray(documentIds) ? documentIds : [documentIds])
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return await response.json();
  }

  // Document methods (tabs)
  async getContextDocuments(contextId, featureArray = []) {
    // Always ensure we're looking for tab documents
    const enhancedFeatureArray = [...featureArray];
    if (!enhancedFeatureArray.includes('data/abstraction/tab')) {
      enhancedFeatureArray.unshift('data/abstraction/tab');
    }

    // Get sync settings to check if we should filter by browser instance
    const syncSettings = await browserStorage.getSyncSettings();
    if (syncSettings.syncOnlyThisBrowser) {
      const browserIdentity = await browserStorage.getBrowserIdentity();
      if (browserIdentity) {
        const browserTag = `tag/${browserIdentity}`;
        if (!enhancedFeatureArray.includes(browserTag)) {
          enhancedFeatureArray.push(browserTag);
        }
      }
    }

    let endpoint = `/contexts/${contextId}/documents`;

    // Add feature array as query parameters if provided
    if (enhancedFeatureArray.length > 0) {
      const params = new URLSearchParams();
      enhancedFeatureArray.forEach(feature => params.append('featureArray', feature));
      endpoint += `?${params.toString()}`;
    }

    return await this.get(endpoint);
  }

  async insertDocument(contextId, document, featureArray = []) {
    // Always add browser identity for POST operations
    const enhancedFeatureArray = [...featureArray];
    const browserIdentity = await browserStorage.getBrowserIdentity();
    if (browserIdentity) {
      const browserTag = `tag/${browserIdentity}`;
      if (!enhancedFeatureArray.includes(browserTag)) {
        enhancedFeatureArray.push(browserTag);
      }
    }

    const data = {
      documents: document,  // Server expects "documents" (can be single object)
      featureArray: enhancedFeatureArray
    };
    return await this.post(`/contexts/${contextId}/documents`, data);
  }

  async insertDocuments(contextId, documents, featureArray = []) {
    // Always add browser identity for POST operations
    const enhancedFeatureArray = [...featureArray];
    const browserIdentity = await browserStorage.getBrowserIdentity();
    if (browserIdentity) {
      const browserTag = `tag/${browserIdentity}`;
      if (!enhancedFeatureArray.includes(browserTag)) {
        enhancedFeatureArray.push(browserTag);
      }
    }

    const data = {
      documents,
      featureArray: enhancedFeatureArray
    };
    return await this.post(`/contexts/${contextId}/documents/batch`, data);
  }

  async updateDocument(contextId, documentId, document, featureArray = []) {
    // Always add browser identity for PUT operations
    const enhancedFeatureArray = [...featureArray];
    const browserIdentity = await browserStorage.getBrowserIdentity();
    if (browserIdentity) {
      const browserTag = `tag/${browserIdentity}`;
      if (!enhancedFeatureArray.includes(browserTag)) {
        enhancedFeatureArray.push(browserTag);
      }
    }

    const data = {
      document,
      featureArray: enhancedFeatureArray
    };
    return await this.put(`/contexts/${contextId}/documents/${documentId}`, data);
  }

  async removeDocument(contextId, documentId) {
    return await this.delete(`/contexts/${contextId}/documents/${documentId}/remove`);
  }

  async removeDocuments(contextId, documentIds) {
    const data = { documentIds };
    return await this.post(`/contexts/${contextId}/documents/remove-batch`, data);
  }

  async deleteDocument(contextId, documentId) {
    return await this.delete(`/contexts/${contextId}/documents/${documentId}`);
  }

  async deleteDocuments(contextId, documentIds) {
    const data = { documentIds };
    return await this.post(`/contexts/${contextId}/documents/delete-batch`, data);
  }
}

// Create singleton instance
export const apiClient = new CanvasApiClient();
export default apiClient;
