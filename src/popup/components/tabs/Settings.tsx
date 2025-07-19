import React from 'react';
import AuthenticationSettingsForm from '../forms/AuthenticationSettingsForm';

const Settings: React.FC<any> = ({ }) => {
  return (
    <div id="settings">
      <h5>Settings</h5>
      <hr />
      <div className="settings-box">
        <h6>Canvas Connection & Authentication</h6>
        <div>
          <AuthenticationSettingsForm />
        </div>
      </div>
    </div>
  );
};

export default Settings;
