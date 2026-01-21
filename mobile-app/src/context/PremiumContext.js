/**
 * PlayNxt Premium Context
 *
 * Manages premium subscription state and feature access.
 * RevenueCat integration is behind a feature toggle for development.
 *
 * Note: Ad management has been moved to AdContext for clean separation.
 * This context re-exports ad functions for backward compatibility.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { useAds } from './AdContext';

const PremiumContext = createContext({});

export const usePremium = () => useContext(PremiumContext);

// Feature toggle - set to true to enable RevenueCat
const ENABLE_REVENUECAT = true;

// Premium features - now only ad-free
const PREMIUM_FEATURES = {
  adFree: true,
};

// Lazy load RevenueCat service only when needed to avoid SDK initialization issues
let _purchaseServiceModule = null;
let _purchaseServiceLoadFailed = false;

const getPurchaseService = () => {
  if (!ENABLE_REVENUECAT) return null;
  if (_purchaseServiceLoadFailed) return null;

  if (!_purchaseServiceModule) {
    try {
      _purchaseServiceModule = require('../services/purchaseService');
    } catch (error) {
      console.warn('[PremiumContext] Failed to load purchase service:', error);
      _purchaseServiceLoadFailed = true;
      return null;
    }
  }
  return _purchaseServiceModule;
};

export const PremiumProvider = ({ children }) => {
  const { user } = useAuth();

  // Get ad functions from AdContext (for backward compatibility)
  const ads = useAds();

  // Premium state
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [packages, setPackages] = useState([]);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [entitlement, setEntitlement] = useState(null);

  /**
   * Initialize RevenueCat and check subscription status (only if enabled)
   */
  useEffect(() => {
    const purchaseService = getPurchaseService();
    if (!ENABLE_REVENUECAT || !purchaseService) {
      // RevenueCat disabled or failed to load - running in free tier mode
      return;
    }

    const init = async () => {
      try {
        setIsLoading(true);

        // Initialize RevenueCat
        await purchaseService.initializePurchases();

        // If user is logged in, sync with RevenueCat
        if (user?.uid) {
          await purchaseService.loginUser(user.uid);
        }

        // Check premium status
        await refreshPremiumStatus();

        // Load available packages
        await loadPackages();
      } catch (error) {
        // Initialization error - silent fail
        console.warn('[PremiumContext] RevenueCat initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  /**
   * Sync user with RevenueCat when auth state changes
   */
  useEffect(() => {
    const purchaseService = getPurchaseService();
    if (!ENABLE_REVENUECAT || !purchaseService) return;

    const syncUser = async () => {
      if (user?.uid) {
        try {
          await purchaseService.loginUser(user.uid);
          await refreshPremiumStatus();
        } catch (error) {
          // Failed to sync user - silent fail
        }
      } else {
        try {
          await purchaseService.logoutUser();
          setIsPremium(false);
          setEntitlement(null);
          setCustomerInfo(null);
        } catch (error) {
          // Failed to logout user - silent fail
        }
      }
    };

    syncUser();
  }, [user?.uid]);

  /**
   * Listen for customer info updates
   */
  useEffect(() => {
    const purchaseService = getPurchaseService();
    if (!ENABLE_REVENUECAT || !purchaseService) return;

    const unsubscribe = purchaseService.addCustomerInfoListener((info) => {
      // Customer info updated
      setCustomerInfo(info);

      const premium = info.entitlements.active[purchaseService.ENTITLEMENTS.PREMIUM] !== undefined;
      setIsPremium(premium);

      if (premium) {
        setEntitlement(info.entitlements.active[purchaseService.ENTITLEMENTS.PREMIUM]);
      } else {
        setEntitlement(null);
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  /**
   * Refresh premium status from RevenueCat
   */
  const refreshPremiumStatus = useCallback(async () => {
    const purchaseService = getPurchaseService();
    if (!ENABLE_REVENUECAT || !purchaseService) {
      return false;
    }

    try {
      const status = await purchaseService.checkPremiumStatus();
      setIsPremium(status.isPremium);
      setEntitlement(status.entitlement);
      setCustomerInfo(status.customerInfo);
      return status.isPremium;
    } catch (error) {
      // Failed to refresh status - silent fail
      return false;
    }
  }, []);

  /**
   * Load available subscription packages
   */
  const loadPackages = useCallback(async () => {
    const purchaseService = getPurchaseService();
    if (!ENABLE_REVENUECAT || !purchaseService) {
      console.log('[PremiumContext] RevenueCat disabled or service not loaded');
      return [];
    }

    try {
      console.log('[PremiumContext] Loading packages...');
      const availablePackages = await purchaseService.getCurrentPackages();
      console.log('[PremiumContext] Packages loaded:', availablePackages.length);
      console.log('[PremiumContext] Package details:', JSON.stringify(availablePackages.map(p => ({
        identifier: p.identifier,
        packageType: p.packageType,
        productId: p.product?.identifier,
        price: p.product?.priceString,
      })), null, 2));
      setPackages(availablePackages);
      return availablePackages;
    } catch (error) {
      console.error('[PremiumContext] Failed to load packages:', error);
      return [];
    }
  }, []);

  /**
   * Purchase a subscription package
   */
  const purchase = useCallback(async (packageToPurchase) => {
    const purchaseService = getPurchaseService();
    if (!ENABLE_REVENUECAT || !purchaseService) {
      Alert.alert('Coming Soon', 'Premium subscriptions will be available soon!');
      return { success: false };
    }

    try {
      setIsLoading(true);
      const result = await purchaseService.purchasePackage(packageToPurchase);

      if (result.success) {
        setIsPremium(result.isPremium);
        setCustomerInfo(result.customerInfo);

        if (result.isPremium) {
          Alert.alert(
            'Welcome to Premium!',
            'Thank you for subscribing. Enjoy unlimited access to all features!',
            [{ text: 'OK' }]
          );
        }
      } else if (result.cancelled) {
        // Purchase cancelled by user
      } else if (result.error) {
        Alert.alert('Purchase Failed', result.error.message, [{ text: 'OK' }]);
      }

      return result;
    } catch (error) {
      // Purchase error - will show alert to user
      Alert.alert('Error', 'Failed to complete purchase. Please try again.', [
        { text: 'OK' },
      ]);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Restore previous purchases
   */
  const restorePurchases = useCallback(async () => {
    const purchaseService = getPurchaseService();
    if (!ENABLE_REVENUECAT || !purchaseService) {
      Alert.alert('Coming Soon', 'Premium subscriptions will be available soon!');
      return { success: false };
    }

    try {
      setIsLoading(true);
      const result = await purchaseService.restorePurchases();

      if (result.success) {
        setIsPremium(result.isPremium);
        setCustomerInfo(result.customerInfo);

        if (result.isPremium) {
          Alert.alert(
            'Purchases Restored',
            'Your premium subscription has been restored!',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'No Purchases Found',
            'We could not find any previous purchases to restore.',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert('Restore Failed', result.error?.message || 'Please try again.', [
          { text: 'OK' },
        ]);
      }

      return result;
    } catch (error) {
      // Restore error - will show alert to user
      Alert.alert('Error', 'Failed to restore purchases. Please try again.', [
        { text: 'OK' },
      ]);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Open subscription management (App Store / Play Store)
   */
  const manageSubscription = useCallback(async () => {
    const purchaseService = getPurchaseService();
    if (!ENABLE_REVENUECAT || !purchaseService) {
      const fallbackUrl =
        Platform.OS === 'ios'
          ? 'https://apps.apple.com/account/subscriptions'
          : 'https://play.google.com/store/account/subscriptions';
      await Linking.openURL(fallbackUrl);
      return;
    }

    try {
      const url = await purchaseService.getManagementURL();

      if (url) {
        await Linking.openURL(url);
      } else {
        const fallbackUrl =
          Platform.OS === 'ios'
            ? 'https://apps.apple.com/account/subscriptions'
            : 'https://play.google.com/store/account/subscriptions';

        await Linking.openURL(fallbackUrl);
      }
    } catch (error) {
      // Failed to open management URL - will show alert to user
      Alert.alert('Error', 'Could not open subscription management.', [
        { text: 'OK' },
      ]);
    }
  }, []);

  /**
   * Check if user can reroll - always true now (unlimited rerolls with ads)
   */
  const canReroll = useCallback(() => {
    return true; // Always allow rerolls - ads handle monetization now
  }, []);

  /**
   * Check if a specific premium feature is available
   */
  const hasFeature = useCallback(
    (feature) => {
      if (isPremium) {
        return PREMIUM_FEATURES[feature] || false;
      }
      return false;
    },
    [isPremium]
  );

  /**
   * Get package by type (monthly, annual, lifetime)
   */
  const getPackageByType = useCallback(
    (type) => {
      return packages.find((pkg) => pkg.packageType === type);
    },
    [packages]
  );

  /**
   * Get subscription end date (if applicable)
   */
  const getSubscriptionEndDate = useCallback(() => {
    if (!entitlement) return null;
    return entitlement.expirationDate
      ? new Date(entitlement.expirationDate)
      : null;
  }, [entitlement]);

  /**
   * Check if subscription will renew
   */
  const willRenew = useCallback(() => {
    if (!entitlement) return false;
    return entitlement.willRenew;
  }, [entitlement]);

  /**
   * Format price for display
   */
  const formatPrice = useCallback((product) => {
    if (!product) return '';
    const purchaseService = getPurchaseService();
    if (purchaseService) {
      return purchaseService.formatPrice(product);
    }
    return product.priceString || '';
  }, []);

  /**
   * Get subscription period text
   */
  const getSubscriptionPeriod = useCallback((packageItem) => {
    const purchaseService = getPurchaseService();
    if (purchaseService) {
      return purchaseService.getSubscriptionPeriod(packageItem);
    }
    return '';
  }, []);

  const value = {
    // Feature toggles
    isRevenueCatEnabled: ENABLE_REVENUECAT,
    isRewardedAdsEnabled: ads?.adsEnabled ?? false,

    // State
    isPremium,
    isLoading,
    packages,
    customerInfo,
    entitlement,
    dailyRerollCount: ads?.dailyRerollCount ?? 0,

    // Ad state (from AdContext)
    isAdLoading: ads?.isAdLoading ?? false,
    isAdReady: ads?.isAdReady ?? false,

    // Feature checks
    canReroll,
    getRerollsUntilAd: () => ads?.getRerollsUntilAd(isPremium) ?? Infinity,
    hasFeature,
    shouldShowPremiumPrompt: () => ads?.shouldShowPremiumPrompt() ?? false,
    shouldShowAdBeforeReroll: () => ads?.shouldShowAdBeforeReroll(isPremium) ?? false,

    // Actions
    recordReroll: ads?.recordReroll ?? (() => {}),
    recordRecommendationFetch: ads?.recordRecommendationFetch ?? (() => {}),
    purchase,
    restorePurchases,
    manageSubscription,
    refreshPremiumStatus,
    loadPackages,

    // Ad actions (from AdContext)
    showRewardedAd: ads?.showRewardedAd ?? (async () => true),
    preloadRewardedAd: ads?.preloadAd ?? (() => {}),

    // Package helpers
    getPackageByType,
    formatPrice,
    getSubscriptionPeriod,
    getSubscriptionEndDate,
    willRenew,

    // Constants
    AD_INTERVAL: ads?.adInterval ?? 3,
    PREMIUM_FEATURES,
  };

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
};

export default PremiumContext;
