import config from '@/general/config';
import io, { ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import { canvasFetchContext, canvasFetchContextUrl, canvasFetchTabsForContext, canvasInsertTabArray } from './canvas';
import index from './TabIndex';
import { setContextUrl, updateContext } from './context';
import { browser, sendRuntimeMessage } from './utils';
import { RUNTIME_MESSAGES, SOCKET_EVENTS } from '@/general/constants';

const socketOptions: Partial<ManagerOptions & SocketOptions> = { 
  withCredentials: true,
  upgrade: false,
  secure: false,
  transports: ['websocket'],
  auth: { token: config.transport.token } 
};

class MySocket {
  socket: Socket;
  constructor() {
    this.socket = io(this.connectionUri(), socketOptions).connect();
    this.initializeSocket(false);
  }

  connect() {
    this.socket = io(this.connectionUri(), socketOptions).connect();
  }

  connectionUri() {
    return `${config.transport.protocol}://${config.transport.host}:${config.transport.port}`;
  }

  reconnect() {
    // this.sendSocketEvent(SOCKET_EVENTS.connecting);
    if (this.socket) this.socket.disconnect();
    this.connect();
  }
  
  initializeSocket(reconn = true) {
    if(reconn) this.reconnect();
  
    this.socket.on('connect', () => {
      console.log('background.js | [socket.io] Browser Client connected to Canvas');
  
      this.sendSocketEvent(SOCKET_EVENTS.connect);

      canvasFetchContextUrl().then((url: string) => {
        console.log('background.js | [socket.io] Received context url: ', url);
        updateContext({ url, color: "#fff" });
      });

      canvasFetchTabsForContext().then((res: any) => {
        if (!res || res.status !== 'success') {
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.error_message, payload: 'Error fetching tabs from Canvas'}); 
          return console.log('ERROR: background.js | Error fetching tabs from Canvas');
        }
        console.log("recieved canvas tabs array", res.data);
        index.insertCanvasTabArray(res.data);
      }).then(() => {
        index.updateBrowserTabs().then(() => {
          console.log('background.js | Index updated: ', index.counts());
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.index_get_deltaBrowserToCanvas, payload: index.deltaBrowserToCanvas() });
          sendRuntimeMessage({ type: RUNTIME_MESSAGES.index_get_deltaCanvasToBrowser, payload: index.deltaCanvasToBrowser() });
        })
      });
  
      this.socket.emit("authenticate", { token: config.transport.token }, result => {
        if (result === 'success') {
          console.log('background.js | [socket.io] Authenticated successfully!');
          this.sendSocketEvent(SOCKET_EVENTS.authenticated);

          // on authenticate...
  
        } else {
          console.log('background.js | [socket.io] Invalid auth token! disconnecting...');
          this.sendSocketEvent(SOCKET_EVENTS.invalid_token);
          this.socket.disconnect();
        }
      });
    });
  
    this.socket.on('connect_error', (error) => {
      this.sendSocketEvent(SOCKET_EVENTS.connect_error);
      console.log(`background.js | [socket.io] Browser Connection to "${this.connectionUri()}" failed`);
      console.log("ERROR: " + error.message);
    });
    
    this.socket.on('connect_timeout', () => {
      this.sendSocketEvent(SOCKET_EVENTS.connect_timeout);
      console.log('background.js | [socket.io] Canvas Connection Timeout');
    });
  
    this.socket.on('disconnect', () => {
      this.sendSocketEvent(SOCKET_EVENTS.disconnect);
      console.log('background.js | [socket.io] Browser Client disconnected from Canvas');
    });

    this.socket.on('context:url', setContextUrl);
  }

  sendSocketEvent(e: string) {
    browser.runtime.sendMessage({ type: RUNTIME_MESSAGES.socket_event, payload: { event: e } }, (response) => {
      if (browser.runtime.lastError) {
        console.log(`background.js | Unable to connect to UI, error: ${browser.runtime.lastError}`);
      } else {
        console.log('background.js | Message to UI sent successfully');
      }
    });
  }  

  emit(...args: any) {
    return this.socket.emit(args[0], args[1], args[2]);
  }

  isConnected() {
    return this.socket.connected;
  }
}

let socket: MySocket;

export const getSocket = async () => {
  await config.initialize();
  if(socket) return socket;
  socket = new MySocket();
  return socket;
}

export default MySocket;
