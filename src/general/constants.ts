export const RUNTIME_MESSAGES = {
  socket_status: "socket:status",
  config_get: "config:get",
  config_get_item: "config:get:item",
  config_set_item: "config:set:item",
  config_set: "config:set",
  context_get: "context:get",
  context_get_url: "context:get:url",
  context_get_path: "context:get:path",
  context_get_pathArray: "context:get:pathArray",
  context_get_color: "context:get:color",
  context_get_tree: "context:get:tree",
  context_set_url: "context:set:url",
  context_tab_remove: "context:tab:remove",
  context_tabs_remove: "context:tabs:remove",
  browser_tabs_update: "browser:tabs:update",
  browser_tabs_open: "browser:tabs:open",
  browser_tabs_close: "browser:tabs:close",
  canvas_tabs_fetch: "canvas:tabs:fetch",
  canvas_tabs_openInBrowser: "canvas:tabs:openInBrowser",
  canvas_tabs_insert: "canvas:tabs:insert",
  canvas_tab_insert: "canvas:tab:insert",
  canvas_tab_delete: "canvas:tab:delete",
  canvas_tabs_delete: "canvas:tabs:delete",
  index_get_counts: "index:get:counts",
  index_get_browserTabArray: "index:get:browserTabArray",
  index_get_canvasTabArray: "index:get:canvasTabArray",
  index_get_deltaBrowserToCanvas: "index:get:deltaBrowserToCanvas",
  index_get_deltaCanvasToBrowser: "index:get:deltaCanvasToBrowser",
  index_updateBrowserTabs: "index:updateBrowserTabs",
  index_clear: "index:clear",
  socket_retry: "socket:retry",
  opened_canvas_tabs: "opened:canvas:tabs",
  synced_browser_tabs: "synced:browser:tabs",

  socket_event: "socket:event",
  tabs_updated: "tabs:updated",

  update_tabs_list: "update:tabs:list",

  update_sessions_list: "update:sessions:list",

  pinned_tabs_updated: "pinned:tabs:updated",

  error_message: "error_message",
  success_message: "success_message",
  user_contexts_list_updated: "user:contexts:list:updated"
}

export const SOCKET_EVENTS = {
  connecting: "connecting",
  connect: "connect",
  disconnect: "disconnect",
  connect_error: "connect_error",
  connect_timeout: "connect_timeout",

  // Server WS_EVENTS
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED:  "authenticated",
  ERROR: 'error',

  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  SUBSCRIBED: 'subscribed',
  UNSUBSCRIBED: 'unsubscribed',

  WORKSPACE_UPDATED: 'workspace:updated',
  WORKSPACE_CREATED: 'workspace:created',
  WORKSPACE_DELETED: 'workspace:deleted',
  WORKSPACE_STATUS_CHANGED: 'workspace:status:changed',
  WORKSPACE_TREE_UPDATED: 'workspace:tree:updated',

  CONTEXT_CREATED: 'context:created',
  CONTEXT_UPDATED: 'context:updated',
  CONTEXT_DELETED: 'context:deleted',
  CONTEXT_URL_CHANGED: 'context:url:changed',
  CONTEXT_LOCKED: 'context:locked',
  CONTEXT_UNLOCKED: 'context:unlocked',
  CONTEXT_ACL_UPDATED: 'context:acl:updated',
  CONTEXT_ACL_REVOKED: 'context:acl:revoked',

  // Document events (broadcasted to context)
  DOCUMENT_INSERT: 'document:insert',
  DOCUMENT_UPDATE: 'document:update',
  DOCUMENT_REMOVE: 'document:remove',
  DOCUMENT_DELETE: 'document:delete',
  DOCUMENTS_DELETE: 'documents:delete',

  // Client-side only or legacy events should be removed or commented out
  // invalid_token:  "invalid_token"
}

export const SOCKET_MESSAGES = {
  DOCUMENT_CONTEXT: {
    GET:          "context:document:get",
    INSERT:       "context:document:insert",
    UPDATE:       "context:document:update",
    REMOVE:       "context:document:remove",
    DELETE:       "context:document:delete",
    INSERT_ARRAY: "context:documents:insert",
    UPDATE_ARRAY: "context:documents:update",
    REMOVE_ARRAY: "context:documents:remove",
    DELETE_ARRAY: "context:documents:delete"
  },
  CONTEXT: {
    GET:          "context:get",
    GET_URL:      "context:url:get",
    SET_URL:      "context:url:set",
    // Removed GET_STATS as not present in server
  },
  // Remove unused DOCUMENT and SESSION blocks for clarity, or keep if still used elsewhere
}

export const DEFAULT_SESSION = {
  id: 'default',
  baseUrl: '/'
}
