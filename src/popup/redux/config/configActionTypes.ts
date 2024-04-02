export const SET_CONFIG = 'SET_CONFIG';

interface SetConfig {
  type: 'SET_CONFIG';
  payload: IConfigProps;
}

export type ConfigActionTypes = SetConfig;
