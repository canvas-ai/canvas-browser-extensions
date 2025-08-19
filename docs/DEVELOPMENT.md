cd cdcd # Canvas Browser Extension Development Guide

## Quick Start

```bash
cd src/ui/browser-extension
npm install
npm run dev
```

Then load `packages/chromium/` in Chrome or `packages/firefox/manifest.json` in Firefox.

## Development Workflow

### 1. Making Changes

- **Background logic**: Edit files in `src/background/`
- **Popup UI**: Edit `src/popup/popup.html`, `popup.css`, `popup.js`
- **Settings page**: Edit `src/settings/settings.html`, `settings.css`, `settings.js`
- **Manifest changes**: Edit `manifest-chromium.json` or `manifest-firefox.json`

### 2. Building & Testing

```bash
# Development build (fast, with console logs)
npm run dev

# Production build (optimized)
npm run build

# Clean build artifacts
npm run clean
```

### 3. Browser Testing

**Chrome/Edge:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Reload" on the Canvas Extension card after rebuilding

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Reload" on the Canvas Extension after rebuilding

## File Structure

```
src/
├── background/
│   ├── service-worker.js       # Main background script
│   └── modules/                # Core modules
│       ├── storage.js          # Chrome storage wrapper
│       ├── api-client.js       # Canvas API client
│       ├── websocket-client.js # WebSocket handling
│       ├── tab-manager.js      # Tab operations
│       └── sync-engine.js      # Sync coordination
├── popup/
│   ├── popup.html             # Extension popup
│   ├── popup.css              # Popup styling
│   └── popup.js               # Popup interactions
└── settings/
    ├── settings.html          # Settings page
    ├── settings.css           # Settings styling
    └── settings.js            # Settings logic
```

## Adding Features

### Background Functionality

1. Add logic to appropriate module in `src/background/modules/`
2. Import and use in `service-worker.js`
3. Add message handlers for UI communication

Example:
```javascript
// In service-worker.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'NEW_FEATURE':
      handleNewFeature(message.data, sendResponse);
      return true;
  }
});
```

### UI Features

1. Update HTML structure in popup or settings
2. Add CSS styling following the shadcn theme
3. Add JavaScript interactions
4. Send messages to background script

Example:
```javascript
// In popup.js or settings.js
async function sendMessageToBackground(type, data = null) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}
```

## Debugging

### Background Script Debugging

1. Go to `chrome://extensions/`
2. Click "Inspect views: service worker" under Canvas Extension
3. Use DevTools Console, Network, etc.

### Popup/Settings Debugging

1. Right-click on extension popup → "Inspect"
2. For settings page: Open settings, then right-click → "Inspect"

### Common Issues

- **Module import errors**: Check file paths and ensure ES module syntax
- **Permission errors**: Update manifest permissions
- **Storage issues**: Check chrome.storage API usage
- **API errors**: Verify Canvas server is running and token is valid

## Testing

### Manual Testing Checklist

- [ ] Extension loads without errors
- [ ] Settings page opens and saves configuration
- [ ] Popup shows current connection status
- [ ] Tab lists populate correctly
- [ ] Sync operations work as expected
- [ ] WebSocket connections establish properly

### Browser-Specific Testing

**Chrome/Chromium:**
- Test on Chrome, Edge, Brave
- Verify Manifest V3 compatibility
- Check service worker functionality

**Firefox:**
- Test WebExtensions API compatibility
- Verify background script behavior
- Check for Firefox-specific issues

## Production Build

```bash
npm run build
```

Creates optimized packages:
- `packages/canvas-extension-chromium.zip` - For Chrome Web Store
- `packages/canvas-extension-firefox.zip` - For Firefox Add-ons

## Icon Assets

The extension uses `assets/icons/logo-br_64x64.png` as the main logo:
- **64x64 Canvas logo** - Works for all browser icon sizes
- **Automatically scaled** by browsers for toolbar (16px), context menus (32px), management (48px), and store (128px)
- **Consistent branding** with the Canvas project

The 64x64 size provides good quality at all scaling levels while keeping the package size minimal. 
