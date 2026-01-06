/**
 * PlayNxt Purchase Service
 *
 * Handles RevenueCat integration for premium subscriptions.
 * Supports monthly, yearly, lifetime, and consumable products.
 */

import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PURCHASES_ERROR_CODE } from 'react-native-purchases';

// RevenueCat API Keys
const API_KEYS = {
  ios: 'appl_AvkUTiXnYHeZXzUhZOQgwaJhOqT',
  android: 'appl_AvkUTiXnYHeZXzUhZOQgwaJhOqT', // Update with Google Play key when available
};

// Entitlement identifier
export const ENTITLEMENTS = {
  PREMIUM: 'PlayNxt Premium',
};

// Product identifiers
export const PRODUCT_IDS = {
  MONTHLY: 'playnxt_premium_monthly',
  YEARLY: 'playnxt_premium_yearly',
  LIFETIME: 'playnxt_premium_lifetime',
};

// Track initialization state
let isInitialized = false;

/**
 * Initialize RevenueCat SDK
 * Should be called once at app startup
 */
export const initializePurchases = async (userId = null) => {
  try {
    if (isInitialized) {
      console.log('[Purchases] Already initialized');
      return true;
    }

    // Set log level (VERBOSE for development, ERROR for production)
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    } else {
      Purchases.setLogLevel(LOG_LEVEL.ERROR);
    }

    const apiKey = Platform.OS === 'ios' ? API_KEYS.ios : API_KEYS.android;

    // Configure with optional user ID for cross-platform sync
    if (userId) {
      await Purchases.configure({ apiKey, appUserID: userId });
    } else {
      await Purchases.configure({ apiKey });
    }

    isInitialized = true;
    console.log('[Purchases] RevenueCat initialized successfully');
    return true;
  } catch (error) {
    console.error('[Purchases] Failed to initialize RevenueCat:', error);
    return false;
  }
};

/**
 * Login user to RevenueCat (for cross-device sync)
 */
export const loginUser = async (userId) => {
  try {
    if (!isInitialized) {
      await initializePurchases(userId);
      return;
    }

    const { customerInfo } = await Purchases.logIn(userId);
    console.log('[Purchases] User logged in:', userId);
    return customerInfo;
  } catch (error) {
    console.error('[Purchases] Failed to login user:', error);
    throw error;
  }
};

/**
 * Logout user from RevenueCat
 */
export const logoutUser = async () => {
  try {
    const customerInfo = await Purchases.logOut();
    console.log('[Purchases] User logged out');
    return customerInfo;
  } catch (error) {
    console.error('[Purchases] Failed to logout user:', error);
    throw error;
  }
};

/**
 * Get current customer info and subscription status
 */
export const getCustomerInfo = async () => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('[Purchases] Failed to get customer info:', error);
    throw error;
  }
};

/**
 * Check if user has active premium entitlement
 */
export const checkPremiumStatus = async () => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const isPremium = customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined;

    return {
      isPremium,
      entitlement: customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM] || null,
      customerInfo,
    };
  } catch (error) {
    console.error('[Purchases] Failed to check premium status:', error);
    return {
      isPremium: false,
      entitlement: null,
      customerInfo: null,
    };
  }
};

/**
 * Get available offerings (products)
 */
export const getOfferings = async () => {
  try {
    const offerings = await Purchases.getOfferings();

    if (!offerings.current) {
      console.warn('[Purchases] No current offering configured');
      return null;
    }

    return offerings;
  } catch (error) {
    console.error('[Purchases] Failed to get offerings:', error);
    throw error;
  }
};

/**
 * Get current offering packages
 */
export const getCurrentPackages = async () => {
  try {
    const offerings = await getOfferings();

    if (!offerings?.current?.availablePackages) {
      return [];
    }

    return offerings.current.availablePackages;
  } catch (error) {
    console.error('[Purchases] Failed to get packages:', error);
    return [];
  }
};

/**
 * Purchase a package
 */
