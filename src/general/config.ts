/**
 * This file provides backward compatibility for modules that import from 'config.ts'
 * directly rather than using the ConfigStore singleton.
 *
 * New code should import from ConfigStore.ts directly.
 */

// Importing and re-exporting our ConfigStore implementation
import configStore, { DEFAULT_CONFIG, UpdateOptions, ConfigData } from './ConfigStore';

// Export for backward compatibility - consumers should migrate to using configStore directly
export { DEFAULT_CONFIG, UpdateOptions, ConfigData };

// Get a snapshot of the config for legacy consumers
const configSnapshot = configStore.getAll();

// Export the singleton as the preferred way to access config
export { configStore };

// Default export for backward compatibility
export default configSnapshot;
