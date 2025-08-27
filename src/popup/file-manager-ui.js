// File Manager UI module for Canvas Extension Popup
// Handles UI interactions for file operations

class FileManagerUI {
  constructor() {
    this.contextMenu = null;
    this.selectedItems = new Set();
    this.draggedItem = null;
    this.clipboard = null;
  }

  // Initialize the file manager UI
  initialize() {
    this.createContextMenu();
    this.setupKeyboardShortcuts();
    this.loadClipboard();
  }

  // Create context menu element
  createContextMenu() {
    // Remove existing context menu if any
    const existing = document.getElementById('fileContextMenu');
    if (existing) {
      existing.remove();
    }

    const menu = document.createElement('div');
    menu.id = 'fileContextMenu';
    menu.className = 'context-menu';
    document.body.appendChild(menu);
    this.contextMenu = menu;

    // Close context menu on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu')) {
        this.hideContextMenu();
      }
    });
  }

  // Show context menu
  showContextMenu(x, y, items) {
    const menu = this.contextMenu;
    menu.innerHTML = '';

    items.forEach(item => {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        menu.appendChild(separator);
      } else {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item';
        if (item.disabled) {
          menuItem.classList.add('disabled');
        }

        if (item.icon) {
          const icon = document.createElement('span');
          icon.className = 'context-menu-icon';
          icon.innerHTML = item.icon;
          menuItem.appendChild(icon);
        }

        const label = document.createElement('span');
        label.textContent = item.label;
        menuItem.appendChild(label);

        if (item.shortcut) {
          const shortcut = document.createElement('span');
          shortcut.className = 'context-menu-shortcut';
          shortcut.textContent = item.shortcut;
          shortcut.style.marginLeft = 'auto';
          shortcut.style.opacity = '0.6';
          shortcut.style.fontSize = '11px';
          menuItem.appendChild(shortcut);
        }

        if (!item.disabled) {
          menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideContextMenu();
            if (item.action) {
              item.action();
            }
          });
        }

        menu.appendChild(menuItem);
      }
    });

    // Position the menu
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.add('show');

    // Adjust position if menu goes off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${y - rect.height}px`;
    }
  }

  // Hide context menu
  hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.classList.remove('show');
    }
  }

  // Setup keyboard shortcuts
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
      // Check if we're in a text input
      if (e.target.matches('input, textarea')) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      if (ctrlKey) {
        switch(e.key.toLowerCase()) {
          case 'x':
            e.preventDefault();
            await this.handleCut();
            break;
          case 'c':
            e.preventDefault();
            await this.handleCopy();
            break;
          case 'v':
            e.preventDefault();
            await this.handlePaste();
            break;
          case 'a':
            e.preventDefault();
            this.selectAll();
            break;
        }
      } else if (e.key === 'Delete') {
        e.preventDefault();
        await this.handleDelete();
      }
    });
  }

  // Handle cut operation
  async handleCut() {
    const selected = this.getSelectedItems();
    if (selected.length === 0) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FILE_CUT',
        data: {
          items: selected,
          source: this.getCurrentSource()
        }
      });

      if (response.success) {
        this.markItemsAsCut(selected);
        this.showToast('Items cut to clipboard');
      } else {
        this.showToast('Failed to cut items: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Cut operation failed:', error);
      this.showToast('Cut operation failed', 'error');
    }
  }

  // Handle copy operation
  async handleCopy() {
    const selected = this.getSelectedItems();
    if (selected.length === 0) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FILE_COPY',
        data: {
          items: selected,
          source: this.getCurrentSource()
        }
      });

      if (response.success) {
        this.showToast('Items copied to clipboard');
      } else {
        this.showToast('Failed to copy items: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Copy operation failed:', error);
      this.showToast('Copy operation failed', 'error');
    }
  }

  // Handle paste operation
  async handlePaste(targetPath = null) {
    const target = targetPath || this.getCurrentPath();
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FILE_PASTE',
        data: {
          targetPath: target,
          targetWorkspace: this.getCurrentWorkspace()
        }
      });

      if (response.success) {
        this.showToast('Items pasted successfully');
        await this.refreshView();
      } else {
        this.showToast('Failed to paste items: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Paste operation failed:', error);
      this.showToast('Paste operation failed', 'error');
    }
  }

  // Handle delete operation
  async handleDelete() {
    const selected = this.getSelectedItems();
    if (selected.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selected.length} item(s)?`)) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FILE_DELETE',
        data: {
          workspace: this.getCurrentWorkspace(),
          documentIds: selected.map(item => item.id),
          contextSpec: this.getCurrentPath(),
          featureArray: []
        }
      });

      if (response.success) {
        this.showToast('Items deleted successfully');
        await this.refreshView();
      } else {
        this.showToast('Failed to delete items: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Delete operation failed:', error);
      this.showToast('Delete operation failed', 'error');
    }
  }

  // Handle remove operation
  async handleRemove() {
    const selected = this.getSelectedItems();
    if (selected.length === 0) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FILE_REMOVE',
        data: {
          workspace: this.getCurrentWorkspace(),
          documentIds: selected.map(item => item.id),
          contextSpec: this.getCurrentPath(),
          featureArray: []
        }
      });

      if (response.success) {
        this.showToast('Items removed successfully');
        await this.refreshView();
      } else {
        this.showToast('Failed to remove items: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Remove operation failed:', error);
      this.showToast('Remove operation failed', 'error');
    }
  }

  // Handle merge up operation
  async handleMergeUp(path) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FILE_MERGE_UP',
        data: {
          workspace: this.getCurrentWorkspace(),
          path: path
        }
      });

      if (response.success) {
        this.showToast('Merge up completed successfully');
        await this.refreshView();
      } else {
        this.showToast('Failed to merge up: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Merge up operation failed:', error);
      this.showToast('Merge up operation failed', 'error');
    }
  }

  // Handle merge down operation
  async handleMergeDown(path) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FILE_MERGE_DOWN',
        data: {
          workspace: this.getCurrentWorkspace(),
          path: path
        }
      });

      if (response.success) {
        this.showToast('Merge down completed successfully');
        await this.refreshView();
      } else {
        this.showToast('Failed to merge down: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Merge down operation failed:', error);
      this.showToast('Merge down operation failed', 'error');
    }
  }

  // Handle subtract up operation
  async handleSubtractUp(path) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FILE_SUBTRACT_UP',
        data: {
          workspace: this.getCurrentWorkspace(),
          path: path
        }
      });

      if (response.success) {
        this.showToast('Subtract up completed successfully');
        await this.refreshView();
      } else {
        this.showToast('Failed to subtract up: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Subtract up operation failed:', error);
      this.showToast('Subtract up operation failed', 'error');
    }
  }

  // Handle subtract down operation
  async handleSubtractDown(path) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FILE_SUBTRACT_DOWN',
        data: {
          workspace: this.getCurrentWorkspace(),
          path: path
        }
      });

      if (response.success) {
        this.showToast('Subtract down completed successfully');
        await this.refreshView();
      } else {
        this.showToast('Failed to subtract down: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Subtract down operation failed:', error);
      this.showToast('Subtract down operation failed', 'error');
    }
  }

  // Setup drag and drop for an element
  setupDragAndDrop(element, itemData) {
    element.draggable = true;

    element.addEventListener('dragstart', (e) => {
      this.draggedItem = itemData;
      element.classList.add('dragging');
      e.dataTransfer.effectAllowed = e.shiftKey ? 'move' : 'copy';
      e.dataTransfer.setData('text/plain', JSON.stringify(itemData));
    });

    element.addEventListener('dragend', (e) => {
      element.classList.remove('dragging');
      this.draggedItem = null;
    });
  }

  // Setup drop zone for folders
  setupDropZone(element, targetPath) {
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = e.shiftKey ? 'move' : 'copy';
      element.classList.add('drag-over');
    });

    element.addEventListener('dragleave', (e) => {
      element.classList.remove('drag-over');
    });

    element.addEventListener('drop', async (e) => {
      e.preventDefault();
      element.classList.remove('drag-over');

      if (!this.draggedItem) return;

      const isMove = e.shiftKey;
      
      try {
        if (isMove) {
          await this.handleMove(this.draggedItem.path, targetPath);
        } else {
          await this.handleCopyTo(this.draggedItem.path, targetPath);
        }
      } catch (error) {
        console.error('Drop operation failed:', error);
        this.showToast('Drop operation failed', 'error');
      }
    });
  }

  // Handle move operation
  async handleMove(from, to) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FILE_MOVE',
        data: {
          from: from,
          to: to,
          recursive: true
        }
      });

      if (response.success) {
        this.showToast('Item moved successfully');
        await this.refreshView();
      } else {
        this.showToast('Failed to move item: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Move operation failed:', error);
      this.showToast('Move operation failed', 'error');
    }
  }

  // Handle copy to operation
  async handleCopyTo(from, to) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FILE_COPY',
        data: {
          items: [{ path: from, type: 'file' }],
          source: this.getCurrentSource()
        }
      });

      if (response.success) {
        await this.handlePaste(to);
      } else {
        this.showToast('Failed to copy item: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Copy operation failed:', error);
      this.showToast('Copy operation failed', 'error');
    }
  }

  // Load clipboard state
  async loadClipboard() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_CLIPBOARD'
      });

      if (response.success) {
        this.clipboard = response.clipboard;
      }
    } catch (error) {
      console.error('Failed to load clipboard:', error);
    }
  }

  // Helper methods
  getSelectedItems() {
    const items = [];
    document.querySelectorAll('.tab-item.selected, .tree-node.selected, .document-row.selected').forEach(el => {
      const itemData = {
        id: el.dataset.id,
        path: el.dataset.path,
        type: el.dataset.type || 'file',
        name: el.dataset.name || el.textContent.trim()
      };
      items.push(itemData);
    });
    return items;
  }

  markItemsAsCut(items) {
    // Clear previous cut indicators
    document.querySelectorAll('.cut-indicator').forEach(el => {
      el.classList.remove('cut-indicator');
    });

    // Add cut indicators to selected items
    items.forEach(item => {
      const element = document.querySelector(`[data-id="${item.id}"]`);
      if (element) {
        element.classList.add('cut-indicator');
        element.style.opacity = '0.5';
      }
    });
  }

  selectAll() {
    document.querySelectorAll('.tab-item, .tree-node, .document-row').forEach(el => {
      el.classList.add('selected');
    });
  }

  getCurrentPath() {
    // Get current path from tree view or context
    const pathInput = document.getElementById('treePathInput');
    return pathInput ? pathInput.value : '/';
  }

  getCurrentWorkspace() {
    // Get current workspace from connection info
    const connection = window.currentConnection;
    return connection?.workspace || connection?.context?.workspace || null;
  }

  getCurrentSource() {
    const connection = window.currentConnection;
    return {
      type: connection?.mode || 'context',
      id: connection?.context?.id || connection?.workspace,
      path: this.getCurrentPath()
    };
  }

  async refreshView() {
    // Trigger view refresh
    if (window.refreshTreeView) {
      window.refreshTreeView();
    }
    if (window.refreshDocumentList) {
      window.refreshDocumentList();
    }
  }

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast') || this.createToast();
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';

    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }

  createToast() {
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: #333;
      color: white;
      border-radius: 4px;
      z-index: 10001;
      display: none;
    `;
    document.body.appendChild(toast);
    return toast;
  }

  // Attach context menu to tree nodes
  attachTreeNodeContextMenu(node) {
    node.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const path = node.dataset.path;
      const isFolder = node.dataset.type === 'folder';

      const menuItems = [
        {
          label: 'Cut',
          icon: '✂️',
          shortcut: 'Ctrl+X',
          action: () => this.handleCut()
        },
        {
          label: 'Copy',
          icon: '📋',
          shortcut: 'Ctrl+C',
          action: () => this.handleCopy()
        },
        {
          label: 'Paste',
          icon: '📌',
          shortcut: 'Ctrl+V',
          action: () => this.handlePaste(path),
          disabled: !this.clipboard || this.clipboard.items.length === 0
        },
        { separator: true },
        {
          label: 'Delete',
          icon: '🗑️',
          shortcut: 'Del',
          action: () => this.handleDelete()
        },
        {
          label: 'Remove',
          icon: '❌',
          action: () => this.handleRemove()
        },
        { separator: true },
        {
          label: 'Merge Up',
          icon: '⬆️',
          action: () => this.handleMergeUp(path),
          disabled: !isFolder
        },
        {
          label: 'Merge Down',
          icon: '⬇️',
          action: () => this.handleMergeDown(path),
          disabled: !isFolder
        },
        { separator: true },
        {
          label: 'Subtract Up',
          icon: '➖⬆️',
          action: () => this.handleSubtractUp(path),
          disabled: !isFolder
        },
        {
          label: 'Subtract Down',
          icon: '➖⬇️',
          action: () => this.handleSubtractDown(path),
          disabled: !isFolder
        }
      ];

      this.showContextMenu(e.clientX, e.clientY, menuItems);
    });
  }

  // Attach context menu to document rows
  attachDocumentContextMenu(row) {
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();

      const menuItems = [
        {
          label: 'Open',
          icon: '📄',
          action: () => this.openDocument(row.dataset.id)
        },
        { separator: true },
        {
          label: 'Cut',
          icon: '✂️',
          shortcut: 'Ctrl+X',
          action: () => this.handleCut()
        },
        {
          label: 'Copy',
          icon: '📋',
          shortcut: 'Ctrl+C',
          action: () => this.handleCopy()
        },
        { separator: true },
        {
          label: 'Delete',
          icon: '🗑️',
          shortcut: 'Del',
          action: () => this.handleDelete()
        },
        {
          label: 'Remove',
          icon: '❌',
          action: () => this.handleRemove()
        }
      ];

      this.showContextMenu(e.clientX, e.clientY, menuItems);
    });
  }

  openDocument(documentId) {
    // Implementation for opening document
    console.log('Opening document:', documentId);
  }
}

// Create singleton instance
const fileManagerUI = new FileManagerUI();