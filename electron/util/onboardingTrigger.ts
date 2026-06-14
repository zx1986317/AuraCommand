/**
 * Re-export from src/shared/ — canonical location for renderer-safe pure functions.
 * Electron main-process code can import from here for convenience.
 */
export {
  decideOnboardingTrigger,
  type OnboardingTriggerInput,
  type OnboardingTriggerResult,
} from '../../src/shared/onboardingTrigger'
