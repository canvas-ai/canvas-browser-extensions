---
name: Bug report
about: Create a report to help us improve Canvas Browser Extension
title: '[BUG] '
labels: bug
assignees: ''
---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Open browser extension
2. Navigate to '...'
3. Click on '...'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots/Logs**
If applicable, add screenshots or browser console logs to help explain your problem.

**Environment (please complete the following information):**
 - OS: [e.g. Ubuntu 22.04, macOS 14.1, Windows 11]
 - Browser: [e.g. Chrome 120, Firefox 121, Edge 119]
 - Extension Version: [e.g. v2.0.0 - check in extension settings]
 - Installation method: [e.g. developer mode, browser store]

**Canvas Server Information:**
 - Server URL: [e.g. http://localhost:8001]
 - Server Version: [if known]
 - Authentication method: [e.g. API token]
 - Connection status: [e.g. connected, disconnected, error]

**Extension Configuration:**
```json
// Go to extension settings and copy the connection settings (remove sensitive tokens)
{
  "serverUrl": "http://localhost:8001",
  "apiBasePath": "/rest/v2",
  "browserIdentity": "chrome@workstation",
  "currentContext": "default"
}
```

**Sync Settings:**
- Auto-sync new tabs: [Yes/No]
- Auto-open context tabs: [Yes/No]
- Auto-close removed tabs: [Yes/No]
- Browser-specific sync: [Yes/No]

**Browser Console Logs:**
```
// Open browser DevTools (F12), go to Console tab, and paste any error messages here
```

**Extension Background Script Logs:**
```
// Go to chrome://extensions/, click "Inspect views: service worker" under Canvas Extension
// Paste any error messages from the console here
```

**Additional context**
Add any other context about the problem here, including:
- Does this happen consistently or intermittently?
- Are there specific websites/URLs where this occurs?
- Any recent changes to Canvas server or browser settings? 
