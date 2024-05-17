import React from 'react';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';
import { setConfig } from '../../redux/config/configActions';
import { Dispatch } from 'redux';
import { RUNTIME_MESSAGES } from '@/general/constants';
import SettingCheckbox from '@/popup/common-components/inputs/SettingCheckbox';
import { browser } from '@/general/utils';

const BrowserIdentitySettingsForm: React.FC<any> = ({ }) => {
  const config: IConfigProps = useSelector((state: { config: IConfigProps }) => state.config);
  const dispatch = useDispatch<Dispatch<any>>();

  const saveBrowserIdentitySettings = (config: IConfigProps, browserIdentity: IConfigProps["browserIdentity"]) => {
    dispatch(setConfig({ ...config, browserIdentity }));
    browser.runtime.sendMessage({ action: RUNTIME_MESSAGES.config_set_item, key: "browserIdentity", value: browserIdentity }, (response) => {});
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
            onChange={(e) => saveBrowserIdentitySettings(config, { ...config.browserIdentity, browserTag: e.target.value })} 
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