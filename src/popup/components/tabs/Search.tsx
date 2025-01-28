import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import CanvasTabsCollection from '../CanvasTabsCollection';
import BrowserTabsCollection from '../BrowserTabsCollection';

const Search: React.FC<any> = ({ }) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filteredTabs, setFilteredTabs] = useState<ITabsInfo>({ browserTabs: [], canvasTabs: [], openedCanvasTabs: [], syncedBrowserTabs: [] });
  const tabs = useSelector((state: { tabs: ITabsInfo }) => state.tabs);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    closedCanvas: true,
    openedCanvas: true,
    syncableBrowser: true,
    syncedBrowser: true
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const filterTab = (tab: ICanvasTab) => {
    // This should never happen (assuming schema validation is working properly)
    if (!tab.title && !tab.url) return false;
    return tab.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tab.url?.split("//")[1].split("/")[0].includes(searchTerm.toLowerCase());
  }

  useEffect(() => {
    setFilteredTabs({
      canvasTabs: tabs.canvasTabs.filter(filterTab),
      browserTabs: tabs.browserTabs.filter(filterTab),
      openedCanvasTabs: tabs.openedCanvasTabs.filter(filterTab),
      syncedBrowserTabs: tabs.syncedBrowserTabs.filter(filterTab)
    });
  }, [tabs, searchTerm]);

  return (
    <div id="tab-search" className="tab-collection-container">
      <h5>Search the tabs</h5>
      <div><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Input search term" /></div>
      <div className="c2b-results">
        <h6 style={{ fontStyle: "italic" }}>Canvas tab results</h6>
        {!filteredTabs.canvasTabs.length && !filteredTabs.openedCanvasTabs.length ? (
          <div className="no-tabs-found">No tabs found!</div>
        ) : (
          <div className="collapsible-container">
            {filteredTabs.canvasTabs.length ? (
              <div className="collapsible-item">
                <div 
                  className="collapsible-header"
                  onClick={() => toggleSection('closedCanvas')}
                >
                  <span className="material-icons">
                    {expandedSections.closedCanvas ? 'expand_more' : 'chevron_right'}
                  </span>
                  <span className="material-icons">sync</span>
                  <span>Closed Canvas Tabs ({filteredTabs.canvasTabs.length})</span>
                </div>
                {expandedSections.closedCanvas && (
                  <div className="collapsible-content">
                    <CanvasTabsCollection canvasTabs={filteredTabs.canvasTabs} />
                  </div>
                )}
              </div>
            ) : null}
            
            {filteredTabs.openedCanvasTabs.length ? (
              <div className="collapsible-item">
                <div 
                  className="collapsible-header"
                  onClick={() => toggleSection('openedCanvas')}
                >
                  <span className="material-icons">
                    {expandedSections.openedCanvas ? 'expand_more' : 'chevron_right'}
                  </span>
                  <span className="material-icons">cloud_sync</span>
                  <span>Opened Canvas Tabs ({filteredTabs.openedCanvasTabs.length})</span>
                </div>
                {expandedSections.openedCanvas && (
                  <div className="collapsible-content">
                    <CanvasTabsCollection canvasTabs={filteredTabs.openedCanvasTabs} />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
      <hr className="my-4" />
      <div className="b2c-results">
        <h6 style={{ fontStyle: "italic" }}>Browser tab results</h6>
        {!filteredTabs.browserTabs.length && !filteredTabs.syncedBrowserTabs.length ? (
          <div className="no-tabs-found">No tabs found!</div>
        ) : (
          <div className="collapsible-container">
            {filteredTabs.browserTabs.length ? (
              <div className="collapsible-item">
                <div 
                  className="collapsible-header"
                  onClick={() => toggleSection('syncableBrowser')}
                >
                  <span className="material-icons">
                    {expandedSections.syncableBrowser ? 'expand_more' : 'chevron_right'}
                  </span>
                  <span className="material-icons">sync</span>
                  <span>Syncable Browser Tabs ({filteredTabs.browserTabs.length})</span>
                </div>
                {expandedSections.syncableBrowser && (
                  <div className="collapsible-content">
                    <BrowserTabsCollection browserTabs={filteredTabs.browserTabs} />
                  </div>
                )}
              </div>
            ) : null}
            
            {filteredTabs.syncedBrowserTabs.length ? (
              <div className="collapsible-item">
                <div 
                  className="collapsible-header"
                  onClick={() => toggleSection('syncedBrowser')}
                >
                  <span className="material-icons">
                    {expandedSections.syncedBrowser ? 'expand_more' : 'chevron_right'}
                  </span>
                  <span className="material-icons">cloud_sync</span>
                  <span>Synced Browser Tabs ({filteredTabs.syncedBrowserTabs.length})</span>
                </div>
                {expandedSections.syncedBrowser && (
                  <div className="collapsible-content">
                    <BrowserTabsCollection browserTabs={filteredTabs.syncedBrowserTabs} />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;