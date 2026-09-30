/**
 * premium_purchase (analytics event brief): fires once the unlock succeeds,
 * tagged with platform and the screen whose upsell led there.
 */

import React from 'react';
import { Platform } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('../src/context/AdContext', () => ({
  useAds: () => ({}),
}));

jest.mock('../src/services/analyticsService', () => ({
  logEvent: jest.fn(),
  setAnalyticsUserId: jest.fn(),
}));

jest.mock('../src/services/purchaseService', () => ({
  ENTITLEMENTS: { PREMIUM: 'premium' },
  initializePurchases: jest.fn(() => Promise.resolve()),
  loginUser: jest.fn(() => Promise.resolve()),
  getCustomerInfo: jest.fn(() => Promise.resolve(null)),
  checkPremiumStatus: jest.fn(() => Promise.resolve(false)),
  getOfferings: jest.fn(() => Promise.resolve(null)),
  getPackages: jest.fn(() => Promise.resolve([])),
  addCustomerInfoListener: jest.fn(() => () => {}),
  purchasePackage: jest.fn(),
}));

import purchaseService from '../src/services/purchaseService';
import { logEvent } from '../src/services/analyticsService';
import { PremiumProvider, usePremium } from '../src/context/PremiumContext';

const pkg = { packageType: 'LIFETIME', product: { identifier: 'playnxt_lifetime' } };

const premiumEvents = () =>
  logEvent.mock.calls.filter(([n]) => n === 'premium_purchase').map(([, p]) => p);

describe('premium_purchase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
  });

  const render = () =>
    renderHook(usePremium, { wrapper: ({ children }) => <PremiumProvider>{children}</PremiumProvider> });

  it('fires on a successful unlock with the entry screen', async () => {
    purchaseService.purchasePackage.mockResolvedValue({ success: true, isPremium: true, customerInfo: {} });
    const { result } = await render();
    await act(async () => {
      await result.current.purchase(pkg, { entryScreen: 'results' });
    });
    expect(premiumEvents()).toEqual([{ platform: 'ios', entry_screen: 'results' }]);
  });

  it('reports unknown when the paywall was opened without a source', async () => {
    purchaseService.purchasePackage.mockResolvedValue({ success: true, isPremium: true, customerInfo: {} });
    const { result } = await render();
    await act(async () => {
      await result.current.purchase(pkg);
    });
    expect(premiumEvents()).toEqual([{ platform: 'ios', entry_screen: 'unknown' }]);
  });

  it('does not fire when the purchase is cancelled', async () => {
    purchaseService.purchasePackage.mockResolvedValue({ success: false, cancelled: true });
    const { result } = await render();
    await act(async () => {
      await result.current.purchase(pkg, { entryScreen: 'backlog' });
    });
    expect(premiumEvents()).toEqual([]);
  });
});
