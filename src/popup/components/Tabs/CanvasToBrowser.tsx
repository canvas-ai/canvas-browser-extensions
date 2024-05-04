import React from 'react';
import { useSelector } from 'react-redux';
import { browser, requestUpdateTabs } from '@/popup/utils';
import { RUNTIME_MESSAGES } from '@/general/constants';
import CanvasTabsCollection from '../CanvasTabsCollection';

const CanvasToBrowser: React.FC<any> = ({ }) => {
  const canvasTabs = useSelector((state: { tabs: ITabsInfo }) => state.tabs.canvasTabs);

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

  return (
    <div className="container">
      <h5>Open all tabs
        (<span className="" id="canvas-tab-delta-count">{canvasTabs?.length}</span>)
        <span>
          <a className="black white-text waves-effect waves-light btn-small right" onClick={openAllClicked}>Open all<i className="material-icons right">sync</i></a>
        </span>
      </h5>
      <CanvasTabsCollection canvasTabs={canvasTabs} />
    </div>
  );
};

export default CanvasToBrowser;