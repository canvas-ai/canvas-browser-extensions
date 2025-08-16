# Browser Extension Sync Settings Test Scenarios

## Prerequisites
1. Extension installed and connected to Canvas server
2. Have at least 2 contexts with different documents/tabs
3. Have at least 2 workspace paths with different documents

## Test Scenarios

### 1. Document Add/Remove WebSocket Events

#### Test 1.1: Auto-Open New Server Tab
**Setting:** `Automatically open new server tab` = ON
**Steps:**
1. From another client/browser, add a new tab document to the current context
2. Observe the extension console logs

**Expected:**
- WebSocket event received: `document.inserted`
- New tab automatically opens in browser
- Console shows: "Opening tab X/Y"

#### Test 1.2: Auto-Close Removed Server Tab  
**Setting:** `Automatically close removed server tab` = ON
**Steps:**
1. Have tabs open that exist in the context
2. From another client, remove/delete tab documents from the context
3. Observe the extension behavior

**Expected:**
- WebSocket event received: `document.removed` or `document.deleted`
- Matching tabs automatically close in browser
- Console shows: "Closing tab: [title] [url]"

### 2. Context Path Changes (Context Mode)

#### Test 2.1: Close Current and Open New
**Setting:** `Context change behavior` = `Close current tabs and open new`
**Steps:**
1. In context mode, have some tabs open
2. Change context URL from `/foo/bar` to `/foo/baz`
3. Observe the behavior

**Expected:**
- Console: "Context URL changed - will fetch documents and apply behavior: close-open-new"
- All current tabs close (except pinned)
- New tabs from `/foo/baz` path open automatically
- Console shows document fetch from API

#### Test 2.2: Keep Current and Open New
**Setting:** `Context change behavior` = `Keep current tabs and open new`
**Steps:**
1. In context mode, have some tabs open
2. Change context URL from `/foo/bar` to `/foo/baz`
3. Observe the behavior

**Expected:**
- Console: "Context URL changed - will fetch documents and apply behavior: keep-open-new"
- Current tabs remain open
- New tabs from `/foo/baz` path open additionally
- Console shows document fetch from API

#### Test 2.3: No Action (Update Indexes Only)
**Setting:** `Context change behavior` = `No action, just update indexes`
**Steps:**
1. In context mode, have some tabs open
2. Change context URL from `/foo/bar` to `/foo/baz`
3. Observe the behavior

**Expected:**
- Console: "Context URL changed - will fetch documents and apply behavior: keep-only"
- No tabs close or open
- Internal indexes updated (visible in console logs)

### 3. Workspace Path Changes (Explorer Mode)

#### Test 3.1: Close Current and Open New
**Setting:** `Context change behavior` = `Close current tabs and open new`
**Steps:**
1. In explorer/workspace mode, have some tabs open
2. Change workspace path from `/foo/bar` to `/foo/baz`
3. Observe the behavior

**Expected:**
- Console: "Workspace path changed - will fetch documents and apply behavior: close-open-new"
- All current tabs close (except pinned)
- New tabs from workspace path `/foo/baz` open automatically
- Console shows document fetch from API with workspace ID and path

#### Test 3.2: Keep Current and Open New
**Setting:** `Context change behavior` = `Keep current tabs and open new`
**Steps:**
1. In explorer/workspace mode, have some tabs open
2. Change workspace path from `/foo/bar` to `/foo/baz`
3. Observe the behavior

**Expected:**
- Console: "Workspace path changed - will fetch documents and apply behavior: keep-open-new"
- Current tabs remain open
- New tabs from workspace path `/foo/baz` open additionally
- Console shows document fetch from API

### 4. Context Switching

#### Test 4.1: Switch Between Different Contexts
**Setting:** `Context change behavior` = `Close current tabs and open new`
**Steps:**
1. Bind to Context A with tabs
2. Switch to Context B (different context ID)
3. Observe the behavior

**Expected:**
- Console: "Context switched - will fetch documents and apply behavior: close-open-new"
- Tabs from Context A close
- Tabs from Context B open
- WebSocket joins new context channel

### 5. Manual Context URL Update

#### Test 5.1: Update URL via Popup
**Steps:**
1. Click on context URL in popup
2. Enter new path
3. Submit the change

**Expected:**
- API call to update context URL
- Sync engine triggered: "Triggering sync engine for manual context URL change"
- Behavior applied based on `contextChangeBehavior` setting
- Tabs updated accordingly

## Debugging Tips

### Check Console Logs
Open browser developer tools and filter for:
- `SyncEngine:`
- `WebSocketClient:`
- `ContextIntegration:`

### Key Log Messages to Look For
1. **Document Events:**
   - "Handling WebSocket event: document.inserted"
   - "Auto-open disabled, skipping remote document"
   - "Closing tab: [title] [url]"

2. **Context Changes:**
   - "Context URL changed - will fetch documents"
   - "Executing context change behavior: [behavior]"
   - "Will fetch documents from backend for context"

3. **API Calls:**
   - "API response for context documents"
   - "API response for workspace documents"
   - "Found X documents to open"

4. **Tab Operations:**
   - "Opening X tabs with rate limiting"
   - "Auto-open is disabled, skipping tab opening"
   - "Closing tab not in context"

### Common Issues and Solutions

1. **Tabs not opening on context change:**
   - Check if `autoOpenNewTabs` is enabled
   - Verify API returns documents (check console for document count)
   - Check for duplicate prevention (pendingTabOpens)

2. **Tabs not closing on removal:**
   - Check if `autoCloseRemovedTabs` is enabled
   - Verify WebSocket events include URL data
   - Check if tabs are pinned (pinned tabs don't close)

3. **Wrong behavior on path change:**
   - Verify `contextChangeBehavior` setting value
   - Check if sync engine is initialized
   - Verify mode (context vs explorer) is correct

4. **WebSocket events not received:**
   - Check WebSocket connection status
   - Verify context/workspace channel joined
   - Check event relevance filtering