import React from 'react';
import ConnectionSettingsForm from '../ConnectionSettingsForm';
import { Collapsible, CollapsibleItem, Icon } from 'react-materialize';
import SyncSettingsForm from '../SyncSettingsForm';

const Settings: React.FC<any> = ({ }) => {
  return (
    <div id="settings" className="container">
      <h5>Settings</h5>
      <Collapsible accordion={false}>
        <CollapsibleItem
          expanded={false}
          header="Extension Settings"
          icon={<Icon>settings</Icon>}
          node="div"
        >
          <SyncSettingsForm />
        </CollapsibleItem>
        
        <CollapsibleItem
          expanded={true}
          header="Canvas Settings"
          icon={<Icon>cloud_sync</Icon>}
          node="div"
        >
          <ConnectionSettingsForm />
        </CollapsibleItem>
      </Collapsible>
    </div>
  );
};

export default Settings;