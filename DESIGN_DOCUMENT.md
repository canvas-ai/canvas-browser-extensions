Lets build a "as simple as possible but not simpler" Canvas Browser Extension v2.0

Goal: Seamlessly sync browser tabs with a canvas-server instance, binding the browser to a user-defined "context" via REST + WebSocket (socket.io).
Target Platforms: Chromium-based browsers & Firefox

# Core Features

- Connect to a canvas-server instance.
- Bind to a context (create one if needed).
- Sync tabs in real-time between browser and canvas-server.
- Use REST API for data ops, WebSocket (socket.io) for live updates.
- All UI elements build with shadcn(https://ui.shadcn.com/), a basic, clean, minimalistic black-and-white theme

# Sync Behavior Configurable via Settings and popup

Sync Settings / popup toggles:
- Save newly opened tabs: toggle [auto/manual] (make sure we save only valid pages, so no "newtab", blank or internal pages
- Open newly added tabs from context: toggle [auto/manual]
- Close removed tabs: toggle [auto/manual]
- Sync only tabs for the current browser id [yes/no], will add 'client/app/id/browser-id' to the feature array GET query
- On Context Change:
  - Close current and open new
  - Save & close current, open new
  - Keep current, open new
  - Keep current, don't open new

# Tab Management UI

## Popup

### Popup header (above tabs)

- Extension logo (from /assets/icons)
- Connection status (green/red dot)
- Bound context (context.id) context.url

### BrowserToCanvas
 - Contains all tabs that are open in the current browser and not synced yet
 - Clicking on a list item would sync it to canvas-server
 - Clicking on the "close" icon would close that tab in the browser
 - Selecting multiple items and clicking on "Sync selected tabs" would send them to canvas-server
 - "Close selected tabs" would close all selected tabs
 - Sync all / close all - self-explanatory
 - Every line would also contain a "Pin tab" pin button, if a tab is pinned, it would not get auto-closed on context changes or removal from server(lets say a podcast you want to listen to while context-switching between tasks
 - Extending the list would show all open browser tabs

### CanvasToBrowser
 - Default list contained all tabs in the current context that are not yet open in the browser
  - Clicking an item would open that tab in browser and remove it from the list
  - Clicking the "Remove" button would remove that tab from the current context
  - Clicking the red "Delete" button would delete that tab from the database completely
  - Toggle to see all canvas tabs (whether open or not) for the current context

### Sync Settings

- UI Toggles as defined in # Sync Behavior
  
### Search

- For fuzzy search all synced tab titles
- Each list item: URL + favicon + title + control buttons (pin, sync, close, etc.)

### Settings button 

- To open the main settings view page

## Settings View
(Should be a dedicated browser tab/page, not just popup due to complexity)

1. Connection Settings
- Browser identity (e.g., firefox@work, chrome@ws1)
- Canvas server URL: defaults to http://127.0.0.1:8001
- REST API base path: defaults to /rest/v2
- API Token (stored securely via browser.storage API)
- [Connect / Disconnect] button
- Once connected(both, rest/v2/ping - unauthenticated endpoint - was reachable and rest/v2/auth/me returned the current user information), fetch available contexts via /rest/v2/contexts and ask the user to bind to a context or create a new one, defaut text should have the browser identity defined earlier).
- Show green/red indicator + display (context.id) context.url on connect

2. Sync Settings (described above)
Unified with Connection Settings in a single page
Save button persists all settings

The settings view page should open automatically if no settings are stored yet
We should place a Settings icon button in the popup to access this page

## (optional, lets implement this later) Separate tab manager page

Consider a "midnight-commander" style interface with two panes

Left: Browser tabs not in Browser but not in Canvas
Right: Canvas tabs not in Browser

Bottom bar with actions:
Left: Sync, Close, pin/unpin, Show all
Right: Open, Remove, Delete, Show all

Actions possible for selections / all items

# Implementation details

## WebSockets:

- data events related to 'data/abstraction/tab' data.schema and the current context (inserted, updated, removed, deleted)
- extension is always bound to a canvas-server context, hence should only listen on the context channel
- context url changes, at which point we should re-fetch all tabs from canvas-server and process them accordingly, updating all our internal indexes if necessary
- Auto-retry with exponential backoff, show "connecting…" in popup
- Re-fetch context if reconnect successful

If sync-new is enabled, push new tab (non-internal, loaded) to canvas-server
-Remove from canvas if removed locally, depending on sync mode

## Refinements

- Use Manifest V3
- Use background service workers, not persistent background pages
- Use chrome.storage.local for settings
- Payload sample in PAYLOAD.md
- featureArray should contain ['data/abstraction/tab', 'client/app/firefox'] or client/app/chrome depending on the browser
- If a custom identifier is set

## Tab Identification

- Track synced tabs using tabId + url or a hash of url+title to avoid false duplicates
- Storing tabs should always populate the featureArray as follows:
  - ['data/abstraction/tab']
  - We should always add client/app/firefox or client/app/chrome etc
  - We should always add 'tag/user-defined-instance-id'
  - On retrieval, we should only use 'data/abstraction/tab' unless "Sync only tabs for the current browser id" is set
- We should store the following details in canvas-server
```
  return {
    id: tab.id,
    index: tab.index,
    highlighted: tab.highlighted,
    active: tab.active,
    pinned: tab.pinned,
    discarded: true, // tab.discarded,
    incognito: tab.incognito,
    audible: tab.audible,
    mutedInfo: tab.mutedInfo,
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl
  }
```

## Fuzzy Search

- Fuse.js (tiny, no external deps, perfect for fuzzy searching tab titles)

## Security Considerations

- Strict Content Security Policy (CSP)
- Sanitize and validate all incoming tab data
