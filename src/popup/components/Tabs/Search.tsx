import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import CanvasTabsCollection from '../CanvasTabsCollection';
import BrowserTabsCollection from '../BrowserTabsCollection';
import { Collapsible, CollapsibleItem, Icon } from 'react-materialize';

const Search: React.FC<any> = ({ }) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filteredTabs, setFilteredTabs] = useState<ITabsInfo>({ browserTabs: [], canvasTabs: [], openedCanvasTabs: [], syncedBrowserTabs: [] });
  const tabs = useSelector((state: { tabs: ITabsInfo }) => state.tabs);

  const filterTab = (tab: ICanvasTab) => {
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
          <Collapsible accordion={false}>
            {
              filteredTabs.canvasTabs.length ?
                (
                  <CollapsibleItem
                    expanded={true}
                    header="Closed Canvas Tabs"
                    icon={<Icon>sync</Icon>}
                    node="div"
                  >
                    <CanvasTabsCollection canvasTabs={filteredTabs.canvasTabs} />
                  </CollapsibleItem>
                ) :
                null
            }
            {
              filteredTabs.openedCanvasTabs.length ?
                (
                  <CollapsibleItem
                    expanded={true}
                    header="Opened Canvas Tabs"
                    icon={<Icon>cloud_sync</Icon>}
                    node="div"
                  >
                    <CanvasTabsCollection canvasTabs={filteredTabs.openedCanvasTabs} />
                  </CollapsibleItem>
                ) :
                null
            }
          </Collapsible>
        )}
      </div>
      <hr className="my-4" />
      <div className="b2c-results">
        <h6 style={{ fontStyle: "italic" }}>Browser tab results</h6>
        {!filteredTabs.browserTabs.length && !filteredTabs.syncedBrowserTabs.length ? (
          <div className="no-tabs-found">No tabs found!</div>
        ) : (
          <Collapsible accordion={false}>
            {
              filteredTabs.browserTabs.length ?
                (
                  <CollapsibleItem
                    expanded={true}
                    header="Syncable Browser Tabs"
                    icon={<Icon>sync</Icon>}
                    node="div"
                  >
                    <BrowserTabsCollection browserTabs={filteredTabs.browserTabs} />
                  </CollapsibleItem>
                ) :
                null
            }
            {
              filteredTabs.syncedBrowserTabs.length ?
                (
                  <CollapsibleItem
                    expanded={true}
                    header="Synced Browser Tabs"
                    icon={<Icon>cloud_sync</Icon>}
                    node="div"
                  >
                    <BrowserTabsCollection browserTabs={filteredTabs.syncedBrowserTabs} />
                  </CollapsibleItem>
                ) :
                null
            }
          </Collapsible>
        )}
      </div>
    </div>
  );
};

export default Search;