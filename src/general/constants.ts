export const RUNTIME_MESSAGES = {
  socket_status: "socket:status",
  socket_retry: "socket:retry",
  socket_test: "socket:test",
  socket_test_success: "socket:test:success",
  socket_test_error: "socket:test:error",
  socket_enable_auto_reconnect: "socket:enable_auto_reconnect",
  socket_disable_auto_reconnect: "socket:disable_auto_reconnect",
  socket_force_reconnect: "socket:force_reconnect",
  socket_is_auto_reconnect_enabled: "socket:is_auto_reconnect_enabled",
  config_get: "config:get",
  config_get_item: "config:get:item",
  config_set_item: "config:set:item",
  config_set: "config:set",
  config_set_success: "config:set:success",
  context_list: "context:list",
  context_get: "context:get",
  context_get_url: "context:get:url",
  context_get_path: "context:get:path",
  context_get_pathArray: "context:get:pathArray",
  context_get_color: "context:get:color",
  context_get_tree: "context:get:tree",
  context_set_url: "context:set:url",
  context_refresh_tabs: "context:refresh:tabs",
  context_tab_remove: "context:tab:remove",
  context_tabs_remove: "context:tabs:remove",
  browser_tabs_update: "browser:tabs:update",
  browser_tabs_open: "browser:tabs:open",
  browser_tabs_close: "browser:tabs:close",
  canvas_tabs_fetch: "canvas:tabs:fetch",
  canvas_tabs_refresh: "canvas:tabs:refresh",
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
  opened_canvas_tabs: "opened:canvas:tabs",
  synced_browser_tabs: "synced:browser:tabs",

  socket_event: "socket:event",
  tabs_updated: "tabs:updated",

  update_tabs_list: "update:tabs:list",

  update_sessions_list: "update:sessions:list",

  pinned_tabs_updated: "pinned:tabs:updated",

  user_info: "user:info",

  error_message: "error_message",
  success_message: "success_message"
}

export const SOCKET_EVENTS = {
  connecting: "connecting",
  connect: "connect",
  disconnect: "disconnect",
  connect_error: "connect_error",
  connect_timeout: "connect_timeout",

  authenticated:  "authenticated",
  invalid_token:  "invalid_token"
}

export const SOCKET_MESSAGES = {
  DOCUMENT_CONTEXT: {
    GET:          "context:document:get",
    GET_ARRAY:    "context:document:getArray",
    REMOVE:       "context:document:remove",
    REMOVE_ARRAY: "context:document:removeArray",
    DELETE:       "context:document:delete",
    DELETE_ARRAY: "context:document:deleteArray",
    INSERT:       "context:document:insert",
    INSERT_ARRAY: "context:documents:insert",
    INSERT_ARRAY_RESULT: "context:documents:insert:result",
    UPDATE:       "context:document:update",
    UPDATE_ARRAY: "context:documents:update",
    LIST:         "context:documents:list",
    LIST_RESULT:  "context:documents:list:result"
  },

  DOCUMENT: {
    GET:          "document:get",
    GET_ARRAY:    "document:getArray",
    REMOVE:       "document:remove",
    REMOVE_ARRAY: "document:removeArray",
    DELETE:       "document:delete",
    DELETE_ARRAY: "document:deleteArray",
    INSERT:       "document:insert",
    INSERT_ARRAY: "document:insertArray"
  },

  CONTEXT: {
    GET:          "context:get",
    LIST:         "context:list",
    GET_URL:      "context:url:get",
    SET_URL:      "context:url:set",
    CREATED:      "context:created",
    UPDATED:      "context:updated",
    LOCKED:       "context:locked",
    UNLOCKED:     "context:unlocked",
    DELETED:      "context:deleted",
    ACL_UPDATED:  "context:acl:updated",
    ACL_REVOKED:  "context:acl:revoked"
  },

  SCHEMAS: {
    GET:          "schemas:get"
  },

  SESSION: {
    CREATE:       "session:create",
    LIST:         "session:list",
    LIST_ACTIVE:  "session:list:active",
    GET:          "session:get",
    GET_ID:       "session:get:id",
    REMOVE:       "session:remove",
    OPEN:         "session:open",
    CLOSE:        "session:close",
    DELETE:       "session:delete",

    CONTEXT: {
      LIST:       "session:context:list",
      GET:        "session:context:get",
      GET_ID:     "session:context:get:id",
      CREATE:     "session:context:create",
      REMOVE:     "session:context:remove"
    }
  }
}

export const DEFAULT_SESSION = {
  id: 'default',
  baseUrl: '/'
}
