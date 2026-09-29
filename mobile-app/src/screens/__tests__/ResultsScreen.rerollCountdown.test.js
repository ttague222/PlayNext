/**
 * ResultsScreen reroll countdown tests
 *
 * The visible "N rerolls left today" text used to be computed from the
 * 10/day hard cap (DAILY_REROLL_CAP), which never matched when ads actually
 * fire (they gate on the much smaller ad_interval). The footer and the
 * first-time FeatureCallout tooltip now both read the real ad-gate
 * remainder from getRerollsUntilAd().
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ResultsScreen from '../ResultsScreen';

const game = {
  game_id: 'g1',
  title: 'Game One',
  platforms: ['pc'],
  description_short: 'A great game.',
  explanation: {},
  match_score: 0.9,
  store_links: {},
  subscription_services: [],
};

let mockGetRerollsUntilAd = () => 2;
let mockIsPremium = false;
let mockIsDailyCapHit = false;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

jest.mock('../../services/analyticsService', () => ({
  logEvent: jest.fn(),
}));

jest.mock('../../context/RecommendationContext', () => ({
  useRecommendation: () => ({
    recommendations: [game],
    loading: false,
    error: null,
    fallbackApplied: false,
    fallbackMessage: null,
    reroll: jest.fn(),
    acceptRecommendation: jest.fn(),
    markAsPlayedAndSwap: jest.fn(),
    rejectAndSwap: jest.fn(),
    undoRejection: jest.fn(),
    submitFeedback: jest.fn(),
    preferences: { platforms: [], timeAvailable: 30, energyMood: 'chill' },
  }),
}));

jest.mock('../../context/PremiumContext', () => ({
  usePremium: () => ({
    recordReroll: jest.fn(),
    isPremium: mockIsPremium,
    isAdLoading: false,
    isRewardedAdsEnabled: true,
    shouldShowAdBeforeReroll: () => false,
    showRewardedAd: jest.fn(),
    getRerollsUntilAd: () => mockGetRerollsUntilAd(),
    shouldShowPremiumPrompt: () => false,
    AD_INTERVAL: 3,
    isDailyCapHit: mockIsDailyCapHit,
    getPackageByType: () => null,
    formatPrice: () => '$1.99',
  }),
}));

jest.mock('../../context/SavedGamesContext', () => ({
  useSavedGames: () => ({
    addGameToBucket: jest.fn(),
    removeGameFromBucket: jest.fn(),
    getGameBucket: jest.fn(),
    isUsingLocalStorage: true,
  }),
  BUCKET_TYPES: { BACKLOG: 'backlog', PLAYING: 'playing', PLAYED: 'played', NOT_FOR_ME: 'not_for_me' },
}));

describe('ResultsScreen reroll countdown footer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPremium = false;
    mockIsDailyCapHit = false;
    mockGetRerollsUntilAd = () => 2;
  });

  it('shows the plural ad-gate remainder when more than one free reroll is left', async () => {
    mockGetRerollsUntilAd = () => 2;
    await render(<ResultsScreen />);
    expect(screen.getByText('2 free rerolls left, then a short ad')).toBeTruthy();
  });

  it('shows the singular form when exactly one free reroll is left', async () => {
    mockGetRerollsUntilAd = () => 1;
    await render(<ResultsScreen />);
    expect(screen.getByText('1 free reroll left, then a short ad')).toBeTruthy();
  });

  it('shows the ad-imminent copy when zero free rerolls are left', async () => {
    mockGetRerollsUntilAd = () => 0;
    await render(<ResultsScreen />);
    expect(screen.getByText('Next reroll plays a short ad')).toBeTruthy();
  });

  it('never shows the old daily-cap-based countdown copy', async () => {
    mockGetRerollsUntilAd = () => 2;
    await render(<ResultsScreen />);
    expect(screen.queryByText(/rerolls? left today/)).toBeNull();
  });

  it('does not render the countdown line when ads are not gating rerolls (e.g. Infinity)', async () => {
    mockGetRerollsUntilAd = () => Infinity;
    await render(<ResultsScreen />);
    expect(screen.queryByText(/free reroll/)).toBeNull();
    expect(screen.queryByText('Next reroll plays a short ad')).toBeNull();
  });

  it('still shows "No rerolls left today" when the 10/day hard cap is hit, regardless of the ad-gate remainder', async () => {
    mockIsDailyCapHit = true;
    mockGetRerollsUntilAd = () => 2;
    await render(<ResultsScreen />);
    expect(screen.getByText('No rerolls left today')).toBeTruthy();
  });

  it('shows "Unlimited rerolls" for premium users instead of the ad-gate countdown', async () => {
    mockIsPremium = true;
    mockGetRerollsUntilAd = () => Infinity;
    await render(<ResultsScreen />);
    expect(screen.getByText('Unlimited rerolls')).toBeTruthy();
  });
});
