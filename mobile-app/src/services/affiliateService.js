/**
 * PlayNxt Affiliate Service
 *
 * Generates affiliate links and tracks clicks for revenue.
 * Supports various game stores and subscription services.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Feature toggle - enable when affiliate accounts are set up
const ENABLE_AFFILIATE_TRACKING = false;

// Storage key for click tracking
const CLICK_STATS_KEY = '@playnxt_affiliate_clicks';

// Affiliate configuration for stores
// TODO: Add your affiliate IDs when accounts are set up
const STORE_AFFILIATE_CONFIG = {
  steam: {
    // Steam doesn't have traditional affiliate links
    // Consider using SteamDB or similar if available
    affiliateId: null,
    enabled: false,
  },
  playstation: {
    // PlayStation Partners program
    affiliateId: null,
    enabled: false,
    // Format: add ?emcid=AFFILIATE_ID to URLs
    paramName: 'emcid',
  },
  xbox: {
    // Microsoft affiliate program
    affiliateId: null,
    enabled: false,
    // Format: add ?cid=AFFILIATE_ID to URLs
    paramName: 'cid',
  },
  nintendo: {
    // Nintendo doesn't have public affiliate program
    affiliateId: null,
    enabled: false,
  },
  epic: {
    // Epic Games Creator Program
    affiliateId: null,
    enabled: false,
    // Format: epic games creator code
    paramName: 'creator',
  },
  gog: {
    // GOG affiliate program
    affiliateId: null,
    enabled: false,
    paramName: 'pp',
  },
  ios: {
    // Apple App Store affiliate program (Apple Services Performance Partners)
    affiliateId: null,
    enabled: false,
    // Format: add ?at=AFFILIATE_TOKEN to App Store URLs
    paramName: 'at',
  },
  android: {
    // Google Play doesn't have a traditional affiliate program
    // Direct links are used
    affiliateId: null,
    enabled: false,
  },
};

// Subscription service referral configuration
const SUBSCRIPTION_AFFILIATE_CONFIG = {
  xbox_game_pass: {
    // Microsoft Game Pass referral program
    affiliateId: null,
    enabled: false,
    referralUrl: 'https://www.xbox.com/en-US/xbox-game-pass',
  },
  playstation_plus: {
    affiliateId: null,
    enabled: false,
    referralUrl: 'https://www.playstation.com/en-us/ps-plus/',
  },
  ea_play: {
    affiliateId: null,
    enabled: false,
    referralUrl: 'https://www.ea.com/ea-play',
  },
  ubisoft_plus: {
    affiliateId: null,
    enabled: false,
    referralUrl: 'https://www.ubisoft.com/en-us/ubisoft-plus',
  },
  nintendo_switch_online: {
    affiliateId: null,
    enabled: false,
    referralUrl: 'https://www.nintendo.com/switch/online/',
  },
  netflix_games: {
    affiliateId: null,
    enabled: false,
    referralUrl: 'https://www.netflix.com/browse/genre/81702502',
  },
  amazon_luna: {
    // Amazon Associates program
    affiliateId: null,
    enabled: false,
    referralUrl: 'https://www.amazon.com/luna/landing-page',
    paramName: 'tag',
  },
  apple_arcade: {
    affiliateId: null,
    enabled: false,
    referralUrl: 'https://www.apple.com/apple-arcade/',
  },
};

/**
 * Generate affiliate-wrapped store link
 * @param {string} store - Store identifier (steam, xbox, etc.)
 * @param {string} originalUrl - Original store URL
 * @param {string} gameId - Game ID for tracking
 * @returns {string} - Affiliate-wrapped URL or original if not enabled
 */
export const generateStoreAffiliateLink = (store, originalUrl, gameId) => {
  if (!ENABLE_AFFILIATE_TRACKING || !originalUrl) {
    return originalUrl;
  }

  const config = STORE_AFFILIATE_CONFIG[store];
  if (!config?.enabled || !config?.affiliateId) {
    return originalUrl;
  }

  try {
    const url = new URL(originalUrl);

    // Add affiliate parameter
    if (config.paramName) {
      url.searchParams.set(config.paramName, config.affiliateId);
    }

    // Add tracking parameter for our analytics
    url.searchParams.set('utm_source', 'playnxt');
    url.searchParams.set('utm_medium', 'app');
    url.searchParams.set('utm_campaign', `game_${gameId}`);

    return url.toString();
  } catch (error) {
    console.warn('[affiliateService] Failed to generate store affiliate link:', error);
    return originalUrl;
  }
};

