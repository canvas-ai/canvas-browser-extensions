import React from 'react';
import { RUNTIME_MESSAGES } from '@/general/constants';
import { browser } from '@/general/utils';
import { useConfig } from '@/popup/hooks/useStorage';

interface SettingCheckboxTypes {
  title: string;
  prop: string;
}

const SettingCheckbox: React.FC<SettingCheckboxTypes> = ({ title, prop }) => {
  const [config, setConfig] = useConfig();

  const updateSettings = async (changes: { [key: string]: any }, key: string) => {
    if (!config) return;
    const updated = { ...config[key], ...changes };
    const updatedConfig = { ...config, [key]: updated };
    await setConfig(updatedConfig);
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.config_set_item, key, value: updated }, (response) => {});
  }

  const key = prop.split(".")[0];
  const propName = prop.split(".")[1];

  if (!config) {
    return <div>Loading...</div>;
  }

  return (
    <div className="input-container" style={{ margin: "0", display: "flex", alignItems: "center" }}>
      <div className="col s10">{title}</div>
      <div className="col s2">
        <div className="switch">
          <label>
            <input
              type="checkbox"
              checked={config[key][propName]}
              onChange={(e) => updateSettings({ [propName]: e.target.checked }, key)}
            />
            <span className="lever"></span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default SettingCheckbox;