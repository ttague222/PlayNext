/**
 * ResultsScreen / GameCard theme tests (seasonal themes, spec 6.1-6.4).
 *
 * Results backgrounds follow the season's flow gradient and the GameCard image
 * scrim follows overlay.scrim; every tappable stays brand pink. Under the
 * default theme every color is today's literal, except the 6.4 gray changes.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import vectors from '../../../../api-service/tests/fixtures/palette_vectors.json';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));
// Record every LinearGradient's props so the tests can read its colors.
const mockGradients = [];
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: (props) => { mockGradients.push(props); return props.children; },
}));
jest.mock('../../services/analyticsService', () => ({ logEvent: jest.fn() }));
// Never resolves, so GameCard keeps its initial fallback tile.
jest.mock('../../services/gameImages', () => ({
  getGameImage: jest.fn(() => new Promise(() => {})),
}));

let mockRecommendations = [];
let mockError = null;
jest.mock('../../context/RecommendationContext', () => ({
  useRecommendation: () => ({
    recommendations: mockRecommendations,
    loading: false,
    error: mockError,
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
    isPremium: false,
    isAdLoading: false,
    isRewardedAdsEnabled: false,
    shouldShowAdBeforeReroll: () => false,
    showRewardedAd: jest.fn(),
    getRerollsUntilAd: () => 2,
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

import { ThemeProvider } from '../../theme/ThemeContext';
import ResultsScreen from '../ResultsScreen';

const spooky = vectors.palettes.find((p) => p.name === 'spooky').palette;
const DEFAULT_FLOW = ['#0f0c29', '#302b63', '#24243e'];

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

const rootColors = () => mockGradients[0].colors;
const colorOf = (node) => StyleSheet.flatten(node.props.style).color;
const scrimColors = () => mockGradients.find((g) => g.locations).colors;
const tileColors = () =>
  mockGradients.find((g) => g.start && g.end && g.start.y === 0 && g.end.y === 1 && !g.locations).colors;
const brandGradients = () =>
  mockGradients.filter((g) => g.colors[0] === '#f857a6' && g.colors[1] === '#ff5858');

beforeEach(() => {
  jest.clearAllMocks();
  mockGradients.length = 0;
  mockRecommendations = [];
  mockError = null;
});

describe('ResultsScreen under no provider (default theme)', () => {
  it("keeps today's flow gradient", async () => {
    await render(<ResultsScreen />);
    expect(rootColors()).toEqual(DEFAULT_FLOW);
  });

  it('shows secondary text at #a0a0a0 (was #808080) and muted text at #9a9a9a (was #909090)', async () => {
    await render(<ResultsScreen />);
    expect(colorOf(screen.getByText('Try adjusting your filters'))).toBe('#a0a0a0');
    expect(colorOf(screen.getByText('Based on your time & mood'))).toBe('#9a9a9a');
  });

  it('keeps the Try Again button brand pink on the error screen and shows secondary detail text', async () => {
    mockError = 'boom';
    await render(<ResultsScreen />);
    expect(rootColors()).toEqual(DEFAULT_FLOW);
    expect(brandGradients().length).toBe(1);
    expect(colorOf(screen.getByText('boom'))).toBe('#a0a0a0');
  });

  it("keeps today's GameCard scrim and brand buttons, with the fallback tile on the flow stops", async () => {
    mockRecommendations = [game];
    await render(<ResultsScreen />);
    expect(scrimColors()).toEqual(['transparent', 'rgba(15,12,41,0.3)', 'rgba(15,12,41,0.55)']);
    // The fallback tile uses the flow gradient's middle and end stops.
    expect(tileColors()).toEqual(['#302b63', '#24243e']);
    // TOP PICK badge and "I'll play this!" stay brand pink.
    expect(brandGradients().length).toBe(2);
  });
});

describe('ResultsScreen under the Spooky palette', () => {
  const renderThemed = () =>
    render(
      <ThemeProvider palette={spooky}>
        <ResultsScreen />
      </ThemeProvider>
    );

  it('uses the Spooky flow stops for the screen background', async () => {
    await renderThemed();
    expect(rootColors()).toEqual(spooky.bg_gradient);
  });

  it('uses the Spooky flow stops on the error screen but keeps Try Again brand pink', async () => {
    mockError = 'boom';
    await renderThemed();
    expect(rootColors()).toEqual(spooky.bg_gradient);
    expect(brandGradients().length).toBe(1);
  });

  it('derives the GameCard scrim from the season and keeps the buttons brand pink', async () => {
    mockRecommendations = [game];
    await renderThemed();
    const scrim = scrimColors();
    expect(scrim[0]).toBe('transparent');
    expect(scrim[1].startsWith('rgba(13,7,22,')).toBe(true);
    expect(scrim[2].startsWith('rgba(13,7,22,')).toBe(true);
    expect(tileColors()).toEqual([spooky.bg_gradient[1], spooky.bg_gradient[2]]);
    expect(brandGradients().length).toBe(2);
  });
});
