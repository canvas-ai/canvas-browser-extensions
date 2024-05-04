import React from 'react';
import { useSelector } from 'react-redux';
import { browser } from '@/popup/utils';
import { RUNTIME_MESSAGES } from '@/general/constants';
import BrowserTabsCollection from '../BrowserTabsCollection';

const BrowserToCanvas: React.FC<any> = ({ }) => {
  const browserTabs = useSelector((state: { tabs: ITabsInfo }) => state.tabs.browserTabs);

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
      <BrowserTabsCollection browserTabs={browserTabs} />
    </div>
  );
};

export default BrowserToCanvas;