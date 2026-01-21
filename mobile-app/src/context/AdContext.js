/**
 * PlayNxt Ad Context
 *
 * Manages ad state, tracking, and display logic.
 * Separate from PremiumContext for clean separation of concerns.
 *
 * Features:
 * - Remote config integration for App Store review control
 * - AsyncStorage persistence for tracking across sessions
 * - Preloading and retry logic
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getRemoteConfig } from '../services/RemoteConfigService';

const AdContext = createContext({});

// Storage key for ad tracking persistence
const AD_TRACKING_KEY = '@playnxt_ad_tracking';

// Default ad interval (can be overridden by remote config)
const DEFAULT_AD_INTERVAL = 3;

// Lazy load ad service to avoid loading AdMob when ads are disabled
let _adServiceModule = null;
const getAdService = () => {
  if (!_adServiceModule) {
    _adServiceModule = require('../services/adService');
  }
  return _adServiceModule.getAdService();
};

export const useAds = () => useContext(AdContext);

/**
 * Check if rewarded ads are enabled via environment variable
 */
const getEnvAdsEnabled = () => {
  const extra = Constants.expoConfig?.extra || {};
  if (extra.enableRewardedAds !== undefined) {
    return extra.enableRewardedAds === true || extra.enableRewardedAds === 'true';
  }
  const envValue = process.env.EXPO_PUBLIC_ENABLE_REWARDED_ADS;
  if (envValue !== undefined) {
    return envValue === 'true';
  }
  return true; // Default to enabled
};

