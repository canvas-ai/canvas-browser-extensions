import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RUNTIME_MESSAGES } from '@/general/constants';
import BrowserTabsCollection from '../BrowserTabsCollection';
import { browser } from '@/general/utils';
import { Dispatch } from 'redux';
import { setBrowserTabs, setSyncedBrowserTabs } from '@/popup/redux/tabs/tabActions';

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

  const closeSelectedClicked = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, closableTabs: ICanvasTab[]) => {
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

  const syncSelectedClicked = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, syncableTabs: ICanvasTab[]) => {
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
    <div className="tab-collection-container">
      <h5>Sync to Canvas</h5>
      <div className="button-container">
        <a onClick={syncAllClicked}
          className="black white-text waves-effect waves-light btn-small right">
          Sync all
          <i className="material-icons right">sync</i>
        </a>
        {checkedBrowserTabs.length ? (
          <a onClick={(e) => syncSelectedClicked(e, checkedBrowserTabs)}
            className="black white-text waves-effect waves-light btn-small right" style={{ marginRight: "5px" }}>
            Sync selected
            <i className="material-icons right">sync</i>
          </a>
        ) : null}
        {checkedBrowserTabs.length || checkedSyncedBrowserTabs.length ? (
          <a onClick={(e) => closeSelectedClicked(e, [...checkedBrowserTabs, ...checkedSyncedBrowserTabs])}
            className="black white-text waves-effect waves-light btn-small right" style={{ marginRight: "5px" }}>
            Close selected
            <i className="material-icons right">close</i>
          </a>
        ) : null}
      </div>
      <div className="collapsible-container">
        <div className="collapsible-item">
          <div 
            className="collapsible-header"
            onClick={() => toggleSection('syncableBrowser')}
          >
            <span className="material-icons">
              {expandedSections.syncableBrowser ? 'expand_more' : 'chevron_right'}
            </span>
            <span className="material-icons">sync</span>
            <span>Syncable Browser Tabs ({tabs.browserTabs.length})</span>
          </div>
          {expandedSections.syncableBrowser && (
            <div className="collapsible-content">
              <BrowserTabsCollection
                browserTabs={tabs.browserTabs}
                setCheckedTabs={setCheckedBrowserTabs}
                checkedTabs={checkedBrowserTabs}
              />
            </div>
          )}
        </div>

        <div className="collapsible-item">
          <div 
            className="collapsible-header"
            onClick={() => toggleSection('syncedBrowser')}
          >
            <span className="material-icons">
              {expandedSections.syncedBrowser ? 'expand_more' : 'chevron_right'}
            </span>
            <span className="material-icons">cloud_sync</span>
            <span>Synced Browser Tabs ({tabs.syncedBrowserTabs.length})</span>
          </div>
          {expandedSections.syncedBrowser && (
            <div className="collapsible-content">
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