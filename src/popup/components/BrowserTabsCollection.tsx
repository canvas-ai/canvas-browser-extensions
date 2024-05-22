import React, { useState } from 'react';
import { cx } from '../utils';
import { RUNTIME_MESSAGES } from '@/general/constants';
import { useDispatch, useSelector } from 'react-redux';
import { Dispatch } from 'redux';
import { setBrowserTabs } from '../redux/tabs/tabActions';
import { setPinnedTabs } from '../redux/variables/varActions';
import { browser } from '@/general/utils';

interface BrowserTabsCollectionTypes {
  browserTabs: ICanvasTab[];
  checkedTabs?: ICanvasTab[];
  setCheckedTabs?: React.Dispatch<React.SetStateAction<ICanvasTab[]>>;
}

const BrowserTabsCollection: React.FC<BrowserTabsCollectionTypes> = ({ browserTabs, checkedTabs, setCheckedTabs = () => {} }) => {
  const dispatch = useDispatch<Dispatch<any>>();
  const variables = useSelector((state: { variables: IVarState }) => state.variables);

  const removeBrowserToCanvasTabClicked = (tab: ICanvasTab) => {
    console.log('UI | Close icon clicked: ', tab.url);
    if (!tab.id) return;
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

  const togglePinned = (url: string) => {
    const pinnedTabs = variables.pinnedTabs.filter(pt => pt !== url);
    if (pinnedTabs.length !== variables.pinnedTabs.length) return dispatch(setPinnedTabs(pinnedTabs));
    return dispatch(setPinnedTabs([...pinnedTabs, url]));
  }

  const sortByPinnedTabs: (browserTabs: ICanvasTab[], pinnedTabs: string[]) => ICanvasTab[] = (browserTabs, pinnedTabs) => {
    return [
      ...(pinnedTabs.map(pt => browserTabs.find(tab => tab.url === pt)).filter(t => t) as ICanvasTab[]),
      ...browserTabs.filter(tab => !pinnedTabs.some(pt => pt === tab.url))
    ];
  }

  const setTabCheck = (tab: ICanvasTab, checked: boolean) => {
    if (checked) setCheckedTabs(tabs => ([...tabs, tab]));
    else setCheckedTabs(tabs => tabs.filter(t => t.url !== tab.url))
  }

  return (
    <ul className="collection">
      {
        !browserTabs?.length ?
          (<li className="collection-item">No browser tabs found</li>) :
          sortByPinnedTabs(browserTabs, variables.pinnedTabs).map((tab: ICanvasTab, idx: number) => {
            if (!tab.url) return null;
            return <li key={idx + tab.url} className="collection-item">
              {checkedTabs ? (
                <div className="checkbox-container">
                  <input type="checkbox" onChange={(e) => setTabCheck(tab, e.target.checked)} checked={checkedTabs.some(({ url }) => url === tab.url)} />
                </div>
              ) : null}
              <a
                href={tab.url}
                className="truncate"
                onClick={(e) => {
                  e.preventDefault();
                  if (tab.id) syncTabClicked(tab);
                  console.log('UI | Tab clicked: ', tab.url);
                }}
              >
                <img src={tab.favIconUrl || ""} />
                <span className="tab-title truncate black-text">{tab.title || ""}</span>
              </a>
              <span className="icons">
                <i
                  className={cx("material-icons", variables.pinnedTabs.some(pt => pt === tab.url) ? "pinned-tab" : "")}
                  style={{ cursor: "pointer" }}
                  title={variables.pinnedTabs.some(pt => pt === tab.url) ? "Remove pin" : "Pin tab"}
                  onClick={(e) => { e.preventDefault(); togglePinned(tab.url as string); }}
                >push_pin</i>
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