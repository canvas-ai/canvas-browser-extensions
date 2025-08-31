# TODO

Lets pick a couple of low-hanging fruit for the browser extension codebase:
- Close tab (closing a single tab) nor delete tab should not deselect all previously selected items in the popup/
- Sync selected should also not deactivate the selection, so that we can use Close selected right after sync ()

Generic UX improvements(if possible)
- Right click on a browser tab in browser should support a context options "Insert to Canvas" - submenu should be the context tree for the current workspace
- In the popup, same as above, right click on tab entry should also support "Insert to" with a context tree for the current workspace

# Done

Optional sync settings
- "Sync only tabs for the current browser [toggle]" -> you add client/app/browser-identity-string to the featureArray when fetching tabs
- "Sync only tabs with tag: [tag]" -> you add custom/tag/<tag> to both, when storing and
