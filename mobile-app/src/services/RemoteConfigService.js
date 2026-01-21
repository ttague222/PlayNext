/**
 * PlayNxt Remote Config Service
 *
 * Fetches remote configuration for dynamic feature control.
 * Essential for App Store review control (disable ads without app update).
 */

import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@playnxt_remote_config';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Default configuration - used when remote fetch fails
const DEFAULT_CONFIG = {
  // Ad control
  ads_enabled: true,           // Master toggle - set to false during App Store review
  ads_test_mode: false,        // Force test ads in production builds
  ad_interval: 3,              // Show ad every N rerolls

  // Feature flags
  maintenance_mode: false,     // Kill switch for the app
  min_app_version: '1.0.0',    // Minimum supported version

  // Premium
  premium_enabled: true,       // Enable/disable premium purchases

  // Misc
  force_update: false,         // Force users to update
  announcement: null,          // Optional announcement message
};

class RemoteConfigService {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.lastFetchTime = null;
    this.listeners = new Set();
    this.isInitialized = false;
  }

  /**
   * Initialize the service and load cached config
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Load cached config first for instant availability
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { config, timestamp } = JSON.parse(cached);
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.lastFetchTime = timestamp;
      }
    } catch (error) {
      console.warn('[RemoteConfig] Failed to load cached config:', error);
    }

    this.isInitialized = true;

    // Fetch fresh config in background
    this.fetchConfig().catch(() => {});
  }

  /**
   * Fetch remote configuration from server
   */
  async fetchConfig() {
    try {
      const configUrl = this._getConfigUrl();
      if (!configUrl) {
        // No remote config URL configured - use defaults
        return this.config;
      }

      const response = await fetch(configUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Version': Constants.expoConfig?.version || '1.0.0',
          'X-Platform': Constants.platform?.os || 'unknown',
        },
        timeout: 5000,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const remoteConfig = await response.json();

      // Merge with defaults (remote config overrides defaults)
      this.config = { ...DEFAULT_CONFIG, ...remoteConfig };
      this.lastFetchTime = Date.now();

      // Cache the config
      await this._cacheConfig();

      // Notify listeners
      this._notifyListeners();

      return this.config;
    } catch (error) {
      console.warn('[RemoteConfig] Failed to fetch remote config:', error);
      // Return cached/default config on failure
      return this.config;
    }
  }

  /**
   * Get config URL from environment
   */
  _getConfigUrl() {
    const extra = Constants.expoConfig?.extra || {};
    return extra.remoteConfigUrl || process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL || null;
  }

  /**
   * Cache config to AsyncStorage
   */
  async _cacheConfig() {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          config: this.config,
          timestamp: this.lastFetchTime,
        })
      );
    } catch (error) {
      console.warn('[RemoteConfig] Failed to cache config:', error);
    }
  }

  /**
   * Notify all listeners of config changes
   */
  _notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.config);
      } catch (error) {
        console.warn('[RemoteConfig] Listener error:', error);
      }
    });
  }

  /**
   * Check if cache is stale and needs refresh
   */
  _isCacheStale() {
    if (!this.lastFetchTime) return true;
    return Date.now() - this.lastFetchTime > CACHE_DURATION_MS;
  }

  /**
   * Get a config value
   * @param {string} key - Config key
   * @param {*} defaultValue - Default value if key not found
   */
  getValue(key, defaultValue = null) {
    // Refresh in background if stale
    if (this._isCacheStale()) {
      this.fetchConfig().catch(() => {});
    }
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  /**
   * Get all config values
   */
  getAllConfig() {
    // Refresh in background if stale
    if (this._isCacheStale()) {
      this.fetchConfig().catch(() => {});
    }
    return { ...this.config };
  }

  // ============================================
  // Convenience getters for common config values
  // ============================================

  /**
   * Check if ads are enabled (master toggle)
   */
  areAdsEnabled() {
    return this.getValue('ads_enabled', true);
  }

  /**
   * Check if test mode is forced
   */
  isTestModeForced() {
    return this.getValue('ads_test_mode', false);
  }

  /**
   * Get ad interval (rerolls between ads)
   */
  getAdInterval() {
    return this.getValue('ad_interval', 3);
  }

  /**
   * Check if app is in maintenance mode
   */
  isMaintenanceMode() {
    return this.getValue('maintenance_mode', false);
  }

  /**
   * Check if premium purchases are enabled
   */
  isPremiumEnabled() {
    return this.getValue('premium_enabled', true);
  }

  /**
   * Get announcement message (if any)
   */
  getAnnouncement() {
    return this.getValue('announcement', null);
  }

  /**
   * Check if force update is required
   */
  isForceUpdateRequired() {
    return this.getValue('force_update', false);
  }

  // ============================================
  // Listener management
  // ============================================

  /**
   * Add a listener for config changes
   * @param {Function} listener - Callback function
   * @returns {Function} - Unsubscribe function
   */
  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove a listener
   * @param {Function} listener - Callback function to remove
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }
}

// Singleton instance
let instance = null;

export const getRemoteConfig = () => {
  if (!instance) {
    instance = new RemoteConfigService();
  }
  return instance;
};

export default RemoteConfigService;
