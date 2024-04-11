import React, { useEffect, useState } from 'react';
import cx from 'classnames';
import styles from "./SyncSettingsForm.module.css";
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { setConfig } from '../redux/config/configActions';
import { Dispatch } from 'redux';

interface SyncSettingsFormTypes {
}

const SyncSettingsForm: React.FC<SyncSettingsFormTypes> = ({ }) => {
  const config: IConfigProps = useSelector((state: any) => state.config);
  const dispatch = useDispatch<Dispatch<any>>();

  const saveSyncSettings = (config: IConfigProps, sync: IConfigProps["sync"]) => {
    dispatch(setConfig({ ...config, sync }));
    chrome.runtime.sendMessage({ action: 'config:set:item', key: "sync", value: sync }, (response) => {
    });
  }

  return (
    <div className="sync-settings-form">
    <div className="input-container">
      <label className="form-label">Auto-sync browser tabs to Canvas</label>
      <div className="form-control">
        <select 
          className="browser-default" 
          defaultValue={config.sync.autoSyncBrowserTabs} 
          onChange={(e) => saveSyncSettings(config, {...config.sync, autoSyncBrowserTabs: e.target.value as IConfigProps["sync"]["autoSyncBrowserTabs"] })}
        >
          <option value="Never">Never</option>
          <option value="On Context Change">On Context Change</option>
          <option value="Always">Always</option>
        </select>
      </div>
    </div>

    <div className="input-container">
      <label className="form-label">Auto-open canvas tabs in browser</label>
      <div className="form-control">
        <select 
          className="browser-default" 
          defaultValue={config.sync.autoOpenCanvasTabs} 
          onChange={(e) => saveSyncSettings(config, {...config.sync, autoOpenCanvasTabs: e.target.value as IConfigProps["sync"]["autoOpenCanvasTabs"] })}
        >
          <option value="Never">Never</option>
          <option value="On Context Change">On Context Change</option>
        </select>
      </div>
    </div>
      {/* <SyncSettingCheckbox 
    prop={'autoCloseTabs'} 
    title="Auto-sync browser tabs to Canvas" />

  <SyncSettingCheckbox 
    prop={'autoRestoreSession'} 
    title="Automatically switch tab-sets on context change" /> */}

  </div>
  );
};

export default SyncSettingsForm;