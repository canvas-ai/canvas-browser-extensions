import React, { useState } from 'react';
import styles from "./Settings.module.scss";
import ConnectionSettingsForm from '../ConnectionSettingsForm';
import { Collapsible, CollapsibleItem, Icon } from 'react-materialize';
import SyncSettingCheckbox from '../SyncSettingCheckbox';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { Dispatch } from 'redux';
import SyncSettingsForm from '../SyncSettingsForm';

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
          <SyncSettingsForm />
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