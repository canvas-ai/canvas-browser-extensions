import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import BrowserToCanvas from './tabs/BrowserToCanvas';
import CanvasToBrowser from './tabs/CanvasToBrowser';
import Search from './tabs/Search';
import Settings from './tabs/Settings';

interface ConnectedStateTypes {
  connected?: boolean;
}

const ConnectedState: React.FC<ConnectedStateTypes> = ({ connected }) => {
  const variables = useSelector((state: { variables: IVarState }) => state.variables);
  const [activeTab, setActiveTab] = useState(3); // Start with Settings tab (index 3)

  // Use Redux state for connection status if not provided as prop
  const isConnected = connected !== undefined ? connected : variables.connected;

  const tabs = [
    { title: "Browser Tabs", component: <BrowserToCanvas />, enabled: isConnected },
    { title: "Canvas Tabs", component: <CanvasToBrowser />, enabled: isConnected },
    { title: "Search Tabs", component: <Search />, enabled: isConnected },
    { title: "Settings", component: <Settings />, enabled: true } // Always enabled
  ];

  // Update active tab when connection status changes
  useEffect(() => {
    if (isConnected && activeTab === 3) {
      // Connection established and we're on Settings tab - keep on Settings
      // User can manually switch to other tabs now
    } else if (!isConnected) {
      // Lost connection - switch back to Settings tab
      setActiveTab(3);
    }
  }, [isConnected, activeTab]);

  const handleTabClick = (index: number) => {
    const tab = tabs[index];
    if (tab.enabled) {
      setActiveTab(index);
    }
  };

  return (
    <section className="no-pad">
      <div className="custom-tabs">
        <div className="tabs-header">
          {tabs.map((tab, index) => (
            <div
              key={index}
              className={`tab-item ${activeTab === index ? 'active' : ''} ${!tab.enabled ? 'disabled' : ''}`}
              onClick={() => handleTabClick(index)}
              style={{
                opacity: tab.enabled ? 1 : 0.5,
                cursor: tab.enabled ? 'pointer' : 'not-allowed',
                color: tab.enabled ? (activeTab === index ? '#fff' : '#333') : '#999'
              }}
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
