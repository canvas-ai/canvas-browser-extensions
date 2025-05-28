import { useState, useEffect } from 'react';
import { browser } from '@/general/utils';

type StorageKey = 'CNVS_USER_INFO' | 'CNVS_CONTEXT' | 'CNVS_SESSION_LIST' | 'CNVS_PINNED_TABS' | 'contexts' | 'sync' | 'transport' | 'session' | 'browserIdentity' | 'CNVS_SELECTED_CONTEXT';

interface StorageDefaults {
  CNVS_USER_INFO: IUserInfo | null;
  CNVS_CONTEXT: IContext | null;
  CNVS_SESSION_LIST: ISession[];
  CNVS_PINNED_TABS: string[];
  contexts: IContext[];
  sync: IConfigProps['sync'] | null;
  transport: IConfigProps['transport'] | null;
  session: IConfigProps['session'] | null;
  browserIdentity: IConfigProps['browserIdentity'] | null;
  CNVS_SELECTED_CONTEXT: IContext | null;
}

const defaultValues: StorageDefaults = {
  CNVS_USER_INFO: null,
  CNVS_CONTEXT: null,
  CNVS_SESSION_LIST: [{ id: "Default", baseUrl: "/" }],
  CNVS_PINNED_TABS: [],
  contexts: [],
  sync: null,
  transport: null,
  session: null,
  browserIdentity: null,
  CNVS_SELECTED_CONTEXT: null
};

export function useStorage<K extends StorageKey>(
  key: K
): [StorageDefaults[K], (value: StorageDefaults[K]) => Promise<void>] {
  const [value, setValue] = useState<StorageDefaults[K]>(defaultValues[key]);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial value
  useEffect(() => {
    const loadValue = async () => {
      try {
        const result = await browser.storage.local.get([key]);
        setValue(result[key] ?? defaultValues[key]);
      } catch (error) {
        console.error(`Error loading ${key} from storage:`, error);
        setValue(defaultValues[key]);
      } finally {
        setIsLoading(false);
      }
    };

    loadValue();
  }, [key]);

  // Listen for storage changes
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      namespace: string
    ) => {
      if (namespace === 'local' && changes[key]) {
        setValue(changes[key].newValue ?? defaultValues[key]);
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [key]);

  // Setter function
  const setStorageValue = async (newValue: StorageDefaults[K]) => {
    try {
      await browser.storage.local.set({ [key]: newValue });
      setValue(newValue);
    } catch (error) {
      console.error(`Error saving ${key} to storage:`, error);
    }
  };

  return [value, setStorageValue];
}

// Convenience hooks for specific storage keys
export const useUserInfo = () => useStorage('CNVS_USER_INFO');
export const useContext = () => useStorage('CNVS_CONTEXT');
export const useSessionList = () => useStorage('CNVS_SESSION_LIST');
export const usePinnedTabs = () => useStorage('CNVS_PINNED_TABS');
export const useContextList = () => useStorage('contexts');
export const useSelectedContext = () => useStorage('CNVS_SELECTED_CONTEXT');


// Config storage hooks
export const useConfigSync = () => useStorage('sync');
export const useConfigTransport = () => useStorage('transport');
export const useConfigSession = () => useStorage('session');
export const useConfigBrowserIdentity = () => useStorage('browserIdentity');

// Composite config hook that combines all config parts
export const useConfig = (): [IConfigProps | null, (config: IConfigProps) => Promise<void>] => {
  const [sync, setSync] = useConfigSync();
  const [transport, setTransport] = useConfigTransport();
  const [session, setSession] = useConfigSession();
  const [browserIdentity, setBrowserIdentity] = useConfigBrowserIdentity();

  // Combine all config parts into a single object
  const config: IConfigProps | null = 
    sync && transport && session && browserIdentity
      ? { sync, transport, session, browserIdentity }
      : null;

  // Setter function that updates all config parts
  const setConfig = async (newConfig: IConfigProps) => {
    await Promise.all([
      setSync(newConfig.sync),
      setTransport(newConfig.transport),
      setSession(newConfig.session),
      setBrowserIdentity(newConfig.browserIdentity)
    ]);
  };

  return [config, setConfig];
}; 