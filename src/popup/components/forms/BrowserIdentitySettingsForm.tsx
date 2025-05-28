import React from 'react';
import { RUNTIME_MESSAGES } from '@/general/constants';
import SettingCheckbox from '@/popup/common-components/inputs/SettingCheckbox';
import { browser } from '@/general/utils';
import { useConfig } from '@/popup/hooks/useStorage';

const BrowserIdentitySettingsForm: React.FC<any> = ({ }) => {
  const [config, setConfig] = useConfig();

  const saveBrowserIdentitySettings = async (browserIdentity: IConfigProps["browserIdentity"]) => {
    if (!config) return;
    const updatedConfig = { ...config, browserIdentity };
    await setConfig(updatedConfig);
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.config_set_item, key: "browserIdentity", value: browserIdentity }, (response) => {});
  }

  if (!config) {
    return <div>Loading...</div>;
  }

  return (
    <div className="browser-identity-settings-form">
      <div className="input-container">
        <label className="form-label" htmlFor="browser-tag">Tag tabs from this browser</label>
        <div className="form-control">
          <input 
            type="text" 
            id="browser-tag" 
            value={config.browserIdentity.browserTag} 
            onChange={(e) => saveBrowserIdentitySettings({ ...config.browserIdentity, browserTag: e.target.value })} 
          />
        </div>
      </div>

      <SettingCheckbox
        prop={'browserIdentity.syncOnlyTaggedTabs'}
        title="Sync only the tagged tabs" />
    </div>
  );
};

export default BrowserIdentitySettingsForm;