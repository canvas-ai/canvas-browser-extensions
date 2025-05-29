import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RUNTIME_MESSAGES } from '@/general/constants';
import BrowserTabsCollection from '../BrowserTabsCollection';
import { browser } from '@/general/utils';
import { Dispatch } from 'redux';
import { setBrowserTabs, setSyncedBrowserTabs } from '@/popup/redux/tabs/tabActions';
import styles from './BrowserToCanvas.module.scss';

const BrowserToCanvas: React.FC<any> = ({ }) => {
  const tabs = useSelector((state: { tabs: ITabsInfo }) => state.tabs);
  const [checkedBrowserTabs, setCheckedBrowserTabs] = useState<ICanvasTab[]>([]);
  const [checkedSyncedBrowserTabs, setCheckedSyncedBrowserTabs] = useState<ICanvasTab[]>([]);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    syncableBrowser: true,
    syncedBrowser: false
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const dispatch = useDispatch<Dispatch<any>>();

  const syncAllClicked = () => {
    console.log('UI | Syncing all tabs to canvas');
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tabs_insert }).then((res) => {
      console.log('UI | Res: ' + res)
      // updateTabs(dispatch);
    }).catch((error) => {
      console.error('UI | Error syncing tabs to canvas:', error);
    });
  }

  const closeSelectedClicked = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>, closableTabs: ICanvasTab[]) => {
    e.preventDefault();
    closableTabs.forEach(tab => tab.id && browser.tabs.remove(tab.id))

    // Remove the tab from the list
    const updatedBrowserTabs = tabs.browserTabs.filter((t: ICanvasTab) => !closableTabs.some(ct => ct.url === t.url));
    if (updatedBrowserTabs.length !== tabs.browserTabs.length)
      dispatch(setBrowserTabs(updatedBrowserTabs));

    const updatedSyncedBrowserTabs = tabs.syncedBrowserTabs.filter((t: ICanvasTab) => !closableTabs.some(ct => ct.url === t.url));
    if (updatedSyncedBrowserTabs.length !== tabs.browserTabs.length)
      dispatch(setSyncedBrowserTabs(updatedSyncedBrowserTabs));

    setCheckedBrowserTabs([]);
    setCheckedSyncedBrowserTabs([]);
  }

  const syncSelectedClicked = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>, syncableTabs: ICanvasTab[]) => {
    e.preventDefault();
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tabs_insert, tabs: syncableTabs }).then((res) => {
      setCheckedBrowserTabs([]);
      setCheckedSyncedBrowserTabs([]);
      console.log('UI | Res: ' + res);
      // updateTabs(dispatch);
    }).catch((error) => {
      console.error('UI | Error syncing tabs to canvas:', error);
    });
  }

  return (
    <div className={styles.tabCollectionContainer}>
      <div className={styles.header}>
        <h5 className={styles.title}>Sync to Canvas</h5>
        <div className={styles.buttonContainer}>
          <button
            onClick={syncAllClicked}
            className={styles.btn}
          >
            <span>Sync All</span>
            <span className={styles.icon}>↗</span>
          </button>

          {checkedBrowserTabs.length > 0 && (
            <button
              onClick={(e) => syncSelectedClicked(e, checkedBrowserTabs)}
              className={styles.btn}
            >
              <span>Sync Selected</span>
              <span className={styles.icon}>↗</span>
            </button>
          )}

          {(checkedBrowserTabs.length > 0 || checkedSyncedBrowserTabs.length > 0) && (
            <button
              onClick={(e) => closeSelectedClicked(e, [...checkedBrowserTabs, ...checkedSyncedBrowserTabs])}
              className={`${styles.btn} ${styles.btnDestructive}`}
            >
              <span>Close Selected</span>
              <span className={styles.icon}>✕</span>
            </button>
          )}
        </div>
      </div>

      <div className={styles.collapsibleContainer}>
        <div className={styles.collapsibleItem}>
          <div
            className={styles.collapsibleHeader}
            onClick={() => toggleSection('syncableBrowser')}
          >
            <span className={styles.expandIcon}>
              {expandedSections.syncableBrowser ? '▼' : '▶'}
            </span>
            <span className={styles.sectionIcon}>⟲</span>
            <span className={styles.sectionTitle}>
              Syncable Browser Tabs ({tabs.browserTabs.length})
            </span>
          </div>
          {expandedSections.syncableBrowser && (
            <div className={styles.collapsibleContent}>
              <BrowserTabsCollection
                browserTabs={tabs.browserTabs}
                setCheckedTabs={setCheckedBrowserTabs}
                checkedTabs={checkedBrowserTabs}
              />
            </div>
          )}
        </div>

        <div className={styles.collapsibleItem}>
          <div
            className={styles.collapsibleHeader}
            onClick={() => toggleSection('syncedBrowser')}
          >
            <span className={styles.expandIcon}>
              {expandedSections.syncedBrowser ? '▼' : '▶'}
            </span>
            <span className={styles.sectionIcon}>☁</span>
            <span className={styles.sectionTitle}>
              Synced Browser Tabs ({tabs.syncedBrowserTabs.length})
            </span>
          </div>
          {expandedSections.syncedBrowser && (
            <div className={styles.collapsibleContent}>
              <BrowserTabsCollection
                browserTabs={tabs.syncedBrowserTabs}
                setCheckedTabs={setCheckedSyncedBrowserTabs}
                checkedTabs={checkedSyncedBrowserTabs}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrowserToCanvas;
