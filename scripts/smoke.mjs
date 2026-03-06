import { io } from 'socket.io-client';

const config = {
  serverUrl: (process.env.CANVAS_SERVER_URL || 'http://127.0.0.1:8001').replace(/\/$/, ''),
  apiBasePath: process.env.CANVAS_API_BASE_PATH || '/rest/v2',
  apiToken: process.env.CANVAS_API_TOKEN || '',
  workspace: process.env.CANVAS_WORKSPACE || 'universe',
  timeoutMs: Number(process.env.CANVAS_SMOKE_TIMEOUT_MS || 10000)
};

if (!config.apiToken) {
  console.error('Missing CANVAS_API_TOKEN');
  console.error('Example: CANVAS_SERVER_URL=http://127.0.0.1:8001 CANVAS_API_TOKEN=canvas-... npm run smoke');
  process.exit(1);
}

const apiBaseUrl = `${config.serverUrl}${config.apiBasePath}`;
const uniqueId = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function request(method, path, { token, body } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const headers = {
      Accept: 'application/json'
    };

    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(`${method} ${path} failed with ${response.status}: ${JSON.stringify(data)}`);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function waitForEvent(socket, eventName, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, config.timeoutMs);

    const onEvent = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(eventName, onEvent);
      resolve(payload);
    };

    socket.on(eventName, onEvent);
  });
}

async function connectWorkspaceSocket(token) {
  const socket = io(config.serverUrl, {
    auth: { token },
    transports: ['websocket'],
    timeout: config.timeoutMs,
    reconnection: false
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for websocket subscription')), config.timeoutMs);

    socket.on('connect', () => {
      socket.emit('subscribe', { channel: `workspace:${config.workspace}` });
    });

    socket.on('subscribed', ({ channel }) => {
      if (channel !== `workspace:${config.workspace}`) return;
      clearTimeout(timer);
      resolve();
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    socket.on('error', (payload) => {
      clearTimeout(timer);
      reject(new Error(typeof payload?.message === 'string' ? payload.message : JSON.stringify(payload)));
    });
  });

  return socket;
}

function logStep(label, value) {
  console.log(`- ${label}: ${value}`);
}

let socket;
let insertedDocumentId;
let deleted = false;

try {
  const ping = await request('GET', '/ping');
  logStep('ping', ping?.status || 'ok');

  const profile = await request('GET', '/auth/me', { token: config.apiToken });
  logStep('auth', profile?.payload?.email || 'ok');

  const workspaces = await request('GET', '/workspaces', { token: config.apiToken });
  const workspace = (workspaces?.payload || []).find((item) =>
    item.id === config.workspace || item.name === config.workspace
  );

  if (!workspace) {
    throw new Error(`Workspace "${config.workspace}" not found`);
  }

  logStep('workspace', `${workspace.name} (${workspace.id})`);

  const deviceRegistration = await request('POST', '/auth/devices/register', {
    token: config.apiToken,
    body: {
      name: 'canvas-extension-smoke',
      hostname: 'canvas-extension-smoke',
      type: 'browser'
    }
  });

  const deviceToken = deviceRegistration?.payload?.token;
  if (!deviceToken) {
    throw new Error('Device registration did not return a token');
  }

  logStep('device-token', `${String(deviceToken).slice(0, 16)}...`);

  socket = await connectWorkspaceSocket(deviceToken);
  logStep('websocket', `subscribed to workspace:${config.workspace}`);

  const insertEventPromise = waitForEvent(
    socket,
    'workspace.documents.inserted',
    (payload) => payload?.contextSpec === '/'
  );

  const insertResponse = await request('POST', `/workspaces/${encodeURIComponent(config.workspace)}/documents`, {
    token: deviceToken,
    body: {
      contextSpec: '/',
      featureArray: ['data/abstraction/tab', `tag/${uniqueId}`],
      documents: [{
        schema: 'data/abstraction/tab',
        schemaVersion: '2.0',
        data: {
          url: `https://example.com/${uniqueId}`,
          title: uniqueId,
          timestamp: new Date().toISOString()
        },
        metadata: {
          contentType: 'application/json',
          contentEncoding: 'utf8',
          dataPaths: []
        }
      }]
    }
  });

  insertedDocumentId = Array.isArray(insertResponse?.payload)
    ? insertResponse.payload[0]
    : insertResponse?.payload;

  if (!insertedDocumentId) {
    throw new Error('Insert response did not return a document ID');
  }

  const insertEvent = await insertEventPromise;
  logStep('workspace.documents.inserted', insertEvent?.workspaceId || 'received');

  const listResponse = await request(
    'GET',
    `/workspaces/${encodeURIComponent(config.workspace)}/documents?contextSpec=%2F&featureArray=data%2Fabstraction%2Ftab&featureArray=tag%2F${encodeURIComponent(uniqueId)}`,
    { token: config.apiToken }
  );

  const insertedDocument = (listResponse?.payload || []).find((item) => item.id === insertedDocumentId);
  if (!insertedDocument) {
    throw new Error(`Inserted document ${insertedDocumentId} not found in workspace listing`);
  }

  logStep('workspace list', insertedDocument.data?.url || insertedDocumentId);

  const deleteEventPromise = waitForEvent(
    socket,
    'workspace.documents.deleted',
    (payload) => Array.isArray(payload?.documentIds) && payload.documentIds.includes(insertedDocumentId)
  );

  const deleteResponse = await request('DELETE', `/workspaces/${encodeURIComponent(config.workspace)}/documents`, {
    token: config.apiToken,
    body: [insertedDocumentId]
  });

  deleted = true;

  const deletedIds = deleteResponse?.payload?.successful?.map((item) => item.id) || [];
  if (!deletedIds.includes(insertedDocumentId)) {
    throw new Error(`Delete response did not confirm document ${insertedDocumentId}`);
  }

  const deleteEvent = await deleteEventPromise;
  logStep('workspace.documents.deleted', deleteEvent?.documentIds?.join(', ') || 'received');

  console.log('');
  console.log('Smoke test passed');
  process.exit(0);
} catch (error) {
  console.error('');
  console.error(`Smoke test failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  try {
    socket?.disconnect();
  } catch {}

  if (!deleted && insertedDocumentId) {
    try {
      await request('DELETE', `/workspaces/${encodeURIComponent(config.workspace)}/documents`, {
        token: config.apiToken,
        body: [insertedDocumentId]
      });
    } catch {
      // Cleanup failure is secondary to the actual smoke-test result.
    }
  }
}
