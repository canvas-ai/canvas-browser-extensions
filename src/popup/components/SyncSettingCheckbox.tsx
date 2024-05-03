import React from 'react';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { setConfig } from '../redux/config/configActions';
import { Dispatch } from 'redux';
import { browser } from '../utils';
import { RUNTIME_MESSAGES } from '@/general/constants';

interface SyncSettingCheckboxTypes {
  title: string;
  prop: string;
}

const SyncSettingCheckbox: React.FC<SyncSettingCheckboxTypes> = ({ title, prop }) => {
  const config = useSelector((state: { config: IConfigProps }) => state.config);
  const dispatch = useDispatch<Dispatch<any>>();

  const updateSyncSettings = (config: IConfigProps, changes: { [key: string]: any }) => {
    const sync = { ...config.sync, ...changes };
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.config_set_item, key: "sync", value: sync }, (response) => {
      dispatch(setConfig({ ...config, sync }));
    });
  }

  return (
    <div className="row">
      <div className="col s10">{title}</div>
      <div className="col s2">
        <div className="switch">
          <label>
            <input
              type="checkbox"
              checked={config.sync[prop]}
              onChange={(e) => updateSyncSettings(config, { [prop]: e.target.checked })}
            />
            <span className="lever"></span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default SyncSettingCheckbox;