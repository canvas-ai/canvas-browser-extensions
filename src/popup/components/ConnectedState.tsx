import React from 'react';
import { Tab, Tabs } from 'react-materialize';
import BrowserToCanvas from './tabs/BrowserToCanvas';
import CanvasToBrowser from './tabs/CanvasToBrowser';
import Search from './tabs/Search';
import Settings from './tabs/Settings';

interface ConnectedStateTypes {
}

const ConnectedState: React.FC<ConnectedStateTypes> = ({ }) => {
  return (
    <section className="no-pad">
      <Tabs
        className="tab-demo z-depth-1"
        scope="tabs-22"
      >
        <Tab
          active
          options={{
            duration: 300,
            onShow: null,
            responsiveThreshold: Infinity,
            swipeable: false
          }}
          title="Browser Tabs"
        >
          <BrowserToCanvas />
        </Tab>
        <Tab
          options={{
            duration: 300,
            onShow: null,
            responsiveThreshold: Infinity,
            swipeable: false
          }}
          title="Canvas Tabs"
        >
          <CanvasToBrowser />
        </Tab>
        <Tab
          options={{
            duration: 300,
            onShow: null,
            responsiveThreshold: Infinity,
            swipeable: false,
          }}
          title="Search Tabs"
        >
          <Search />
        </Tab>
        <Tab
          options={{
            duration: 300,
            onShow: null,
            responsiveThreshold: Infinity,
            swipeable: false
          }}
          title="Settings"
        >
          <Settings />
        </Tab>
      </Tabs>
    </section>
  );
};

export default ConnectedState;