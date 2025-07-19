# Canvas Browser Extension v2.0

A browser extension for seamlessly syncing browser tabs with Canvas server contexts. Extension allows you to connect several users / browsers / applications to a single shared context and working with tabs collaboratively.

## Features

- **Real-time synchronization** between browser tabs and Canvas server contexts
- **Configurable sync behaviors** (auto-sync new tabs, auto-open context tabs, etc.)
- **Context binding** for organizing tabs by project/workspace
- **Cross-browser support** (Chromium-based browsers & Firefox)
- **WebSocket integration** for live updates
- **Secure API token authentication**

## Installation

### Development Installation

1. **Install dependencies** (from browser extension directory):
   ```bash
   cd src/ui/browser-extension
   npm install
   ```

2. **Build the extension**:
   ```bash
   # Development build (unminified, with console logs)
   npm run dev
   
   # Production build (minified, optimized)
   npm run build
   ```

3. **Load in browser**:

   **Chromium browsers (Chrome, Edge, Brave, etc.):**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `packages/chromium/` directory

   **Firefox:**
   - Open `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select the `packages/firefox/manifest.json` file

4. **Extension logo**: 
   - The extension uses `assets/icons/logo-br_64x64.png` as the main logo
   - This 64x64 Canvas logo works for all icon sizes in the browser

### Production Installation

*Coming soon: Extension will be published to browser stores*

## Setup

1. **Install and run Canvas server** (see main project README)

2. **Generate API token**:
   - Open Canvas web interface (usually http://127.0.0.1:8001)
   - Choose API Tokens on the left sidebar
   - Create new token with appropriate permissions

3. **(Optional) Generate a adhoc context and context api keys to share with others**

4. **Configure extension**:
   - Click extension icon in browser toolbar
   - Click Settings button (opens new tab)
   - Enter server URL and API token
   - Test connection and bind to a context

## Sync Behaviors

Configure in Settings page:

- **Auto-sync new tabs**: Automatically save new browser tabs to Canvas
- **Auto-open context tabs**: Automatically open new context tabs in browser
- **Auto-close removed tabs**: Close browser tabs when removed from context
- **Browser-specific sync**: Only sync tabs from this browser instance
- **Context change behavior**: What to do when switching contexts

## Browser Compatibility

- **Chrome**: v88+
- **Edge**: v88+
- **Firefox**: v109+
- **Brave**: v1.20+
- **Opera**: v74+

## Security

- API tokens stored securely via browser storage
- Strict Content Security Policy
- Input validation and sanitization
- HTTPS-only communication in production

## License

See main project LICENSE file. 
