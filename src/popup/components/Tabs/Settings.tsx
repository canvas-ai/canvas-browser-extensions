import React from 'react';
import ConnectionSettingsForm from '../forms/ConnectionSettingsForm';
import SyncSettingsForm from '../forms/SyncSettingsForm';
import BrowserIdentitySettingsForm from '../forms/BrowserIdentitySettingsForm';

const Settings: React.FC<any> = ({ }) => {
  return (
    <div id="settings">
      <h5>Settings</h5>
      <hr />
      <div className="settings-box">
        <h6>Browser Identity Settings</h6>
        <div>
          <BrowserIdentitySettingsForm />
        </div>
      </div>
      <hr />
      <div className="settings-box">
        <h6>Context Sync Settings</h6>
        <div>
          <SyncSettingsForm />
        </div>
      </div>
      <hr />
      <div className="settings-box">
        <h6>Connection Settings</h6>
        <div>
          <ConnectionSettingsForm />
        </div>
      </div>
    </div>
  );
};

export default Settings;