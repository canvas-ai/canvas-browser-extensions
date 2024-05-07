import React from 'react';
import ConnectionSettingsForm from '../ConnectionSettingsForm';
import SyncSettingsForm from '../SyncSettingsForm';

const Settings: React.FC<any> = ({ }) => {
  return (
    <div id="settings">
      <h5>Settings</h5>
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