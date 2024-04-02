import { Dispatch } from 'redux';
import { ConfigActionTypes, SET_CONFIG } from './configActionTypes';
import config from '@/general/config';

export const setConfig = (conf: IConfigProps): ConfigActionTypes => ({
  type: SET_CONFIG,
  payload: conf,
});

export const loadInitialConfigState = () => async (dispatch: Dispatch<ConfigActionTypes>) => {
  try {
    // Retrieve sync state from Chrome storage
    const conf = await new Promise<IConfigProps>((resolve, reject) => {
      config.initialize().then(() => {
        resolve(config.allProps());
      })
    });

    // Dispatch action to set sync state
    dispatch(setConfig(conf));
  } catch (error) {
    console.error('Error loading initial state from Chrome storage:', error);
  }
};