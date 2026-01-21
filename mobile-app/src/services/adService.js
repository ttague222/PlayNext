/**
 * PlayNxt Ad Service
 *
 * Manages Google AdMob rewarded ads for the "watch ad for reroll" feature.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

// Get ad unit IDs from config (falls back to test IDs)
const getRewardedAdUnitId = () => {
  const extra = Constants.expoConfig?.extra || {};

  // In development, always use test ads
  if (__DEV__) {
    return TestIds.REWARDED;
  }

  // In production, use configured ad unit IDs
  if (Platform.OS === 'ios') {
    return extra.admobRewardedAdUnitIdIos || TestIds.REWARDED;
  }
  return extra.admobRewardedAdUnitIdAndroid || TestIds.REWARDED;
};

class AdService {
  constructor() {
    this.rewardedAd = null;
    this.isLoading = false;
    this.isLoaded = false;
    this.onRewardEarned = null;
    this.onAdClosed = null;
    this.onAdFailed = null;
  }

  /**
   * Initialize and preload a rewarded ad
   */
  async loadRewardedAd() {
    if (this.isLoading || this.isLoaded) {
      return;
    }

    this.isLoading = true;

    try {
      const adUnitId = getRewardedAdUnitId();
      this.rewardedAd = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      // Set up event listeners
      const unsubscribeLoaded = this.rewardedAd.addAdEventListener(
        RewardedAdEventType.LOADED,
        () => {
          this.isLoaded = true;
          this.isLoading = false;
        }
      );

      const unsubscribeEarnedReward = this.rewardedAd.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        (reward) => {
          if (this.onRewardEarned) {
            this.onRewardEarned(reward);
          }
        }
      );

      // Store unsubscribe functions for cleanup
      this._unsubscribeLoaded = unsubscribeLoaded;
      this._unsubscribeEarnedReward = unsubscribeEarnedReward;

      // Load the ad
      await this.rewardedAd.load();
    } catch (error) {
      this.isLoading = false;
      this.isLoaded = false;
      console.warn('Failed to load rewarded ad:', error);
      throw error;
    }
  }

  /**
   * Show the rewarded ad
   * @returns {Promise<boolean>} - Whether the reward was earned
   */
  async showRewardedAd() {
    return new Promise(async (resolve, reject) => {
      if (!this.rewardedAd || !this.isLoaded) {
        // Try to load if not loaded
        try {
          await this.loadRewardedAd();
          // Wait a bit for the ad to be ready
          await new Promise((r) => setTimeout(r, 500));

          if (!this.isLoaded) {
            reject(new Error('Ad not ready. Please try again.'));
            return;
          }
        } catch (error) {
          reject(new Error('Failed to load ad. Please try again later.'));
          return;
        }
      }

      let rewardEarned = false;

      // Set up one-time reward callback
      this.onRewardEarned = (reward) => {
        rewardEarned = true;
      };

      // Listen for ad close
      const unsubscribeClosed = this.rewardedAd.addAdEventListener(
        'closed',
        () => {
          unsubscribeClosed();
          this.cleanup();

          if (rewardEarned) {
            resolve(true);
          } else {
            // User closed ad without watching fully
            resolve(false);
          }

          // Preload next ad
          this.loadRewardedAd();
        }
      );

      try {
        await this.rewardedAd.show();
      } catch (error) {
        unsubscribeClosed();
        this.cleanup();
        reject(error);
      }
    });
  }

  /**
   * Check if a rewarded ad is ready to show
   */
  isAdReady() {
    return this.isLoaded && this.rewardedAd !== null;
  }

  /**
   * Check if an ad is currently loading
   */
  isAdLoading() {
    return this.isLoading;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.isLoaded = false;
    this.onRewardEarned = null;

    if (this._unsubscribeLoaded) {
      this._unsubscribeLoaded();
      this._unsubscribeLoaded = null;
    }
    if (this._unsubscribeEarnedReward) {
      this._unsubscribeEarnedReward();
      this._unsubscribeEarnedReward = null;
    }
  }
}

// Singleton instance
let adServiceInstance = null;

export const getAdService = () => {
  if (!adServiceInstance) {
    adServiceInstance = new AdService();
  }
  return adServiceInstance;
};

export default AdService;
