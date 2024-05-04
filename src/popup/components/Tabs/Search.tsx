import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import CanvasTabsCollection from '../CanvasTabsCollection';
import BrowserTabsCollection from '../BrowserTabsCollection';

const Search: React.FC<any> = ({ }) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const tabs = useSelector((state: { tabs: ITabsInfo }) => state.tabs);

  const filterTab = (tab: ICanvasTab) => {
    return tab.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    tab.url?.split("//")[1].split("/")[0].includes(searchTerm.toLowerCase());
  }

  return (
    <div id="tab-search" className="container">
      <h5>Search the tabs</h5>
      <div><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Input search term" /></div>
      <div className="c2b-results">
        <h6 style={{ fontStyle: "italic" }}>Canvas to Browser results</h6>
        <CanvasTabsCollection canvasTabs={tabs.canvasTabs.filter(filterTab)} />
      </div>
      <hr className="my-4" />
      <div className="b2c-results">
        <h6 style={{ fontStyle: "italic" }}>Browser to Canvas results</h6>
        <BrowserTabsCollection browserTabs={tabs.browserTabs.filter(filterTab)} />
      </div>
    </div>
  );
};

export default Search;