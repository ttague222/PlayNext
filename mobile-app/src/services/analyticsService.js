/**
 * PlayNxt Analytics Service
 *
 * Thin wrapper around Firebase Analytics (native module, @react-native-firebase/analytics).
 * Analytics must never break the app: if the native module is unavailable
 * (web, Expo Go, tests), every call silently no-ops.
 */

import { Platform } from 'react-native';

let _firebaseAnalytics = null; // module exports
let _instance = null; // analytics instance
let _unavailable = false;

const getAnalyticsInstance = () => {
  if (_instance || _unavailable) return _instance;

  if (Platform.OS === 'web') {
    _unavailable = true;
    return null;
  }

  try {
    _firebaseAnalytics = require('@react-native-firebase/analytics');
    _instance = _firebaseAnalytics.getAnalytics();
  } catch {
    // Native module not linked (Expo Go, web bundle) — disable for this session
    _unavailable = true;
    console.warn('[Analytics] Firebase Analytics unavailable, events disabled');
  }
  return _instance;
};

/**
 * Log an analytics event. Fire-and-forget — errors are swallowed.
 * @param {string} name - snake_case event name (GA4 style)
 * @param {Object} [params] - flat map of string/number params
 */
export const logEvent = (name, params = {}) => {
  const instance = getAnalyticsInstance();
  if (!instance) return;
  try {
    _firebaseAnalytics.logEvent(instance, name, params)?.catch?.(() => {});
  } catch {
    // Never let analytics break app flow
  }
};

/**
 * Log a screen view (GA4 screen_view event).
 * @param {string} screenName
 */
export const logScreenView = (screenName) => {
  const instance = getAnalyticsInstance();
  if (!instance || !screenName) return;
  try {
    _firebaseAnalytics
      .logScreenView(instance, { screen_name: screenName, screen_class: screenName })
      ?.catch?.(() => {});
  } catch {
    // Never let analytics break app flow
  }
};

/**
 * Associate events with the signed-in user (pass null on sign-out).
 * @param {string|null} userId
 */
export const setAnalyticsUserId = (userId) => {
  const instance = getAnalyticsInstance();
  if (!instance) return;
  try {
    _firebaseAnalytics.setUserId(instance, userId || null)?.catch?.(() => {});
  } catch {
    // Never let analytics break app flow
  }
};

/**
 * Test-only: reset cached module state so availability is re-evaluated.
 */
export const _resetForTesting = () => {
  _firebaseAnalytics = null;
  _instance = null;
  _unavailable = false;
};
