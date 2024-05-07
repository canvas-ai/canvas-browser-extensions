import React from 'react';
import { useSelector } from 'react-redux';
import { browser } from '@/popup/utils';
import { RUNTIME_MESSAGES } from '@/general/constants';
import BrowserTabsCollection from '../BrowserTabsCollection';
import { Collapsible, CollapsibleItem, Icon } from 'react-materialize';

const BrowserToCanvas: React.FC<any> = ({ }) => {
  const tabs = useSelector((state: { tabs: ITabsInfo }) => state.tabs);

  const syncAllClicked = () => {
    console.log('UI | Syncing all tabs to canvas');
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tabs_insert }).then((res) => {
        console.log('UI | Res: ' + res)
        // updateTabs(dispatch);
    }).catch((error) => {
        console.error('UI | Error syncing tabs to canvas:', error);
    });
  }
  
  return (
    <div className="tab-collection-container">
      <h5>Sync to Canvas
        (<span className="">{tabs.browserTabs?.length}</span>)
        <span>
          <a onClick={syncAllClicked}
            className="black white-text waves-effect waves-light btn-small right">
            Sync all
            <i className="material-icons right">sync</i>
          </a>
        </span>
      </h5>
      <Collapsible accordion={false}>
        <CollapsibleItem
          expanded={true}
          header="Syncable Browser Tabs"
          icon={<Icon>sync</Icon>}
          node="div"
        >
          <BrowserTabsCollection browserTabs={tabs.browserTabs} />
        </CollapsibleItem>
        
        <CollapsibleItem
          expanded={false}
          header="Synced Browser Tabs"
          icon={<Icon>cloud_sync</Icon>}
          node="div"
        >
          <BrowserTabsCollection browserTabs={tabs.syncedBrowserTabs} />
        </CollapsibleItem>
      </Collapsible>
    </div>
  );
};

export default BrowserToCanvas;