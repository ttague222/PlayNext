/**
 * Jest Setup File
 *
 * Configure mocks and global test utilities.
 */

// Mock Firebase
jest.mock('./src/config/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: jest.fn((callback) => {
      callback(null);
      return jest.fn(); // Unsubscribe function
    }),
    signInAnonymously: jest.fn(),
    signOut: jest.fn(),
  },
  db: {},
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiBaseUrl: 'http://localhost:8000/api',
    },
  },
}));

// Mock Firebase Analytics (native module, not available in jest)
jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(() => ({})),
  logEvent: jest.fn(() => Promise.resolve()),
  logScreenView: jest.fn(() => Promise.resolve()),
  setUserId: jest.fn(() => Promise.resolve()),
}));

// Mock expo-tracking-transparency (ATT prompt)
jest.mock('expo-tracking-transparency', () => ({
  requestTrackingPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'denied' })
  ),
  getTrackingPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'denied' })
  ),
}));

// Mock react-native-google-mobile-ads (native module, not available in jest)
jest.mock('react-native-google-mobile-ads', () => {
  const mobileAds = jest.fn(() => ({
    initialize: jest.fn(() => Promise.resolve()),
  }));
  return {
    __esModule: true,
    default: mobileAds,
    RewardedAd: {
      createForAdRequest: jest.fn(() => ({
        addAdEventListener: jest.fn(() => jest.fn()),
        load: jest.fn(() => Promise.resolve()),
        show: jest.fn(() => Promise.resolve()),
      })),
    },
    RewardedAdEventType: {
      LOADED: 'rewarded_loaded',
      EARNED_REWARD: 'rewarded_earned_reward',
    },
    TestIds: {
      REWARDED: 'test-rewarded-ad-unit',
    },
  };
});

// Mock expo-store-review (native module, not available in jest)
jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  requestReview: jest.fn(() => Promise.resolve()),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
    ok: true,
  })
);
