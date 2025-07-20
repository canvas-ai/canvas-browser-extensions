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

### Method 1: Download Release Package (Recommended)

**No build tools required!** Download the latest release for your browser:

| Browser | Download |
|---------|----------|
| **Chromium-based** (Chrome, Edge, Brave, Opera) | [📦 canvas-extension-chromium.zip](https://github.com/canvas-ai/canvas-server/releases/latest) |
| **Firefox** | [📦 canvas-extension-firefox.zip](https://github.com/canvas-ai/canvas-server/releases/latest) |

**Installation steps:**

**Chromium browsers (Chrome, Edge, Brave, etc.):**
1. Download the Chromium package
2. Extract the ZIP file
3. Open `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked"
6. Select the extracted folder

**Firefox:**
1. Download the Firefox package
2. Extract the ZIP file
3. Open `about:debugging`
4. Click "This Firefox"
5. Click "Load Temporary Add-on"
6. Select the `manifest.json` file from the extracted folder

### Method 2: Browser Store Installation (Coming Soon)

🚀 **Canvas Browser Extension will be available on official browser stores soon:**

- **Chrome Web Store** - *Coming soon*
- **Firefox Add-ons (AMO)** - *Coming soon*
- **Edge Add-ons** - *Coming soon*

Store versions will offer automatic updates and simplified installation.

### Method 3: Development Installation

For developers and testing:

1. **Install dependencies** (from browser extension directory):
   ```bash
   cd src/ui/browser-extension
   npm install
   ```

2. **Build the extension**:
   ```bash
   # Development build (unminified, with console logs)
   npm run build:dev
   
   # Production build (minified, optimized)
   npm run build
   ```

3. **Load in browser** (same steps as Method 1, but use `packages/chromium/` or `packages/firefox/` directories)

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

## Releases and Distribution

Canvas Browser Extension uses automated GitHub Actions to build and distribute cross-platform packages. Every time a version tag is pushed, the system automatically:

- 🏗️ **Builds packages** for Chromium and Firefox browsers
- 🧪 **Tests all packages** to ensure they work correctly
- 📦 **Creates release packages** with proper naming and compression
- 🔐 **Generates checksums** for security verification
- 🚀 **Publishes to GitHub Releases** with comprehensive release notes

### Verifying Downloads

For security, always verify your downloads using the provided checksums:

```bash
# Download checksums.txt from the release page
sha256sum -c checksums.txt
```

### Release History

See the [GitHub Releases page](https://github.com/canvas-ai/canvas-server/releases) for complete release history, changelogs, and older versions.

## Security

- **API tokens** stored securely via browser storage APIs
- **Strict Content Security Policy** prevents code injection
- **Input validation** and sanitization on all user inputs
- **HTTPS-only communication** in production environments
- **Manifest V3 compliance** for modern security standards
- **Minimal permissions** - only requests necessary browser permissions

## Browser Compatibility

- **Chrome**: v88+
- **Edge**: v88+
- **Firefox**: v109+
- **Brave**: v1.20+
- **Opera**: v74+

## Troubleshooting

### Connection Issues

1. **Check Canvas server status**:
   - Ensure Canvas server is running and accessible
   - Verify the server URL in extension settings
   - Test API connectivity from the settings page

2. **Verify API token**:
   - Generate a new API token in Canvas web interface
   - Ensure token has appropriate permissions
   - Update token in extension settings

3. **Debug extension**:
   - Open browser DevTools (F12) and check Console for errors
   - Go to `chrome://extensions/` and click "Inspect views: service worker"
   - Check extension popup for error messages

### Sync Issues

1. **Check sync settings** in the extension popup
2. **Verify context binding** - ensure extension is bound to correct context
3. **Test with manual sync** to isolate automatic sync issues

For more help, see our [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) for comprehensive debugging information.

## License

Licensed under AGPL-3.0-or-later. See main project LICENSE file. 