/**
 * Generate affiliate-wrapped subscription service link
 * @param {string} service - Subscription service identifier
 * @param {string} gameTitle - Game title for tracking context
 * @returns {string|null} - Affiliate referral URL or null if not available
 */
export const generateSubscriptionAffiliateLink = (service, gameTitle = null) => {
  const config = SUBSCRIPTION_AFFILIATE_CONFIG[service];
  if (!config?.referralUrl) {
    return null;
  }

  if (!ENABLE_AFFILIATE_TRACKING || !config.enabled) {
    return config.referralUrl;
  }

  try {
    const url = new URL(config.referralUrl);

    // Add affiliate parameter if configured
    if (config.paramName && config.affiliateId) {
      url.searchParams.set(config.paramName, config.affiliateId);
    }

    // Add tracking parameters
    url.searchParams.set('utm_source', 'playnxt');
    url.searchParams.set('utm_medium', 'app');
    if (gameTitle) {
      url.searchParams.set('utm_content', gameTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase());
    }

    return url.toString();
  } catch (error) {
    console.warn('[affiliateService] Failed to generate subscription affiliate link:', error);
    return config.referralUrl;
  }
};

/**
 * Track an affiliate link click for analytics
 * @param {string} linkType - 'store' or 'subscription'
 * @param {string} provider - Store or service name
 * @param {string} gameId - Game ID
 * @param {string} gameTitle - Game title
 */
export const trackAffiliateClick = async (linkType, provider, gameId, gameTitle) => {
  try {
    // Get existing stats
    const statsJson = await AsyncStorage.getItem(CLICK_STATS_KEY);
    const stats = statsJson ? JSON.parse(statsJson) : { clicks: [], summary: {} };

    // Add new click
    const click = {
      type: linkType,
      provider,
      gameId,
      gameTitle,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
    };
    stats.clicks.push(click);

    // Update summary
    const key = `${linkType}_${provider}`;
    stats.summary[key] = (stats.summary[key] || 0) + 1;

    // Keep only last 100 clicks to prevent storage bloat
    if (stats.clicks.length > 100) {
      stats.clicks = stats.clicks.slice(-100);
    }

    await AsyncStorage.setItem(CLICK_STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.warn('[affiliateService] Failed to track click:', error);
  }
};

/**
 * Get affiliate click statistics for analytics
 * @returns {Promise<Object>} - Click statistics
 */
export const getAffiliateStats = async () => {
  try {
    const statsJson = await AsyncStorage.getItem(CLICK_STATS_KEY);
    return statsJson ? JSON.parse(statsJson) : { clicks: [], summary: {} };
  } catch (error) {
    console.warn('[affiliateService] Failed to get stats:', error);
    return { clicks: [], summary: {} };
  }
};

/**
 * Check if affiliate tracking is enabled
 * @returns {boolean}
 */
export const isAffiliateTrackingEnabled = () => {
  return ENABLE_AFFILIATE_TRACKING;
};

/**
 * Check if a specific store has affiliate enabled
 * @param {string} store - Store identifier
 * @returns {boolean}
 */
export const isStoreAffiliateEnabled = (store) => {
  const config = STORE_AFFILIATE_CONFIG[store];
  return ENABLE_AFFILIATE_TRACKING && config?.enabled && !!config?.affiliateId;
};

/**
 * Check if a subscription service has affiliate enabled
 * @param {string} service - Service identifier
 * @returns {boolean}
 */
export const isSubscriptionAffiliateEnabled = (service) => {
  const config = SUBSCRIPTION_AFFILIATE_CONFIG[service];
  return ENABLE_AFFILIATE_TRACKING && config?.enabled && !!config?.affiliateId;
};

export default {
  generateStoreAffiliateLink,
  generateSubscriptionAffiliateLink,
  trackAffiliateClick,
  getAffiliateStats,
  isAffiliateTrackingEnabled,
  isStoreAffiliateEnabled,
  isSubscriptionAffiliateEnabled,
};
