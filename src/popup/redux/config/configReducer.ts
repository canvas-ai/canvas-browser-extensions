import config, { DEFAULT_CONFIG } from '@/general/config';
import { ConfigActionTypes, SET_CONFIG } from './configActionTypes';

const saveConfigToStorage = (cfg: IConfigProps) => {
  console.log("saving config to storage...", cfg);
  config.set("sync", cfg.sync);
  config.set("transport", cfg.transport);
  config.set("session", cfg.session);
};

const configReducer = (state = DEFAULT_CONFIG, action: ConfigActionTypes): IConfigProps => {
  switch (action.type) {
    case SET_CONFIG:
      const result = {
        ...state,
        ...action.payload,
      };
      saveConfigToStorage(result);
      return result;
    default:
      return state;
  }
};

export default configReducer;
