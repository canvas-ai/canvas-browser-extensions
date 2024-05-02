export const RUNTIME_MESSAGES = {
  socket_status: 'socket:status',
  config_get: 'config:get',
  config_get_item: 'config:get:item',
  config_set_item: 'config:set:item',
  context_get: 'context:get',
  context_get_url: 'context:get:url',
  context_get_path: 'context:get:path',
  context_get_pathArray: 'context:get:pathArray',
  context_get_color: 'context:get:color',
  context_get_tree: 'context:get:tree',
  context_set_url: 'context:set:url',
  context_tab_remove: 'context:tab:remove',
  browser_tabs_update: 'browser:tabs:update',
  browser_tabs_open: 'browser:tabs:open',
  browser_tabs_close: 'browser:tabs:close',
  canvas_tabs_fetch: 'canvas:tabs:fetch',
  canvas_tabs_openInBrowser: 'canvas:tabs:openInBrowser',
  canvas_tabs_insert: 'canvas:tabs:insert',
  canvas_tab_insert: 'canvas:tab:insert',
  canvas_tab_delete: 'canvas:tab:delete',
  index_get_counts: 'index:get:counts',
  index_get_browserTabArray: 'index:get:browserTabArray',
  index_get_canvasTabArray: 'index:get:canvasTabArray',
  index_get_deltaBrowserToCanvas: 'index:get:deltaBrowserToCanvas',
  index_get_deltaCanvasToBrowser: 'index:get:deltaCanvasToBrowser',
  index_updateBrowserTabs: 'index:updateBrowserTabs',
  index_clear: 'index:clear',
  socket_retry: 'socket:retry',

  socket_event: 'socket:event',
  tabs_updated: 'tabs:updated',

  error_message: 'error_message',
  success_message: 'success_message'
}

export const SOCKET_EVENTS = {
  connecting: 'connecting',
  connect: 'connect',
  disconnect: 'disconnect',
  connect_error: 'connect_error',
  connect_timeout: 'connect_timeout',

  authenticated: "authenticated",
  invalid_token: "invalid_token"
}

export const SOCKET_MESSAGES = {
  DOCUMENT: {
    GET: "context:document:get",
    GET_ARRAY: "context:document:getArray",
    REMOVE: "context:document:remove",
    DELETE: "context:document:delete",
    INSERT: "context:document:insert",
    INSERT_ARRAY: "context:document:insertArray"
  },

  CONTEXT: {
    GET_URL: "context:get:url",
    SET_URL: "context:set:url"
  },

  SCHEMAS: {
    GET: "schemas:get"
  }
}