export const AdProvider = ({ children }) => {
  // Remote config instance
  const remoteConfig = useRef(getRemoteConfig());

  // Ad state
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [isAdReady, setIsAdReady] = useState(false);
  const [adsEnabled, setAdsEnabled] = useState(getEnvAdsEnabled());
  const [adInterval, setAdInterval] = useState(DEFAULT_AD_INTERVAL);

  // Tracking state (persisted)
  const [totalRerollCount, setTotalRerollCount] = useState(0);
  const [dailyRerollCount, setDailyRerollCount] = useState(0); // Resets daily, determines free rerolls
  const [lastAdShownAt, setLastAdShownAt] = useState(null);
  const [adsWatchedToday, setAdsWatchedToday] = useState(0);
  const [trackingDate, setTrackingDate] = useState(null);

  // Initialization flag
  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Initialize remote config and load persisted tracking data
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize remote config
        await remoteConfig.current.initialize();

        // Update ads enabled state from remote config
        const remoteAdsEnabled = remoteConfig.current.areAdsEnabled();
        const envAdsEnabled = getEnvAdsEnabled();
        setAdsEnabled(remoteAdsEnabled && envAdsEnabled);

        // Get ad interval from remote config
        setAdInterval(remoteConfig.current.getAdInterval());

        // Load persisted tracking data
        await loadTrackingData();

        setIsInitialized(true);
      } catch (error) {
        console.warn('[AdContext] Initialization error:', error);
        setIsInitialized(true); // Continue with defaults
      }
    };

    initialize();
  }, []);

  /**
   * Listen for remote config changes
   */
  useEffect(() => {
    const unsubscribe = remoteConfig.current.addListener((config) => {
      const envAdsEnabled = getEnvAdsEnabled();
      setAdsEnabled(config.ads_enabled && envAdsEnabled);
      setAdInterval(config.ad_interval || DEFAULT_AD_INTERVAL);
    });

    return unsubscribe;
  }, []);

  /**
   * Load tracking data from AsyncStorage
   */
  const loadTrackingData = async () => {
    try {
      const stored = await AsyncStorage.getItem(AD_TRACKING_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const today = new Date().toDateString();

        // Check if it's a new day - reset daily counters
        if (data.trackingDate !== today) {
          setTrackingDate(today);
          setAdsWatchedToday(0);
          setDailyRerollCount(0); // Reset free rerolls for new day
          // Keep total reroll count across days
          setTotalRerollCount(data.totalRerollCount || 0);
        } else {
          setTrackingDate(data.trackingDate);
          setAdsWatchedToday(data.adsWatchedToday || 0);
          setDailyRerollCount(data.dailyRerollCount || 0); // Restore today's reroll count
          setTotalRerollCount(data.totalRerollCount || 0);
          setLastAdShownAt(data.lastAdShownAt ? new Date(data.lastAdShownAt) : null);
        }
      } else {
        // First time - initialize tracking
        setTrackingDate(new Date().toDateString());
      }
    } catch (error) {
      console.warn('[AdContext] Failed to load tracking data:', error);
    }
  };

  /**
   * Save tracking data to AsyncStorage
   */
  const saveTrackingData = useCallback(async () => {
    try {
      const data = {
        totalRerollCount,
        dailyRerollCount,
        adsWatchedToday,
        trackingDate: trackingDate || new Date().toDateString(),
        lastAdShownAt: lastAdShownAt?.toISOString() || null,
      };
      await AsyncStorage.setItem(AD_TRACKING_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('[AdContext] Failed to save tracking data:', error);
    }
  }, [totalRerollCount, dailyRerollCount, adsWatchedToday, trackingDate, lastAdShownAt]);

  /**
   * Save tracking data when values change
   */
  useEffect(() => {
    if (isInitialized) {
      saveTrackingData();
    }
  }, [totalRerollCount, dailyRerollCount, adsWatchedToday, isInitialized, saveTrackingData]);

  /**
   * Preload rewarded ad
   */
  const preloadAd = useCallback(async () => {
    if (!adsEnabled) return;

    try {
      setIsAdLoading(true);
      const adService = getAdService();
      await adService.loadRewardedAd();
      setIsAdReady(adService.isAdReady());
    } catch (error) {
      console.warn('[AdContext] Failed to preload ad:', error);
      setIsAdReady(false);
    } finally {
      setIsAdLoading(false);
    }
  }, [adsEnabled]);

  /**
   * Preload ad on initialization and when approaching ad interval
   */
  useEffect(() => {
    if (isInitialized && adsEnabled) {
      // Preload when we're about to need an ad (approaching or past free reroll limit)
      const shouldPreload = dailyRerollCount >= adInterval - 1;

      if (shouldPreload || dailyRerollCount === 0) {
        preloadAd();
      }
    }
  }, [isInitialized, adsEnabled, dailyRerollCount, adInterval, preloadAd]);

  /**
   * Check if next reroll should show an ad
   * @param {boolean} isPremium - Whether user is premium
   */
  const shouldShowAdBeforeReroll = useCallback(
    (isPremium = false) => {
      if (isPremium) return false;
      if (!adsEnabled) return false;

      // First N rerolls are free, then every reroll after requires an ad
      // e.g., if adInterval=3: rerolls 1-3 are free, reroll 4+ shows ad
      return dailyRerollCount >= adInterval;
    },
    [adsEnabled, dailyRerollCount, adInterval]
  );

  /**
   * Show a rewarded ad
   * @returns {Promise<boolean>} - Whether the ad was completed successfully
   */
  const showRewardedAd = useCallback(async () => {
    if (!adsEnabled) {
      return true; // Allow action if ads disabled
    }

    try {
      setIsAdLoading(true);
      const adService = getAdService();
      const rewardEarned = await adService.showRewardedAd();

      if (rewardEarned) {
        // Update tracking
        setAdsWatchedToday((prev) => prev + 1);
        setLastAdShownAt(new Date());
      } else {
        Alert.alert(
          'Ad Not Completed',
          'Please watch the full ad to continue.',
          [{ text: 'OK' }]
        );
      }

      // Preload next ad
      preloadAd();

      return rewardEarned;
    } catch (error) {
      console.warn('[AdContext] Failed to show ad:', error);
      Alert.alert(
        'Ad Error',
        'Unable to show ad right now. Please try again later.',
        [{ text: 'OK' }]
      );
      return false;
    } finally {
      setIsAdLoading(false);
      const adService = getAdService();
      setIsAdReady(adService.isAdReady());
    }
  }, [adsEnabled, preloadAd]);

  /**
   * Record a reroll (call this after each reroll)
   */
  const recordReroll = useCallback(() => {
    setDailyRerollCount((prev) => prev + 1);
    setTotalRerollCount((prev) => prev + 1);
  }, []);

  /**
   * Record a recommendation fetch (initial or reroll)
   * This prevents the exploit where users navigate back to get free recommendations
   * Every fetch counts toward the daily reroll count
   */
  const recordRecommendationFetch = useCallback(() => {
    // Every recommendation fetch counts as a reroll
    // The first N fetches are free (determined by adInterval), then ads are shown
    setDailyRerollCount((prev) => prev + 1);
    setTotalRerollCount((prev) => prev + 1);
  }, []);

  /**
   * Get number of free rerolls remaining before ads start
   * @param {boolean} isPremium - Whether user is premium
   */
  const getRerollsUntilAd = useCallback(
    (isPremium = false) => {
      if (isPremium || !adsEnabled) return Infinity;
      // First N rerolls are free, then every reroll requires an ad
      const remaining = adInterval - dailyRerollCount;
      return Math.max(0, remaining);
    },
    [adsEnabled, dailyRerollCount, adInterval]
  );

  /**
   * Reset daily tracking (e.g., for testing or manual reset)
   */
  const resetDailyTracking = useCallback(() => {
    setDailyRerollCount(0);
    setAdsWatchedToday(0);
  }, []);

  /**
   * Check if should show premium upsell after ad
   */
  const shouldShowPremiumPrompt = useCallback(() => {
    // Show after every 2nd ad watched
    return adsWatchedToday > 0 && adsWatchedToday % 2 === 0;
  }, [adsWatchedToday]);

  /**
   * Get ad status for debugging/display
   */
  const getAdStatus = useCallback(() => {
    return {
      adsEnabled,
      isAdReady,
      isAdLoading,
      dailyRerollCount,
      totalRerollCount,
      adsWatchedToday,
      adInterval,
      lastAdShownAt,
    };
  }, [
    adsEnabled,
    isAdReady,
    isAdLoading,
    dailyRerollCount,
    totalRerollCount,
    adsWatchedToday,
    adInterval,
    lastAdShownAt,
  ]);

  /**
   * Force refresh remote config
   */
  const refreshConfig = useCallback(async () => {
    try {
      await remoteConfig.current.fetchConfig();
      const envAdsEnabled = getEnvAdsEnabled();
      setAdsEnabled(remoteConfig.current.areAdsEnabled() && envAdsEnabled);
      setAdInterval(remoteConfig.current.getAdInterval());
    } catch (error) {
      console.warn('[AdContext] Failed to refresh config:', error);
    }
  }, []);

  const value = {
    // State
    adsEnabled,
    isAdReady,
    isAdLoading,
    isInitialized,
    dailyRerollCount,
    totalRerollCount,
    adsWatchedToday,
    adInterval,

    // Actions
    preloadAd,
    showRewardedAd,
    recordReroll,
    recordRecommendationFetch,
    resetDailyTracking,
    refreshConfig,

    // Checks
    shouldShowAdBeforeReroll,
    shouldShowPremiumPrompt,
    getRerollsUntilAd,
    getAdStatus,
  };

  return <AdContext.Provider value={value}>{children}</AdContext.Provider>;
};

export default AdContext;
