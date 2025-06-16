import React from 'react';
import { isOnUniverse } from '../utils';
import { RUNTIME_MESSAGES } from '@/general/constants';
import { browser } from '@/general/utils';
import { useContext } from '../hooks/useStorage';

interface CanvasTabsCollectionTypes {
  canvasTabs: ICanvasTab[];
  checkedTabs?: ICanvasTab[];
  setCheckedTabs?: React.Dispatch<React.SetStateAction<ICanvasTab[]>>;
}

const CanvasTabsCollection: React.FC<CanvasTabsCollectionTypes> = ({ canvasTabs, checkedTabs, setCheckedTabs = () => {} }) => {
  const [context] = useContext();
  const [processingTabs, setProcessingTabs] = React.useState<Set<string>>(new Set());

  const removeCanvasToBrowserTabClicked = (tab: ICanvasTab) => {
    console.log('UI | Close icon clicked: ', tab.url);
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.context_tab_remove, tab }).catch((error) => {
        console.error('UI | Error removing tab from canvas:', error);
    });
  };

  const deleteCanvasToBrowserTabClicked = (tab: ICanvasTab) => {
    console.log('UI | Delete icon clicked for tab:', { url: tab.url, docId: tab.docId, id: tab.id });

    // Add tab to processing state
    setProcessingTabs(prev => new Set(prev).add(tab.url || ''));

    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tab_delete, tab }).then((response) => {
        console.log('UI | Delete tab message sent successfully:', response);
        // Remove from processing state after a delay (success will be handled by runtime messages)
        setTimeout(() => {
          setProcessingTabs(prev => {
            const newSet = new Set(prev);
            newSet.delete(tab.url || '');
            return newSet;
          });
        }, 2000);
    }).catch((error) => {
        console.error('UI | Error sending delete tab message:', error);
        // Remove from processing state on error
        setProcessingTabs(prev => {
          const newSet = new Set(prev);
          newSet.delete(tab.url || '');
          return newSet;
        });
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
              className="truncate"
              onClick={(e) => {
                e.preventDefault();
                openTabClicked(tab);
                console.log('UI | Tab clicked: ', tab.url);
              }}
            >
              <img src={tab.favIconUrl || ""} />
              <span className="tab-title truncate black-text">{tab.title || ""}</span>
            </a>
            {
              isOnUniverse(context) ?
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
              style={{
                cursor: processingTabs.has(tab.url || '') ? "not-allowed" : "pointer",
                color: processingTabs.has(tab.url || '') ? "#999" : "#d90000",
                opacity: processingTabs.has(tab.url || '') ? 0.5 : 1
              }}
              title={processingTabs.has(tab.url || '') ? "Deleting..." : "Delete tab from database permanently"}
              onClick={(e) => {
                e.preventDefault();
                if (!processingTabs.has(tab.url || '')) {
                  deleteCanvasToBrowserTabClicked(tab);
                }
              }}
            >{processingTabs.has(tab.url || '') ? "hourglass_empty" : "delete"}</i>
          </li>
        })
      }
    </ul>
  )
}

export default CanvasTabsCollection;
