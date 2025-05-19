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
    return '';
  };

  const filterTab = (tab: any) => {
    const title = getTabTitle(tab);
    const url = getTabUrl(tab);

    // If we have no searchable content, filter out the tab
    if (!title && !url) return false;

    // Empty search returns all tabs
    if (!searchTerm.trim()) return true;

    // Check if title or domain matches search term
    const searchTermLower = searchTerm.toLowerCase();
    const titleMatch = title?.toLowerCase().includes(searchTermLower);

    let domainMatch = false;
    try {
      // Extract domain from URL for matching
      if (url) {
        const urlParts = url.split('//');
        if (urlParts.length > 1) {
          const domain = urlParts[1].split('/')[0];
          domainMatch = domain.toLowerCase().includes(searchTermLower);
        } else {
          domainMatch = url.toLowerCase().includes(searchTermLower);
        }
      }
    } catch (e) {
      console.error('Error parsing URL for search:', e);
      // As fallback, just check if URL contains search term
      domainMatch = url?.toLowerCase().includes(searchTermLower);
    }

    return titleMatch || domainMatch;
  };

  useEffect(() => {
    try {
      console.log('Search | Filtering tabs with search term:', searchTerm);
      console.log('Search | Tab counts before filtering:', {
        canvasTabs: tabs.canvasTabs.length,
        browserTabs: tabs.browserTabs.length,
        openedCanvasTabs: tabs.openedCanvasTabs.length,
        syncedBrowserTabs: tabs.syncedBrowserTabs.length
      });

      setFilteredTabs({
        canvasTabs: tabs.canvasTabs.filter(filterTab),
        browserTabs: tabs.browserTabs.filter(filterTab),
        openedCanvasTabs: tabs.openedCanvasTabs.filter(filterTab),
        syncedBrowserTabs: tabs.syncedBrowserTabs.filter(filterTab)
      });
    } catch (e) {
      console.error('Error filtering tabs:', e);
      // In case of error, show all tabs
      setFilteredTabs(tabs);
    }
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