export const purchasePackage = async (packageToPurchase) => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

    const isPremium = customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined;

    return {
      success: true,
      isPremium,
      customerInfo,
    };
  } catch (error) {
    if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      console.log('[Purchases] User cancelled purchase');
      return { success: false, cancelled: true };
    }

    console.error('[Purchases] Purchase failed:', error);
    return {
      success: false,
      cancelled: false,
      error: handlePurchaseError(error),
    };
  }
};

/**
 * Purchase a specific product by ID
 */
export const purchaseProduct = async (productId) => {
  try {
    const packages = await getCurrentPackages();
    const targetPackage = packages.find(
      (pkg) => pkg.product.identifier === productId
    );

    if (!targetPackage) {
      throw new Error(`Product ${productId} not found`);
    }

    return await purchasePackage(targetPackage);
  } catch (error) {
    console.error('[Purchases] Purchase product failed:', error);
    throw error;
  }
};

/**
 * Restore purchases
 */
export const restorePurchases = async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const isPremium = customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined;

    return {
      success: true,
      isPremium,
      customerInfo,
    };
  } catch (error) {
    console.error('[Purchases] Restore failed:', error);
    return {
      success: false,
      error: handlePurchaseError(error),
    };
  }
};

/**
 * Get subscription management URL (for cancellation, etc.)
 */
export const getManagementURL = async () => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.managementURL;
  } catch (error) {
    console.error('[Purchases] Failed to get management URL:', error);
    return null;
  }
};

/**
 * Add listener for customer info updates
 */
export const addCustomerInfoListener = (callback) => {
  return Purchases.addCustomerInfoUpdateListener(callback);
};

/**
 * Handle purchase errors with user-friendly messages
 */
const handlePurchaseError = (error) => {
  const errorMessages = {
    [PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR]: 'Purchase was cancelled',
    [PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR]: 'Purchase not allowed on this device',
    [PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR]: 'Invalid purchase',
    [PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_ERROR]: 'Product not available',
    [PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR]: 'Already purchased',
    [PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR]: 'Receipt already in use',
    [PURCHASES_ERROR_CODE.INVALID_RECEIPT_ERROR]: 'Invalid receipt',
    [PURCHASES_ERROR_CODE.MISSING_RECEIPT_FILE_ERROR]: 'Missing receipt',
    [PURCHASES_ERROR_CODE.NETWORK_ERROR]: 'Network error. Please try again.',
    [PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR]: 'Invalid credentials',
    [PURCHASES_ERROR_CODE.UNEXPECTED_BACKEND_RESPONSE_ERROR]: 'Server error. Please try again.',
    [PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR]: 'App Store error. Please try again.',
    [PURCHASES_ERROR_CODE.OPERATION_ALREADY_IN_PROGRESS_ERROR]: 'Purchase already in progress',
    [PURCHASES_ERROR_CODE.UNKNOWN_BACKEND_ERROR]: 'Unknown error. Please try again.',
  };

  return {
    code: error.code,
    message: errorMessages[error.code] || 'An unexpected error occurred',
    originalError: error,
  };
};

/**
 * Format price for display
 */
export const formatPrice = (product) => {
  if (!product) return '';
  return product.priceString;
};

/**
 * Get subscription period text
 */
export const getSubscriptionPeriod = (packageItem) => {
  const type = packageItem.packageType;

  const periods = {
    MONTHLY: '/month',
    ANNUAL: '/year',
    LIFETIME: 'one-time',
    WEEKLY: '/week',
    TWO_MONTH: '/2 months',
    THREE_MONTH: '/3 months',
    SIX_MONTH: '/6 months',
  };

  return periods[type] || '';
};

export default {
  initializePurchases,
  loginUser,
  logoutUser,
  getCustomerInfo,
  checkPremiumStatus,
  getOfferings,
  getCurrentPackages,
  purchasePackage,
  purchaseProduct,
  restorePurchases,
  getManagementURL,
  addCustomerInfoListener,
  formatPrice,
  getSubscriptionPeriod,
  ENTITLEMENTS,
  PRODUCT_IDS,
};
