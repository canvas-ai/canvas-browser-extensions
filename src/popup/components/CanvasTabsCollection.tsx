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
    if(!tab.docId && !tab.id) return;
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.context_tab_remove, tab }).catch((error) => {
        console.error('UI | Error deleting tabs from canvas:', error);
    });
  };

  const deleteCanvasToBrowserTabClicked = (tab: ICanvasTab) => {
    console.log('UI | Delete icon clicked: ', tab.url);
    if(!tab.docId && !tab.id) return;
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

  // Helper function to safely get tab URL considering various possible data formats
  const getTabUrl = (tab: any): string => {
    if (tab.url) return tab.url;
    if (tab.data && tab.data.url) return tab.data.url;
    // For nested tabData structure
    if (tab.data && tab.data.tabData && tab.data.tabData[0] && tab.data.tabData[0].url) {
      return tab.data.tabData[0].url;
    }
    return '';
  };

  // Helper function to safely get tab title
  const getTabTitle = (tab: any): string => {
    if (tab.title) return tab.title;
    if (tab.data && tab.data.title) return tab.data.title;
    // For nested tabData structure
    if (tab.data && tab.data.tabData && tab.data.tabData[0] && tab.data.tabData[0].title) {
      return tab.data.tabData[0].title;
    }
    return 'Unknown Title';
  };

  // Helper function to safely get favicon URL
  const getTabFavIconUrl = (tab: any): string => {
    if (tab.favIconUrl) return tab.favIconUrl;
    if (tab.data && tab.data.favIconUrl) return tab.data.favIconUrl;
    // For nested tabData structure
    if (tab.data && tab.data.tabData && tab.data.tabData[0] && tab.data.tabData[0].favIconUrl) {
      return tab.data.tabData[0].favIconUrl;
    }
    return '';
  };

  return (
    <ul className="collection">
      {
        !canvasTabs?.length ?
        (<li className="collection-item">No canvas tabs found</li>) :
        canvasTabs.map((tab: any, idx: number) => {
          const tabUrl = getTabUrl(tab);
          if(!tabUrl) return null;

          const tabTitle = getTabTitle(tab);
          const tabFavIconUrl = getTabFavIconUrl(tab);

          // Ensure tab object has required properties for other operations
          const normalizedTab = {
            ...tab,
            url: tabUrl,
            title: tabTitle,
            favIconUrl: tabFavIconUrl,
            // Ensure we have a document ID (needed for server operations)
            docId: tab.docId || tab.id || tab._id
          };

          return (
            <li key={idx + tabUrl} className="collection-item">
              {checkedTabs ? (
                <div className="checkbox-container">
                  <input
                    type="checkbox"
                    onChange={(e) => setTabCheck(normalizedTab, e.target.checked)}
                    checked={checkedTabs.some(({ url }) => url === tabUrl)}
                  />
                </div>
              ) : null}

              <a
                href={tabUrl}
                className="truncate"
                onClick={(e) => {
                  e.preventDefault();
                  openTabClicked(normalizedTab);
                  console.log('UI | Tab clicked: ', tabUrl);
                }}
              >
                <img src={tabFavIconUrl || ""} />
                <span className="tab-title truncate black-text">{tabTitle || ""}</span>
              </a>
              {
                isOnUniverse(variables.context.url) ?
                null :
                (
                  <i
                    className="material-icons"
                    style={{ cursor: "pointer" }}
                    title="Remove tab from current context"
                    onClick={(e) => { e.preventDefault(); removeCanvasToBrowserTabClicked(normalizedTab); }}
                  >close</i>
                )
              }
              <i
                className="material-icons"
                style={{ cursor: "pointer", color: "#d90000" }}
                title="Delete tab from all contexts"
                onClick={(e) => { e.preventDefault(); deleteCanvasToBrowserTabClicked(normalizedTab); }}
              >delete</i>
            </li>
          );
        })
      }
    </ul>
  )
}

export default CanvasTabsCollection;
