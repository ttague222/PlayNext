/**
 * Ad Service Tests
 *
 * Covers the ATT consent flow: the tracking prompt and SDK initialization
 * must run before the first ad request, and the personalization flag on ad
 * requests must follow the ATT result.
 */

import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import mobileAds, { RewardedAd } from 'react-native-google-mobile-ads';
import AdService from '../src/services/adService';

describe('AdService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('requests ATT permission and initializes the SDK exactly once', async () => {
      const service = new AdService();

      await service.initialize();
      await service.initialize();

      expect(requestTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(mobileAds).toHaveBeenCalledTimes(1);
      expect(service.isInitialized).toBe(true);
    });

    it('allows personalized ads only when tracking is granted', async () => {
      requestTrackingPermissionsAsync.mockResolvedValueOnce({
        status: 'granted',
      });
      const service = new AdService();

      await service.initialize();

      expect(service.personalizedAdsAllowed).toBe(true);
    });

    it('defaults to non-personalized ads when tracking is denied', async () => {
      const service = new AdService(); // setup mock resolves { status: 'denied' }

      await service.initialize();

      expect(service.personalizedAdsAllowed).toBe(false);
    });

    it('still initializes the SDK if the ATT request fails', async () => {
      requestTrackingPermissionsAsync.mockRejectedValueOnce(
        new Error('ATT unavailable')
      );
      const service = new AdService();

      await service.initialize();

      expect(service.personalizedAdsAllowed).toBe(false);
      expect(service.isInitialized).toBe(true);
      expect(mobileAds).toHaveBeenCalled();
    });
  });

  describe('loadRewardedAd', () => {
    it('initializes (ATT + SDK) before creating the first ad request', async () => {
      const service = new AdService();

      await service.loadRewardedAd();

      expect(requestTrackingPermissionsAsync).toHaveBeenCalled();
      const attOrder =
        requestTrackingPermissionsAsync.mock.invocationCallOrder[0];
      const adRequestOrder =
        RewardedAd.createForAdRequest.mock.invocationCallOrder[0];
      expect(attOrder).toBeLessThan(adRequestOrder);
    });

    it('requests non-personalized ads when tracking is denied', async () => {
      const service = new AdService();

      await service.loadRewardedAd();

      expect(RewardedAd.createForAdRequest).toHaveBeenCalledWith(
        expect.any(String),
        { requestNonPersonalizedAdsOnly: true }
      );
    });

    it('requests personalized ads when tracking is granted', async () => {
      requestTrackingPermissionsAsync.mockResolvedValueOnce({
        status: 'granted',
      });
      const service = new AdService();

      await service.loadRewardedAd();

      expect(RewardedAd.createForAdRequest).toHaveBeenCalledWith(
        expect.any(String),
        { requestNonPersonalizedAdsOnly: false }
      );
    });
  });
});
