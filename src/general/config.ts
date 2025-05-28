import { DEFAULT_SESSION } from "./constants";
import { browser } from "./utils";

const store = browser.storage.local;

export const DEFAULT_CONFIG: {
  sync: IConfig["sync"],
  session: IConfig["session"],
  transport: IConfig["transport"],
  browserIdentity: IConfig["browserIdentity"]
} = {
  sync: {
    tabBehaviorOnContextChange: "Keep",
    autoOpenCanvasTabs: false
  },
  browserIdentity: {
    syncOnlyTaggedTabs: false,
    browserTag: ""
  },
  session: DEFAULT_SESSION,
  transport: {
    protocol: 'http',
    host: '127.0.0.1',
    port: 8001,
    token: 'canvas-a3ec3d9347f0a99298e519ea8310d0c75367acd2b46f752b',
    pinToContext: '/',
    isApiToken: true
  }
};

class Config {
  sync: IConfig["sync"];
  session: IConfig["session"];
  transport: IConfig["transport"];
  browserIdentity: IConfig["browserIdentity"]

  constructor() {
    this.sync = DEFAULT_CONFIG.sync;
    this.session = DEFAULT_CONFIG.session;
    this.transport = DEFAULT_CONFIG.transport;
    this.browserIdentity = DEFAULT_CONFIG.browserIdentity;

    this.load();
  }

  async set(key: string, value: any) {
    this[key] = value;
    await store.set({ [key]: value });
    return this[key];
  }

  async setMultiple(cfg: IConfigProps) {
    const items = Object.keys(cfg);
    while(items.length && await (async (key) => {
      await config.set(key, cfg[key]);
      return true;
    })(items.pop() as string));
  }

  get(key: string) {
    return this[key];
  }

  load() {
    return new Promise((res) => {
      store.get(['sync', 'transport', 'session', 'browserIdentity'], (cfg: any) => {
        Object.keys(cfg).forEach(key => {
          this[key] = cfg[key] || this[key] || DEFAULT_CONFIG[key];
        });
        res(true);
      });
    })
  }

  allProps() {
    return {
      sync: this.sync,
      session: this.session,
      browserIdentity: this.browserIdentity,
      transport: this.transport
    }
  }
}

const config = new Config();

export default config;
