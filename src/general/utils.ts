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
