/**
 * Re-export from src/shared/ — canonical location for renderer-safe pure functions.
 * Electron main-process code can import from here for convenience.
 */
export {
  createHistoryCore,
  applyChange,
  undoStep,
  redoStep,
  type HistoryCore,
} from '../../src/shared/historyCore'
