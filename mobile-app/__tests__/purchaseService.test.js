/**
 * Tests for the purchaseService — the boundary layer between PremiumContext and
 * the RevenueCat SDK. Mocks `react-native-purchases` and asserts the response
 * shapes the rest of the app depends on.
 *
 * This does NOT verify a real Store purchase (requires a device). It DOES
 * verify the wiring contract: given an RC SDK response, our wrapper produces
 * the shape that PremiumContext expects.
 */

const ENTITLEMENT_NAME = 'PlayNxt Premium';

const buildCustomerInfo = ({ premium = false } = {}) => ({
  entitlements: {
    active: premium
      ? { [ENTITLEMENT_NAME]: { expirationDate: '2099-01-01T00:00:00Z', willRenew: false } }
      : {},
  },
  managementURL: 'https://example.com/manage',
});

// Error codes we exercise. Must match react-native-purchases' PURCHASES_ERROR_CODE.
const ERROR_CODE = {
  PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  STORE_PROBLEM_ERROR: 'STORE_PROBLEM_ERROR',
};

jest.mock('react-native-purchases', () => {
  return {
    __esModule: true,
    default: {
      configure: jest.fn(),
      setLogLevel: jest.fn(),
      logIn: jest.fn(),
      logOut: jest.fn(),
      getCustomerInfo: jest.fn(),
      getOfferings: jest.fn(),
      purchasePackage: jest.fn(),
      restorePurchases: jest.fn(),
      addCustomerInfoUpdateListener: jest.fn(),
      removeCustomerInfoUpdateListener: jest.fn(),
    },
    LOG_LEVEL: { DEBUG: 'DEBUG', ERROR: 'ERROR' },
    PURCHASES_ERROR_CODE: {
      PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED_ERROR',
      PURCHASE_NOT_ALLOWED_ERROR: 'PURCHASE_NOT_ALLOWED_ERROR',
      PURCHASE_INVALID_ERROR: 'PURCHASE_INVALID_ERROR',
      PRODUCT_NOT_AVAILABLE_ERROR: 'PRODUCT_NOT_AVAILABLE_ERROR',
      PRODUCT_ALREADY_PURCHASED_ERROR: 'PRODUCT_ALREADY_PURCHASED_ERROR',
      RECEIPT_ALREADY_IN_USE_ERROR: 'RECEIPT_ALREADY_IN_USE_ERROR',
      INVALID_RECEIPT_ERROR: 'INVALID_RECEIPT_ERROR',
      MISSING_RECEIPT_FILE_ERROR: 'MISSING_RECEIPT_FILE_ERROR',
      NETWORK_ERROR: 'NETWORK_ERROR',
      INVALID_CREDENTIALS_ERROR: 'INVALID_CREDENTIALS_ERROR',
      UNEXPECTED_BACKEND_RESPONSE_ERROR: 'UNEXPECTED_BACKEND_RESPONSE_ERROR',
      STORE_PROBLEM_ERROR: 'STORE_PROBLEM_ERROR',
      OPERATION_ALREADY_IN_PROGRESS_ERROR: 'OPERATION_ALREADY_IN_PROGRESS_ERROR',
      UNKNOWN_BACKEND_ERROR: 'UNKNOWN_BACKEND_ERROR',
    },
  };
});

const Purchases = require('react-native-purchases').default;

// Silence the wrapper's console.error noise on negative paths.
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  console.error.mockRestore();
  console.log.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
});


// =========================================================================
// checkPremiumStatus
// =========================================================================
describe('checkPremiumStatus', () => {
  it('returns isPremium=true and the entitlement when PREMIUM is active', async () => {
    const { checkPremiumStatus, ENTITLEMENTS } = require('../src/services/purchaseService');
    expect(ENTITLEMENTS.PREMIUM).toBe(ENTITLEMENT_NAME);

    Purchases.getCustomerInfo.mockResolvedValue(buildCustomerInfo({ premium: true }));

    const result = await checkPremiumStatus();

    expect(result.isPremium).toBe(true);
    expect(result.entitlement).not.toBeNull();
    expect(result.entitlement.willRenew).toBe(false);
    expect(result.customerInfo).toBeDefined();
  });

  it('returns isPremium=false and null entitlement when PREMIUM is inactive', async () => {
    const { checkPremiumStatus } = require('../src/services/purchaseService');
    Purchases.getCustomerInfo.mockResolvedValue(buildCustomerInfo({ premium: false }));

    const result = await checkPremiumStatus();

    expect(result.isPremium).toBe(false);
    expect(result.entitlement).toBeNull();
  });

  it('returns isPremium=false on SDK failure (does NOT throw)', async () => {
    const { checkPremiumStatus } = require('../src/services/purchaseService');
    Purchases.getCustomerInfo.mockRejectedValue(new Error('rc down'));

    const result = await checkPremiumStatus();

    expect(result.isPremium).toBe(false);
    expect(result.entitlement).toBeNull();
  });
});


