// File Manager module for Canvas Extension
// Handles file operations like cut, copy, paste, delete, merge, subtract

import { apiClient } from './api-client.js';
import { browserStorage } from './browser-storage.js';

export class FileManager {
  constructor() {
    this.clipboard = {
      operation: null, // 'cut' or 'copy'
      items: [], // Array of { path, type, data }
      source: null // Source context/workspace
    };
  }

  // Clipboard operations
  async cut(items, source) {
    this.clipboard = {
      operation: 'cut',
      items: items,
      source: source
    };
    await this.saveClipboard();
    return true;
  }

  async copy(items, source) {
    this.clipboard = {
      operation: 'copy',
      items: items,
      source: source
    };
    await this.saveClipboard();
    return true;
  }

  async paste(targetPath, targetWorkspace) {
    if (!this.clipboard.items || this.clipboard.items.length === 0) {
      throw new Error('Clipboard is empty');
    }

    const results = [];
    
    for (const item of this.clipboard.items) {
      try {
        const destinationPath = this.buildDestinationPath(targetPath, item.path);
        
        if (this.clipboard.operation === 'copy') {
          // Copy operation
          const result = await apiClient.copyPath(
            item.path,
            destinationPath,
            item.type === 'folder'
          );
          results.push({ success: true, item, result });
        } else if (this.clipboard.operation === 'cut') {
          // Move operation
          const result = await apiClient.movePath(
            item.path,
            destinationPath,
            item.type === 'folder'
          );
          results.push({ success: true, item, result });
        }
      } catch (error) {
        console.error('Failed to paste item:', item, error);
        results.push({ success: false, item, error: error.message });
      }
    }

    // Clear clipboard after cut operation
    if (this.clipboard.operation === 'cut') {
      await this.clearClipboard();
    }

    return results;
  }

  async clearClipboard() {
    this.clipboard = {
      operation: null,
      items: [],
      source: null
    };
    await this.saveClipboard();
  }

  async saveClipboard() {
    await browserStorage.setItem('fileManagerClipboard', this.clipboard);
  }

  async loadClipboard() {
    const saved = await browserStorage.getItem('fileManagerClipboard');
    if (saved) {
      this.clipboard = saved;
    }
    return this.clipboard;
  }

  // Delete operations
  async removeDocuments(workspaceNameOrId, documentIds, contextSpec = '/', featureArray = []) {
    return await apiClient.removeWorkspaceDocuments(workspaceNameOrId, documentIds, contextSpec, featureArray);
  }

  async deleteDocuments(workspaceNameOrId, documentIds, contextSpec = '/', featureArray = []) {
    return await apiClient.deleteWorkspaceDocuments(workspaceNameOrId, documentIds, contextSpec, featureArray);
  }

  // Merge operations
  // MergeUp: Merges the bitmap layer upward in the hierarchy
  // Example: mergeUp("foo", "/work/foo/bar/baz") merges "foo" layer to /work/foo/bar and /work/foo
  async mergeUp(workspaceNameOrId, layerName, path) {
    try {
      const result = await apiClient.mergeUpPath(workspaceNameOrId, layerName, path);
      return { success: true, result };
    } catch (error) {
      console.error('MergeUp failed:', error);
      return { success: false, error: error.message };
    }
  }

  // MergeDown: Merges the bitmap layer downward in the hierarchy
  // Example: mergeDown("foo", "/work/mb") merges "foo" layer to children under /work/mb
  async mergeDown(workspaceNameOrId, layerName, path) {
    try {
      const result = await apiClient.mergeDownPath(workspaceNameOrId, layerName, path);
      return { success: true, result };
    } catch (error) {
      console.error('MergeDown failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Subtract operations
  // SubtractUp: Subtracts the bitmap layer from parent paths
  // Example: subtractUp("foo", "/work/foo/bar/baz") subtracts "foo" from /work/foo/bar and /work/foo
  async subtractUp(workspaceNameOrId, layerName, path) {
    try {
      const result = await apiClient.subtractUpPath(workspaceNameOrId, layerName, path);
      return { success: true, result };
    } catch (error) {
      console.error('SubtractUp failed:', error);
      return { success: false, error: error.message };
    }
  }

  // SubtractDown: Subtracts the bitmap layer from child paths
  // Example: subtractDown("foo", "/work/mb") subtracts "foo" from children under /work/mb
  async subtractDown(workspaceNameOrId, layerName, path) {
    try {
      const result = await apiClient.subtractDownPath(workspaceNameOrId, layerName, path);
      return { success: true, result };
    } catch (error) {
      console.error('SubtractDown failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Move and copy operations
  async move(from, to, recursive = true) {
    try {
      const result = await apiClient.movePath(from, to, recursive);
      return { success: true, result };
    } catch (error) {
      console.error('Move failed:', error);
      return { success: false, error: error.message };
    }
  }

  async copyPath(from, to, recursive = true) {
    try {
      const result = await apiClient.copyPath(from, to, recursive);
      return { success: true, result };
    } catch (error) {
      console.error('Copy failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper methods
  buildDestinationPath(targetPath, sourcePath) {
    // Extract filename from source path
    const filename = sourcePath.split('/').pop();
    
    // Ensure target path ends with /
    const normalizedTarget = targetPath.endsWith('/') ? targetPath : targetPath + '/';
    
    return normalizedTarget + filename;
  }

  getPathInfo(path) {
    const parts = path.split('/').filter(p => p);
    const filename = parts.pop() || '';
    const parentPath = '/' + parts.join('/');
    
    return {
      filename,
      parentPath: parentPath === '/' ? '/' : parentPath,
      fullPath: path
    };
  }

  // Batch operations
  async batchOperation(operation, items, options = {}) {
    const results = [];
    
    for (const item of items) {
      try {
        let result;
        switch (operation) {
          case 'delete':
            result = await this.deleteDocuments(options.workspace, [item.id], item.contextSpec, item.featureArray);
            break;
          case 'remove':
            result = await this.removeDocuments(options.workspace, [item.id], item.contextSpec, item.featureArray);
            break;
          case 'move':
            result = await this.move(item.from, item.to, item.recursive);
            break;
          case 'copy':
            result = await this.copyPath(item.from, item.to, item.recursive);
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
        results.push({ success: true, item, result });
      } catch (error) {
        results.push({ success: false, item, error: error.message });
      }
    }
    
    return results;
  }
}

// Create singleton instance
export const fileManager = new FileManager();
export default fileManager;