import React from 'react';
import { useSelector } from 'react-redux';
import { browser, getContextBreadcrumbs, requestUpdateTabs } from '@/popup/utils';
import { RUNTIME_MESSAGES } from '@/general/constants';

const CanvasToBrowser: React.FC<any> = ({ }) => {
  const canvasTabs = useSelector((state: { tabs: ITabsInfo }) => state.tabs.canvasTabs);
  const variables = useSelector((state: { variables: IVarState }) => state.variables);

  const removeCanvasToBrowserTabClicked = (tab: ICanvasTab) => {
    console.log('UI | Close icon clicked: ', tab.url);
    if(!tab.id) return;
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.context_tab_remove, tab }).then((res) => {
      browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.index_updateBrowserTabs });
      console.log(res)
      requestUpdateTabs();
    }).catch((error) => {
        console.error('UI | Error deleting tabs from canvas:', error);
    });
  };

  const deleteCanvasToBrowserTabClicked = (tab: ICanvasTab) => {
    console.log('UI | Delete icon clicked: ', tab.url);
    if(!tab.id) return;
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tab_delete, tab }).then((res) => {
      browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.index_updateBrowserTabs });
      console.log(res)
      requestUpdateTabs();
    }).catch((error) => {
        console.error('UI | Error deleting tabs from canvas:', error);
    });
  };

  const openAllClicked = () => {
    console.log('UI | Opening all tabs from canvas');
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tabs_openInBrowser }).then((res) => {
        console.log(res)
        browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.index_updateBrowserTabs });
        requestUpdateTabs();
      }).catch((error) => {
        console.error('UI | Error opening tabs from canvas:', error);
    });
  }

  const openTabClicked = (tab: ICanvasTab) => {
    console.log('UI | Opening clicked tab from canvas');
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tabs_openInBrowser, tabs: [tab] }).then((res) => {
        console.log(res)
        browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.index_updateBrowserTabs });
        requestUpdateTabs();
    }).catch((error) => {
        console.error('UI | Error opening tabs from canvas:', error);
    });
  }

  return (
    <div className="container">
      <h5>Open all tabs
        (<span className="" id="canvas-tab-delta-count">{canvasTabs?.length}</span>)
        <span>
          <a className="black white-text waves-effect waves-light btn-small right" onClick={openAllClicked}>Open all<i className="material-icons right">sync</i></a>
        </span>
      </h5>
      <ul className="collection">
        {
          !canvasTabs?.length ? 
          (<li className="collection-item">No canvas tabs to sync</li>) : 
          canvasTabs.map((tab: ICanvasTab, idx: number) => {
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
              {
                getContextBreadcrumbs(variables.context.url).length === 1 && 
                getContextBreadcrumbs(variables.context.url)[0].textContent.trim().toLowerCase() === "universe" ? 
                null : 
                (
                  <i 
                    className="material-icons"
                    style={{ cursor: "pointer" }}
                    title="Remove tab from current context"
                    onClick={(e) => { e.preventDefault(); removeCanvasToBrowserTabClicked(tab); }}
                  >close</i>  
                )
              }
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