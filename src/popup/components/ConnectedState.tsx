import React, { useState } from 'react';
import BrowserToCanvas from './tabs/BrowserToCanvas';
import CanvasToBrowser from './tabs/CanvasToBrowser';
import Search from './tabs/Search';
import Settings from './tabs/Settings';

interface ConnectedStateTypes {
}

const ConnectedState: React.FC<ConnectedStateTypes> = ({ }) => {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    { title: "Browser Tabs", component: <BrowserToCanvas /> },
    { title: "Canvas Tabs", component: <CanvasToBrowser /> },
    { title: "Search Tabs", component: <Search /> },
    { title: "Settings", component: <Settings /> }
  ];

  return (
    <section className="no-pad">
      <div className="custom-tabs">
        <div className="tabs-header">
          {tabs.map((tab, index) => (
            <div
              key={index}
              className={`tab-item ${activeTab === index ? 'active' : ''}`}
              onClick={() => setActiveTab(index)}
            >
              {tab.title}
            </div>
          ))}
        </div>
        <div className="tab-content">
          {tabs[activeTab].component}
        </div>
      </div>
    </section>
  );
};

export default ConnectedState;