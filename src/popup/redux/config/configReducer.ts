import configStore, { DEFAULT_CONFIG, UpdateOptions } from '@/general/ConfigStore';
import { ConfigActionTypes, SET_CONFIG } from './configActionTypes';

// Track if we're currently processing a config update to avoid loops
let isProcessingUpdate = false;

const configReducer = (state = DEFAULT_CONFIG, action: ConfigActionTypes): IConfigProps => {
  switch (action.type) {
    case SET_CONFIG:
      // Avoid recursive config updates
      if (isProcessingUpdate) {
        return {
          ...state,
          ...action.payload,
        };
      }

      try {
        isProcessingUpdate = true;

        // Check if we actually have changes
        if (JSON.stringify(action.payload) === JSON.stringify(state)) {
          isProcessingUpdate = false;
          return state; // No change needed
        }

        // Update our config store with source tracking
        const options: UpdateOptions = {
          source: 'local', // Mark as coming from Redux
          silent: false    // Allow events to propagate
        };

        // Start the update process - this is async but we don't wait
        configStore.update(action.payload, options)
          .catch(err => console.error('Error updating config store from reducer:', err))
          .finally(() => {
            isProcessingUpdate = false;
          });

        // Return the new state for Redux immediately
        return {
          ...state,
          ...action.payload,
        };
      } catch (error) {
        console.error('Error in config reducer:', error);
        isProcessingUpdate = false;
        return state;
      }
    default:
      return state;
  }
};

export default configReducer;
