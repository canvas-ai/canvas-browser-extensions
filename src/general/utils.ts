export const browser: typeof chrome = globalThis.browser || chrome;

export const savePinnedTabsToStorage = (pinnedTabs: string[]) => {
  console.log("saving pinnedTabs to storage...", pinnedTabs);
  return browser.storage.local.set({ "pinnedTabs": pinnedTabs });
};

export const getPinnedTabs = () => {
  return new Promise<string[]>((resolve, reject) => {
    browser.storage.local.get(["pinnedTabs"]).then(storage => {
      resolve(storage.pinnedTabs || []);
    });
  });
}

/**
 * Detect the browser type from user agent
 * @returns {string} - Browser name (chrome, firefox, edge, safari, etc.)
 */
export const detectBrowser = (): string => {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('edg/')) {
    return 'edge';
  } else if (userAgent.includes('chrome/') && !userAgent.includes('edg/')) {
    return 'chrome';
  } else if (userAgent.includes('firefox/')) {
    return 'firefox';
  } else if (userAgent.includes('safari/') && !userAgent.includes('chrome/')) {
    return 'safari';
  } else if (userAgent.includes('opr/') || userAgent.includes('opera/')) {
    return 'opera';
  } else {
    return 'unknown';
  }
};

/**
 * Generate a browser instance name with hostname
 * @returns {string} - Browser instance name like "chrome@hostname"
 */
export const generateBrowserInstanceName = (): string => {
  const browser = detectBrowser();
  const hostname = window.location.hostname || 'local';
  return `${browser}@${hostname}`;
};
