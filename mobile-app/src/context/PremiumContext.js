/**
 * PlayNxt Premium Context
 *
 * Manages premium subscription state and feature access.
 * RevenueCat integration is behind a feature toggle for development.
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

const PremiumContext = createContext({});

export const usePremium = () => useContext(PremiumContext);

// Feature toggle - set to true to enable RevenueCat
const ENABLE_REVENUECAT = true;

// Free tier limits
const FREE_TIER_LIMITS = {
  dailyRerolls: 3,
  historyDays: 0, // No history for free tier
};

// Premium features
const PREMIUM_FEATURES = {
  unlimitedRerolls: true,
  crossDeviceSync: true,
  gameLibrary: true,
};

// Dynamically import RevenueCat only when enabled
let purchaseService = null;
if (ENABLE_REVENUECAT) {
  purchaseService = require('../services/purchaseService');
}

export const PremiumProvider = ({ children }) => {
  const { user } = useAuth();

  // Premium state
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [packages, setPackages] = useState([]);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [entitlement, setEntitlement] = useState(null);

  // Reroll tracking for free tier
  const [dailyRerollsUsed, setDailyRerollsUsed] = useState(0);
  const [rerollResetDate, setRerollResetDate] = useState(null);

  /**
   * Initialize RevenueCat and check subscription status (only if enabled)
   */
  useEffect(() => {
    if (!ENABLE_REVENUECAT || !purchaseService) {
      // RevenueCat disabled - running in free tier mode
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
    if (!ENABLE_REVENUECAT || !purchaseService) {
      return [];
    }

    try {
      const availablePackages = await purchaseService.getCurrentPackages();
      setPackages(availablePackages);
      return availablePackages;
    } catch (error) {
      // Failed to load packages - silent fail
      return [];
    }
  }, []);

  /**
   * Purchase a subscription package
   */
  const purchase = useCallback(async (packageToPurchase) => {
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
   * Check if user can reroll (free tier limit or premium)
   */
  const canReroll = useCallback(() => {
    if (isPremium) {
      return true;
    }

    // Check if we need to reset daily count
    const today = new Date().toDateString();
    if (rerollResetDate !== today) {
      setDailyRerollsUsed(0);
      setRerollResetDate(today);
      return true;
    }

    return dailyRerollsUsed < FREE_TIER_LIMITS.dailyRerolls;
  }, [isPremium, dailyRerollsUsed, rerollResetDate]);

  /**
   * Record a reroll (for free tier tracking)
   */
  const recordReroll = useCallback(() => {
    if (!isPremium) {
      setDailyRerollsUsed((prev) => prev + 1);
    }
  }, [isPremium]);

  /**
   * Get remaining rerolls for free tier
   */
  const getRemainingRerolls = useCallback(() => {
    if (isPremium) {
      return Infinity;
    }
    return Math.max(0, FREE_TIER_LIMITS.dailyRerolls - dailyRerollsUsed);
  }, [isPremium, dailyRerollsUsed]);

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
   * Check if user should see premium upsell
   */
  const shouldShowPremiumPrompt = useCallback(
    (totalAccepts = 0, totalWorkedSignals = 0) => {
      // Don't show to premium users
      if (isPremium) return false;

      // Show when rerolls are running low
      if (getRemainingRerolls() <= 1) return true;

      // Show after positive experiences
      return totalAccepts >= 3 && totalWorkedSignals >= 1;
    },
    [isPremium, getRemainingRerolls]
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
    if (purchaseService) {
      return purchaseService.formatPrice(product);
    }
    return product.priceString || '';
  }, []);

  /**
   * Get subscription period text
   */
  const getSubscriptionPeriod = useCallback((packageItem) => {
    if (purchaseService) {
      return purchaseService.getSubscriptionPeriod(packageItem);
    }
    return '';
  }, []);

  const value = {
    // Feature toggle
    isRevenueCatEnabled: ENABLE_REVENUECAT,

    // State
    isPremium,
    isLoading,
    packages,
    customerInfo,
    entitlement,
    dailyRerollsUsed,

    // Feature checks
    canReroll,
    getRemainingRerolls,
    hasFeature,
    shouldShowPremiumPrompt,

    // Actions
    recordReroll,
    purchase,
    restorePurchases,
    manageSubscription,
    refreshPremiumStatus,
    loadPackages,

    // Package helpers
    getPackageByType,
    formatPrice,
    getSubscriptionPeriod,
    getSubscriptionEndDate,
    willRenew,

    // Constants
    FREE_TIER_LIMITS,
    PREMIUM_FEATURES,
  };

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  );
};

export default PremiumContext;
