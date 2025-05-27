// store.ts
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import tabReducer from './tabs/tabReducer';
import varReducer from './variables/varReducer';

const store = configureStore({
  reducer: combineReducers({ tabs: tabReducer, variables: varReducer }),
  middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware({
    serializableCheck: false,
  }),
});


export default store;
