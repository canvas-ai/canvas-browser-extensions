import React from 'react';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { setConfig } from '../../redux/config/configActions';
import { Dispatch } from 'redux';
import { RUNTIME_MESSAGES } from '@/general/constants';
import { browser } from '@/general/utils';

interface SettingCheckboxTypes {
  title: string;
  prop: string;
}

const SettingCheckbox: React.FC<SettingCheckboxTypes> = ({ title, prop }) => {
  const config = useSelector((state: { config: IConfigProps }) => state.config);
  const dispatch = useDispatch<Dispatch<any>>();

  const updateSettings = (config: IConfigProps, changes: { [key: string]: any }, key: string) => {
    const updated = { ...config[key], ...changes };
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.config_set_item, key, value: updated }, (response) => {
      dispatch(setConfig({ ...config, [key]: updated }));
    });
  }

  const key = prop.split(".")[0];
  prop = prop.split(".")[1];

  return (
    <div className="input-container" style={{ margin: "0", display: "flex", alignItems: "center" }}>
      <div className="col s10">{title}</div>
      <div className="col s2">
        <div className="switch">
          <label>
            <input
              type="checkbox"
              checked={config[key][prop]}
              onChange={(e) => updateSettings(config, { [prop]: e.target.checked }, key)}
            />
            <span className="lever"></span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default SettingCheckbox;