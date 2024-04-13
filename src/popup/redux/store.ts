// store.ts
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import configReducer from './config/configReducer';
import tabReducer from './tabs/tabReducer';
import varReducer from './variables/varReducer';

// const store = configureStore(configReducer);

const store = configureStore({
  reducer: combineReducers({ config: configReducer, tabs: tabReducer, variables: varReducer }),
  middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware({
    serializableCheck: false,
  }),
});


export default store;
