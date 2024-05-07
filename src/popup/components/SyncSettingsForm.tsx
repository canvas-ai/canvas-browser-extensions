import React from 'react';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { setConfig } from '../redux/config/configActions';
import { Dispatch } from 'redux';
import { browser } from '../utils';
import { RUNTIME_MESSAGES } from '@/general/constants';
import SyncSettingCheckbox from './SyncSettingCheckbox';

const SyncSettingsForm: React.FC<any> = ({ }) => {
  const config: IConfigProps = useSelector((state: { config: IConfigProps }) => state.config);
  const dispatch = useDispatch<Dispatch<any>>();

  const saveSyncSettings = (config: IConfigProps, sync: IConfigProps["sync"]) => {
    dispatch(setConfig({ ...config, sync }));
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.config_set_item, key: "sync", value: sync }, (response) => {
    });
  }

  return (
    <div className="sync-settings-form">
    <div className="input-container">
      <label className="form-label">Handle existing tabs on context change</label>
      <div className="form-control">
        <select 
          className="browser-default" 
          defaultValue={config.sync.tabBehaviorOnContextChange} 
          onChange={(e) => saveSyncSettings(config, {...config.sync, tabBehaviorOnContextChange: e.target.value as IConfigProps["sync"]["tabBehaviorOnContextChange"] })}
        >
          <option value="Close">Close</option>
          <option value="Save and Close">Save and Close</option>
          <option value="Keep">Keep</option>
        </select>
      </div>
    </div>
    
    <SyncSettingCheckbox 
      prop={'autoOpenCanvasTabs'} 
      title="Automatically open tabs on context change" /> 

  </div>
  );
};

export default SyncSettingsForm;