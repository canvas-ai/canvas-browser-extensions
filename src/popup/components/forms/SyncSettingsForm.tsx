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
          <option value="Close Current and Open New">Close Current and Open New</option>
          <option value="Save and Close Current and Open New">Save and Close Current and Open New</option>
          <option value="Keep Current and Open New">Keep Current and Open New</option>
          <option value="Keep Current and Do Not Open New">Keep Current and Do Not Open New</option>
        </select>
      </div>
    </div>

    <SettingCheckbox
      prop={'sync.autoOpenCanvasTabs'}
      title="Automatically open tabs on context update" />

  </div>
  );
};

export default SyncSettingsForm;
