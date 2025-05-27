import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { isOnUniverse } from '@/popup/utils';
import { RUNTIME_MESSAGES } from '@/general/constants';
import CanvasTabsCollection from '../CanvasTabsCollection';
import { browser } from '@/general/utils';
import { useContext } from '../../hooks/useStorage';

const CanvasToBrowser: React.FC<any> = ({ }) => {
  const tabs = useSelector((state: { tabs: ITabsInfo }) => state.tabs);
  const [checkedCanvasTabs, setCheckedCanvasTabs] = useState<ICanvasTab[]>([]);
  const [checkedOpenedCanvasTabs, setCheckedOpenedCanvasTabs] = useState<ICanvasTab[]>([]);
  
  const [context] = useContext();
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    closedCanvas: true,
    openedCanvas: false
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const openAllClicked = () => {
    console.log('UI | Opening all tabs from canvas');
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tabs_openInBrowser }).catch((error) => {
      console.error('UI | Error opening tabs from canvas:', error);
    });
  }

  const openSelectedClicked = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, openableTabs: ICanvasTab[]) => {
    e.preventDefault();
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tabs_openInBrowser, tabs: openableTabs }).catch((error) => {
      console.error('UI | Error opening tabs from canvas:', error);
    });
    setCheckedCanvasTabs([]);
    setCheckedOpenedCanvasTabs([]);
  }

  const removeSelectedClicked = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, removableTabs: ICanvasTab[]) => {
    e.preventDefault();
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.context_tabs_remove, tabs: removableTabs }).catch((error) => {
      console.error('UI | Error deleting tabs from canvas:', error);
    });

    setCheckedCanvasTabs([]);
    setCheckedOpenedCanvasTabs([]);
  }

  const deleteSelectedClicked = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, deletableTabs: ICanvasTab[]) => {
    e.preventDefault();
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.canvas_tabs_delete, tabs: deletableTabs }).catch((error) => {
      console.error('UI | Error deleting tabs from canvas:', error);
    });
    setCheckedCanvasTabs([]);
    setCheckedOpenedCanvasTabs([]);
  }

  return (
    <div className="tab-collection-container">
      <h5>Open all tabs</h5>
      <div className="button-container">
        <a className="black white-text waves-effect waves-light btn-small right" onClick={openAllClicked}>Open all<i className="material-icons right">sync</i></a>
        {checkedCanvasTabs.length ? (
          <a className="black white-text waves-effect waves-light btn-small right"
            onClick={(e) => openSelectedClicked(e, checkedCanvasTabs)}>Open selected<i className="material-icons right">sync</i></a>
        ) : null}

        {!isOnUniverse(context) && (checkedCanvasTabs.length || checkedOpenedCanvasTabs.length) ? (
          <a className="black white-text waves-effect waves-light btn-small right"
            onClick={(e) => removeSelectedClicked(e, [...checkedCanvasTabs, ...checkedOpenedCanvasTabs])}>Remove Selected<i className="material-icons right">delete</i></a>
        ) : null}

        {checkedCanvasTabs.length || checkedOpenedCanvasTabs.length ? (
          <a className="black white-text waves-effect waves-light btn-small right"
            onClick={(e) => deleteSelectedClicked(e, [...checkedCanvasTabs, ...checkedOpenedCanvasTabs])}>Delete Selected<i className="material-icons right">delete</i></a>
        ) : null}
      </div>

      <div className="collapsible-container">
        <div className="collapsible-item">
          <div 
            className="collapsible-header"
            onClick={() => toggleSection('closedCanvas')}
          >
            <span className="material-icons">
              {expandedSections.closedCanvas ? 'expand_more' : 'chevron_right'}
            </span>
            <span className="material-icons">sync</span>
            <span>Closed Canvas Tabs ({tabs.canvasTabs.length})</span>
          </div>
          {expandedSections.closedCanvas && (
            <div className="collapsible-content">
              <CanvasTabsCollection
                checkedTabs={checkedCanvasTabs}
                setCheckedTabs={setCheckedCanvasTabs}
                canvasTabs={tabs.canvasTabs}
              />
            </div>
          )}
        </div>

        <div className="collapsible-item">
          <div 
            className="collapsible-header"
            onClick={() => toggleSection('openedCanvas')}
          >
            <span className="material-icons">
              {expandedSections.openedCanvas ? 'expand_more' : 'chevron_right'}
            </span>
            <span className="material-icons">cloud_sync</span>
            <span>Opened Canvas Tabs ({tabs.openedCanvasTabs.length})</span>
          </div>
          {expandedSections.openedCanvas && (
            <div className="collapsible-content">
              <CanvasTabsCollection
                checkedTabs={checkedOpenedCanvasTabs}
                setCheckedTabs={setCheckedOpenedCanvasTabs}
                canvasTabs={tabs.openedCanvasTabs}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CanvasToBrowser;