import React, { useState } from 'react';
import cx from 'classnames';
import styles from "./CanvasToBrowser.module.scss";
import { useSelector } from 'react-redux';
import { setCanvasTabs } from '@/popup/redux/tabs/tabActions';
import { useDispatch } from 'react-redux';
import { Dispatch } from 'redux';
import { updateTabs } from '@/popup/utils';

interface CanvasToBrowserTypes {
}

const CanvasToBrowser: React.FC<CanvasToBrowserTypes> = ({ }) => {
  const canvasTabs = useSelector((state: any) => state.tabs.canvasTabs);
  const dispatch = useDispatch<Dispatch<any>>();

  const removeCanvasToBrowserTabClicked = (tab: chrome.tabs.Tab) => {
    console.log('UI | Close icon clicked: ', tab.url);
    if(!tab.id) return;
    chrome.tabs.remove(tab.id);

    // Remove the tab from the list
    dispatch(setCanvasTabs(canvasTabs.filter((t: chrome.tabs.Tab) => t.id !== tab.id)));
    // setCanvasToBrowserTabsDelta(ctbtd => {
    //   return ctbtd.filter(b => tab.id !== b.id);
    // });
  };

  const openAllClicked = () => {
    console.log('UI | Opening all tabs from canvas');
    chrome.runtime.sendMessage({ action: 'canvas:tabs:openInBrowser' }).then((res) => {
        console.log(res)
        chrome.runtime.sendMessage({ action: 'index:updateBrowserTabs' });
        updateTabs(dispatch);
    }).catch((error) => {
        console.error('UI | Error opening tabs from canvas:', error);
    });
  }

  return (
    <div className="container">
      <h5>Open all tabs
        (<span className="" id="canvas-tab-delta-count">{canvasTabs.length}</span>)
        <span>
          <a className="black white-text waves-effect waves-light btn-small right" onClick={openAllClicked}>Open all<i className="material-icons right">sync</i></a>
        </span>
      </h5>
      <ul className="collection">
        {
          !canvasTabs.length ? 
          (<li className="collection-item">No canvas tabs to sync</li>) : 
          canvasTabs.map((tab: chrome.tabs.Tab, idx: number) => {
            if(!tab.url) return null;
            return <li key={idx + tab.url} className="collection-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <a 
                href={tab.url}
                style={{ textDecoration: "none", flexGrow: "1" }} 
                className="tab-title truncate black-text"
                onClick={(e) => {
                  e.preventDefault();
                  console.log('UI | Tab clicked: ', tab.url);
                }}
              >
                <img 
                  src={tab.favIconUrl || ""}
                  style={{ width: "16px", height: "16px", marginRight: "8px" }}
                />
                {tab.title || ""}
              </a>
              <i 
                className="material-icons"
                style={{ cursor: "pointer" }}
                title="Close tab"
                onClick={(e) => { e.preventDefault(); removeCanvasToBrowserTabClicked(tab); }}
              >close</i>
            </li>
          })
        }
      </ul>
    </div>
  );
};

export default CanvasToBrowser;