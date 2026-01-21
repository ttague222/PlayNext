/**
 * PlayNxt Development Settings
 *
 * Centralized toggle for all development/testing features.
 * Set these to false for production builds!
 */

// Master switch - set to false for production
export const DEV_MODE = false;

// Individual feature toggles (only active when DEV_MODE is true)
export const DEV_SETTINGS = {
  // Unlock all premium features without subscription
  UNLOCK_PREMIUM: true,

  // Show debug logging in console
  DEBUG_LOGGING: false,

  // Skip authentication requirements
  SKIP_AUTH: false,
};

/**
 * Helper to check if a dev feature is enabled
 * Returns false if DEV_MODE is off, otherwise returns the feature setting
 */
export const isDevFeatureEnabled = (feature) => {
  if (!DEV_MODE) return false;
  return DEV_SETTINGS[feature] ?? false;
};

/**
 * Quick check for premium dev mode
 */
export const isDevPremiumEnabled = () => isDevFeatureEnabled('UNLOCK_PREMIUM');
