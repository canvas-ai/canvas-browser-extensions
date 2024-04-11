const store = chrome.storage.local;

export const DEFAULT_CONFIG: {
  sync: IConfig["sync"],
  session: IConfig["session"],
  transport: IConfig["transport"]
} = {
  sync: {
    autoSyncBrowserTabs: "Never",
    autoOpenCanvasTabs: "Never",
    autoRestoreSession: true,
    autoSaveSession: true,
    autoOpenTabs: true,
    autoCloseTabs: true,
    // autoCloseTabsBehavior:
    // - saveToCurrentContext
    // - saveToNewContext
    // - saveToTrash
    // - saveToUniverse
    // - ignore (leave open, do not sync to Canvas)
    autoCloseTabsBehavior: 'ignore'
  },
  session: {},
  transport: {
    protocol: 'http',
    host: '127.0.0.1',
    port: 8002,
    token: 'canvas-socketio-token',
    pinToContext: '/'
  }
};

class Config {
  sync: IConfig["sync"];
  session: IConfig["session"];
  transport: IConfig["transport"];

  constructor() {
    this.sync = DEFAULT_CONFIG.sync;
    this.session = DEFAULT_CONFIG.session;
    this.transport = DEFAULT_CONFIG.transport;

    this.initialize();
  }

  async set(key: string, value: any) {
    this[key] = value;
    await store.set({ [key]: value });
    return this[key];
  }

  get(key: string) {
    return this[key];
  }

  initialize() {
    return new Promise((res) => {
      store.get(['sync', 'transport', 'session']).then((cfg: any) => {
        Object.keys(cfg).forEach(key => {
          config[key] = cfg[key] || config[key];
        });
        res(true);
      });
    })
  }

  allProps() {
    return {
      sync: this.sync,
      session: this.session,
      transport: this.transport
    }
  }
}

const config = new Config();

export default config;
