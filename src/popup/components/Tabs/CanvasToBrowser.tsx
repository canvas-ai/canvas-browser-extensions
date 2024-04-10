import React, { useState } from 'react';
import cx from 'classnames';
import styles from "./CanvasToBrowser.module.scss";
import { useSelector } from 'react-redux';
import { setCanvasTabs } from '@/popup/redux/tabs/tabActions';
import { useDispatch } from 'react-redux';
import { Dispatch } from 'redux';
import { updateTabs } from '@/popup/utils';
import { Icon } from 'react-materialize';

interface CanvasToBrowserTypes {
}

const CanvasToBrowser: React.FC<CanvasToBrowserTypes> = ({ }) => {
  const canvasTabs = useSelector((state: any) => state.tabs.canvasTabs);
  const dispatch = useDispatch<Dispatch<any>>();

  const removeCanvasToBrowserTabClicked = (tab: chrome.tabs.Tab) => {
    console.log('UI | Close icon clicked: ', tab.url);
    if(!tab.id) return;
    chrome.runtime.sendMessage({ action: 'context:tab:remove', tab }).then((res) => {
      chrome.runtime.sendMessage({ action: 'index:updateBrowserTabs' });
      console.log(res)
      updateTabs(dispatch);
    }).catch((error) => {
        console.error('UI | Error deleting tabs from canvas:', error);
    });
    // Remove the tab from the list
    // dispatch(setCanvasTabs(canvasTabs.filter((t: chrome.tabs.Tab) => t.id !== tab.id)));
  };

  const deleteCanvasToBrowserTabClicked = (tab: chrome.tabs.Tab) => {
    console.log('UI | Delete icon clicked: ', tab.url);
    if(!tab.id) return;
    chrome.runtime.sendMessage({ action: 'canvas:tab:delete', tab }).then((res) => {
      chrome.runtime.sendMessage({ action: 'index:updateBrowserTabs' });
      console.log(res)
      updateTabs(dispatch);
    }).catch((error) => {
        console.error('UI | Error deleting tabs from canvas:', error);
    });

    // Remove the tab from the list
    // dispatch(setCanvasTabs(canvasTabs.filter((t: chrome.tabs.Tab) => t.id !== tab.id)));
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

  const openTabClicked = (tab: chrome.tabs.Tab) => {
    console.log('UI | Opening clicked tab from canvas');
    chrome.runtime.sendMessage({ action: 'canvas:tabs:openInBrowser', tabs: [tab] }).then((res) => {
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
                  openTabClicked(tab);
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
                title="Remove tab from current context"
                onClick={(e) => { e.preventDefault(); removeCanvasToBrowserTabClicked(tab); }}
              >close</i>
              <i 
                className="material-icons"
                style={{ cursor: "pointer", color: "#d90000" }}
                title="Delete tab from all contexts"
                onClick={(e) => { e.preventDefault(); deleteCanvasToBrowserTabClicked(tab); }}
              >delete</i>
            </li>
          })
        }
      </ul>
    </div>
  );
};

export default CanvasToBrowser;