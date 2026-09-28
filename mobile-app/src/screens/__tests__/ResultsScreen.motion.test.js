/**
 * ResultsScreen motion tests (combined card-motion review fixes)
 *
 * C1: swaps/rerolls must not unmount the list behind the loader. The
 * context's `loading` flag flips true again while a swap/reroll is in
 * flight (see RecommendationContext), so the loader gate must special-case
 * that in-place-busy state rather than replacing the whole screen.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
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

let mockLoading = false;
let mockRecommendations = [game];
let mockMarkAsPlayedAndSwap;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

jest.mock('../../services/analyticsService', () => ({
  logEvent: jest.fn(),
}));

jest.mock('../../context/RecommendationContext', () => ({
  useRecommendation: () => ({
    recommendations: mockRecommendations,
    loading: mockLoading,
    error: null,
    fallbackApplied: false,
    fallbackMessage: null,
    reroll: jest.fn(),
    acceptRecommendation: jest.fn(),
    markAsPlayedAndSwap: (...args) => mockMarkAsPlayedAndSwap(...args),
    rejectAndSwap: jest.fn(),
    undoRejection: jest.fn(),
    submitFeedback: jest.fn(),
    preferences: { platforms: [], timeAvailable: 30, energyMood: 'chill' },
  }),
}));

jest.mock('../../context/PremiumContext', () => ({
  usePremium: () => ({
    recordReroll: jest.fn(),
    isPremium: false,
    isAdLoading: false,
    isRewardedAdsEnabled: false,
    shouldShowAdBeforeReroll: () => false,
    showRewardedAd: jest.fn(),
    getRerollsUntilAd: () => 0,
    shouldShowPremiumPrompt: () => false,
    AD_INTERVAL: 3,
    isDailyCapHit: false,
    rerollsRemainingToday: 5,
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

describe('ResultsScreen motion (C1 — swap/reroll must not unmount the list)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoading = false;
    mockRecommendations = [game];
    // Never resolves within the test — keeps swappingGameId set so we can
    // assert the list survives the loading flag flipping true mid-swap.
    mockMarkAsPlayedAndSwap = jest.fn(() => new Promise(() => {}));
  });

  it('keeps card titles rendered when loading flips true during an in-place swap', async () => {
    await render(<ResultsScreen />);
    // The title renders twice (header + thumbnail fallback placeholder,
    // since the image never resolves in tests) — same pattern as
    // GameCard.test.js.
    expect(screen.getAllByText('Game One').length).toBeGreaterThan(0);

    // Open the "already played" feedback modal for the card.
    await fireEvent.press(screen.getByText('Played it'));
    expect(screen.getByText('Skip & show me something else')).toBeTruthy();

    // Simulate the context's loading flag flipping true for the swap fetch,
    // the way RecommendationContext does around rejectAndSwap/markAsPlayedAndSwap.
    mockLoading = true;

    // Triggers handleAlreadyPlayedSkip: sets swappingGameId synchronously,
    // then awaits the (never-resolving) markAsPlayedAndSwap call.
    await act(async () => {
      fireEvent.press(screen.getByText('Skip & show me something else'));
      await Promise.resolve();
    });

    // loading is true AND a swap is in flight (isInPlaceBusy) — the loader
    // must NOT replace the list; the card stays mounted.
    expect(screen.getAllByText('Game One').length).toBeGreaterThan(0);
    expect(mockMarkAsPlayedAndSwap).toHaveBeenCalledWith('g1', 'already_played', 'Game One');
  });
});