// =========================================================================
// purchasePackage — the critical wiring
// =========================================================================
describe('purchasePackage', () => {
  it('successful purchase returns {success:true, isPremium:true, customerInfo}', async () => {
    const { purchasePackage } = require('../src/services/purchaseService');
    Purchases.purchasePackage.mockResolvedValue({
      customerInfo: buildCustomerInfo({ premium: true }),
    });

    const result = await purchasePackage({ identifier: 'lifetime' });

    expect(result.success).toBe(true);
    expect(result.isPremium).toBe(true);
    expect(result.customerInfo).toBeDefined();
    expect(result.cancelled).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('user cancellation returns {success:false, cancelled:true} with NO error', async () => {
    const { purchasePackage } = require('../src/services/purchaseService');
    const cancelErr = new Error('User cancelled');
    cancelErr.code = ERROR_CODE.PURCHASE_CANCELLED_ERROR;
    Purchases.purchasePackage.mockRejectedValue(cancelErr);

    const result = await purchasePackage({ identifier: 'lifetime' });

    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.isPremium).toBeUndefined();
  });

  it('non-cancel failure returns {success:false, cancelled:false, error:{code,message}}', async () => {
    const { purchasePackage } = require('../src/services/purchaseService');
    const netErr = new Error('network broke');
    netErr.code = ERROR_CODE.NETWORK_ERROR;
    Purchases.purchasePackage.mockRejectedValue(netErr);

    const result = await purchasePackage({ identifier: 'lifetime' });

    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe(ERROR_CODE.NETWORK_ERROR);
    expect(result.error.message).toMatch(/network/i);
  });

  it('unknown error code falls through to generic message', async () => {
    const { purchasePackage } = require('../src/services/purchaseService');
    const weirdErr = new Error('???');
    weirdErr.code = 'SOMETHING_NEW_FROM_RC';
    Purchases.purchasePackage.mockRejectedValue(weirdErr);

    const result = await purchasePackage({ identifier: 'lifetime' });

    expect(result.success).toBe(false);
    expect(result.error.message).toMatch(/unexpected/i);
  });
});


// =========================================================================
// restorePurchases
// =========================================================================
describe('restorePurchases', () => {
  it('restore that finds active PREMIUM returns isPremium=true', async () => {
    const { restorePurchases } = require('../src/services/purchaseService');
    Purchases.restorePurchases.mockResolvedValue(buildCustomerInfo({ premium: true }));

    const result = await restorePurchases();

    expect(result.success).toBe(true);
    expect(result.isPremium).toBe(true);
    expect(result.customerInfo).toBeDefined();
  });

  it('restore that finds no PREMIUM returns isPremium=false', async () => {
    const { restorePurchases } = require('../src/services/purchaseService');
    Purchases.restorePurchases.mockResolvedValue(buildCustomerInfo({ premium: false }));

    const result = await restorePurchases();

    expect(result.success).toBe(true);
    expect(result.isPremium).toBe(false);
  });

  it('restore failure returns {success:false, error}', async () => {
    const { restorePurchases } = require('../src/services/purchaseService');
    const err = new Error('boom');
    err.code = ERROR_CODE.STORE_PROBLEM_ERROR;
    Purchases.restorePurchases.mockRejectedValue(err);

    const result = await restorePurchases();

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe(ERROR_CODE.STORE_PROBLEM_ERROR);
  });
});


// =========================================================================
// formatPrice — pure helper
// =========================================================================
describe('formatPrice', () => {
  it('returns the priceString from the product', () => {
    const { formatPrice } = require('../src/services/purchaseService');
    expect(formatPrice({ priceString: '$2.99' })).toBe('$2.99');
  });

  it('returns empty string for falsy product', () => {
    const { formatPrice } = require('../src/services/purchaseService');
    expect(formatPrice(null)).toBe('');
    expect(formatPrice(undefined)).toBe('');
  });
});


// =========================================================================
// ENTITLEMENTS contract — pinned so a typo breaks the test, not production
// =========================================================================
describe('ENTITLEMENTS constant', () => {
  it('exports the exact PREMIUM identifier RevenueCat dashboard expects', () => {
    const { ENTITLEMENTS } = require('../src/services/purchaseService');
    expect(ENTITLEMENTS.PREMIUM).toBe('PlayNxt Premium');
  });
});
