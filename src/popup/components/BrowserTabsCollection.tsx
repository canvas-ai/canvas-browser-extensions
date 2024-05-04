import React from 'react';
import { browser } from '../utils';
import { RUNTIME_MESSAGES } from '@/general/constants';
import { useDispatch } from 'react-redux';
import { Dispatch } from 'redux';
import { setBrowserTabs } from '../redux/tabs/tabActions';

interface BrowserTabsCollectionTypes {
  browserTabs: ICanvasTab[]
}

const BrowserTabsCollection: React.FC<BrowserTabsCollectionTypes> = ({ browserTabs }) => {
  const dispatch = useDispatch<Dispatch<any>>();
  
  const removeBrowserToCanvasTabClicked = (tab: ICanvasTab) => {
    console.log('UI | Close icon clicked: ', tab.url);
    if(!tab.id) return;
    browser.tabs.remove(tab.id);

    // Remove the tab from the list
    dispatch(setBrowserTabs(browserTabs.filter((t: ICanvasTab) => t.id !== tab.id)));
  };
  
  const syncTabClicked = (tab: ICanvasTab) => {
    console.log('UI | Syncing a tab to canvas');
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tab_insert, tab }).catch((error) => {
        console.error('UI | Error syncing tab to canvas:', error);
    });
  }

  return (
    <ul className="collection">
      {
        !browserTabs?.length ?
          (<li className="collection-item">No browser tabs found</li>) :
          browserTabs.map((tab: ICanvasTab, idx: number) => {
            if (!tab.url) return null;
            return <li key={idx + tab.url} className="collection-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <a
                href={tab.url}
                style={{ textDecoration: "none", flexGrow: "1" }}
                className="tab-title truncate black-text"
                onClick={(e) => {
                  e.preventDefault();
                  if (tab.id) syncTabClicked(tab);
                  console.log('UI | Tab clicked: ', tab.url);
                }}
              >
                <img
                  src={tab.favIconUrl || ""}
                  style={{ width: "16px", height: "16px", marginRight: "8px" }}
                />
                {tab.title || ""}
              </a>
              <span className="icons">
                <i
                  className="material-icons"
                  style={{ cursor: "pointer" }}
                  title="Close tab"
                  onClick={(e) => { e.preventDefault(); removeBrowserToCanvasTabClicked(tab); }}
                >close</i>
              </span>
            </li>
          })
      }
    </ul>
  )
}

export default BrowserTabsCollection;