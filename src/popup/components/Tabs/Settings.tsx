import React, { useState } from 'react';
import styles from "./Settings.module.scss";
import ConnectionSettingsForm from '../ConnectionSettingsForm';
import { Collapsible, CollapsibleItem, Icon } from 'react-materialize';
import SyncSettingCheckbox from '../SyncSettingCheckbox';

interface SettingsTypes {
  retrying: boolean;
}

const Settings: React.FC<SettingsTypes> = ({ retrying }) => {
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
          
          <SyncSettingCheckbox 
            prop={'autoCloseTabs'} 
            title="Auto-sync browser tabs to Canvas" />

          <SyncSettingCheckbox 
            prop={'autoRestoreSession'} 
            title="Automatically switch tab-sets on context change" />

        </CollapsibleItem>
        <CollapsibleItem
          expanded={true}
          header="Canvas Settings"
          icon={<Icon>cloud_sync</Icon>}
          node="div"
        >
          <ConnectionSettingsForm retrying={retrying} />
        </CollapsibleItem>
      </Collapsible>
    </div>
  );
};

export default Settings;