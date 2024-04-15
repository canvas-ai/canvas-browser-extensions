import React, { useState } from 'react';
import styles from "./BrowserToCanvas.module.scss";
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { setBrowserTabs } from '@/popup/redux/tabs/tabActions';
import { Dispatch } from 'redux';
import { browser } from '@/popup/utils';

interface BrowserToCanvasTypes {
}

const BrowserToCanvas: React.FC<BrowserToCanvasTypes> = ({ }) => {
  const browserTabs = useSelector((state: { tabs: ITabsInfo }) => state.tabs.browserTabs);
  const dispatch = useDispatch<Dispatch<any>>();

  const removeBrowserToCanvasTabClicked = (tab: ICanvasTab) => {
    console.log('UI | Close icon clicked: ', tab.url);
    if(!tab.id) return;
    browser.tabs.remove(tab.id);

    // Remove the tab from the list
    dispatch(setBrowserTabs(browserTabs.filter((t: ICanvasTab) => t.id !== tab.id)));
  };

  const syncAllClicked = () => {
    console.log('UI | Syncing all tabs to canvas');
    browser.runtime.sendMessage({ action: 'canvas:tabs:insert' }).then((res) => {
        console.log('UI | Res: ' + res)
        // updateTabs(dispatch);
    }).catch((error) => {
        console.error('UI | Error syncing tabs to canvas:', error);
    });
  }

  const syncTabClicked = (tab: ICanvasTab) => {
    console.log('UI | Syncing a tab to canvas');
    browser.runtime.sendMessage({ action: 'canvas:tabs:insert', tabs: [tab] }).then((res) => {
        console.log('UI | Res: ' + res);
        // updateTabs(dispatch);
    }).catch((error) => {
        console.error('UI | Error syncing tab to canvas:', error);
    });
  }

  return (
    <div className="container">
      <h5>Sync to Canvas
        (<span className="">{browserTabs?.length}</span>)
        <span>
          <a onClick={syncAllClicked}
            className="black white-text waves-effect waves-light btn-small right">
            Sync all
            <i className="material-icons right">sync</i>
          </a>
        </span>
      </h5>
      <ul className="collection">
        {
          !browserTabs?.length ? 
          (<li className="collection-item">No browser tabs to sync</li>) : 
          browserTabs.map((tab: ICanvasTab, idx: number) => {
            if(!tab.url) return null;
            return <li key={idx + tab.url} className="collection-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <a 
                href={tab.url}
                style={{ textDecoration: "none", flexGrow: "1" }} 
                className="tab-title truncate black-text"
                onClick={(e) => {
                  e.preventDefault();
                  if(tab.id) syncTabClicked(tab);
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
    </div>
  );
};

export default BrowserToCanvas;