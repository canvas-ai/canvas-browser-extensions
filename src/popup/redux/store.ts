// store.ts
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import configReducer from './config/configReducer';
import config from '@/general/config';
import tabReducer from './tabs/tabReducer';

// const store = configureStore(configReducer);

const store = configureStore({
  reducer: combineReducers({ config: configReducer, tabs: tabReducer }),
  middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware({
    serializableCheck: false,
  }),
});


export default store;
