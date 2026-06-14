/**
 * Re-export from src/shared/ — canonical location for renderer-safe pure functions.
 * Electron main-process code can import from here for convenience.
 */
export { applyCapabilityMutex, isCapabilityDisabled, type Caps } from '../../src/shared/capabilityMutex'
