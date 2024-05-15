import React from 'react';
import { isOnUniverse } from '../utils';
import { RUNTIME_MESSAGES } from '@/general/constants';
import { useSelector } from 'react-redux';
import { browser } from '@/general/utils';

interface CanvasTabsCollectionTypes {
  canvasTabs: ICanvasTab[];
  checkedTabs?: ICanvasTab[];
  setCheckedTabs?: React.Dispatch<React.SetStateAction<ICanvasTab[]>>;
}

const CanvasTabsCollection: React.FC<CanvasTabsCollectionTypes> = ({ canvasTabs, checkedTabs, setCheckedTabs = () => {} }) => {
  const variables = useSelector((state: { variables: IVarState }) => state.variables);
  
  const removeCanvasToBrowserTabClicked = (tab: ICanvasTab) => {
    console.log('UI | Close icon clicked: ', tab.url);
    if(!tab.id) return;
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.context_tab_remove, tab }).catch((error) => {
        console.error('UI | Error deleting tabs from canvas:', error);
    });
  };

  const deleteCanvasToBrowserTabClicked = (tab: ICanvasTab) => {
    console.log('UI | Delete icon clicked: ', tab.url);
    if(!tab.id) return;
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tab_delete, tab }).catch((error) => {
        console.error('UI | Error deleting tabs from canvas:', error);
    });
  };

  const openTabClicked = (tab: ICanvasTab) => {
    console.log('UI | Opening clicked tab from canvas');
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tabs_openInBrowser, tabs: [tab] }).catch((error) => {
        console.error('UI | Error opening tabs from canvas:', error);
    });
  }

  const setTabCheck = (tab: ICanvasTab, checked: boolean) => {
    if (checked) setCheckedTabs(tabs => ([...tabs, tab]));
    else setCheckedTabs(tabs => tabs.filter(t => t.url !== tab.url))
  }

  return (
    <ul className="collection">
      {
        !canvasTabs?.length ? 
        (<li className="collection-item">No canvas tabs found</li>) : 
        canvasTabs.map((tab: ICanvasTab, idx: number) => {
          if(!tab.url) return null;
          return <li key={idx + tab.url} className="collection-item">
            {checkedTabs ? (
              <div className="checkbox-container">
                <input type="checkbox" onChange={(e) => setTabCheck(tab, e.target.checked)} checked={checkedTabs.some(({ url }) => url === tab.url)} />
              </div>
            ) : null}

            <a 
              href={tab.url}
              className="tab-title truncate black-text"
              onClick={(e) => {
                e.preventDefault();
                openTabClicked(tab);
                console.log('UI | Tab clicked: ', tab.url);
              }}
            >
              <img src={tab.favIconUrl || ""} />
              <span>{tab.title || ""}</span>
            </a>
            {
              isOnUniverse(variables.context.url) ? 
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
  )
}

export default CanvasTabsCollection;