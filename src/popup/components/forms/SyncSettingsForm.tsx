import React from 'react';
import { RUNTIME_MESSAGES } from '@/general/constants';
import SettingCheckbox from '@/popup/common-components/inputs/SettingCheckbox';
import { browser } from '@/general/utils';
import { useConfig } from '@/popup/hooks/useStorage';

const SyncSettingsForm: React.FC<any> = ({ }) => {
  const [config, setConfig] = useConfig();

  const saveSyncSettings = async (sync: IConfigProps["sync"]) => {
    if (!config) return;
    const updatedConfig = { ...config, sync };
    await setConfig(updatedConfig);
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.config_set_item, key: "sync", value: sync }, (response) => {});
  }

  if (!config) {
    return <div>Loading...</div>;
  }

  return (
    <div className="sync-settings-form">
    <div className="input-container">
      <label className="form-label">Handle existing tabs on context change</label>
      <div className="form-control">
        <select 
          className="browser-default" 
          defaultValue={config.sync.tabBehaviorOnContextChange} 
          onChange={(e) => saveSyncSettings({...config.sync, tabBehaviorOnContextChange: e.target.value as IConfigProps["sync"]["tabBehaviorOnContextChange"] })}
        >
          <option value="Close">Close</option>
          <option value="Save and Close">Save and Close</option>
          <option value="Keep">Keep</option>
        </select>
      </div>
    </div>
    
    <SettingCheckbox
      prop={'sync.autoOpenCanvasTabs'} 
      title="Automatically open tabs on context change" /> 

  </div>
  );
};

export default SyncSettingsForm;