import React from 'react';
import { StyleSheet } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import vectors from '../../../../api-service/tests/fixtures/palette_vectors.json';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setParams: jest.fn() }),
  useRoute: () => ({ params: undefined }),
  useFocusEffect: (cb) => { const React = require('react'); React.useEffect(cb, []); },
}));
// Record every LinearGradient's props so the tests can read its colors.
const mockGradients = [];
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: (props) => { mockGradients.push(props); return props.children; },
}));

jest.mock('../../context/RecommendationContext', () => ({
  useRecommendation: () => ({
    startSession: jest.fn(),
    resetPreferences: jest.fn(),
    savedPlatforms: [],
    savedPreferencesLoaded: true,
    startTonightSession: jest.fn(() => true),
  }),
}));
jest.mock('../../context/SavedGamesContext', () => ({
  useSavedGames: () => ({ notForMeGameIds: [] }),
}));
jest.mock('../../services/tonightService', () => ({
  getLastContext: jest.fn(),
  getCachedPicks: jest.fn(),
  fetchTonightsPicks: jest.fn(),
  recordTonightView: jest.fn(() => Promise.resolve()),
  localDateString: jest.fn(() => '2026-10-05'),
}));
// Out of season: keeps these tests off the real seasonal API and the card out of the way.
jest.mock('../../services/seasonalService', () => ({
  loadSeasonalContent: jest.fn(() => Promise.resolve({ schema_version: 1, seasons: [] })),
  getCachedSeasonalContentSync: () => ({ schema_version: 1, seasons: [] }),
  activeSeason: () => null,
  visibleCollections: () => [],
  fetchCollectionPicks: jest.fn(),
}));
jest.mock('../../utils/tonightReminderPrompt', () => ({
  maybeOfferTonightReminder: jest.fn(() => Promise.resolve(false)),
}));
jest.mock('../../services/analyticsService', () => ({ logEvent: jest.fn() }));
jest.mock('../../services/gameImages', () => ({
  getGameImage: jest.fn(() => Promise.resolve({ imageUrl: null, fallbackColors: ['#1a1a2e', '#16213e'] })),
}));

import { getLastContext, getCachedPicks } from '../../services/tonightService';
import { ThemeProvider } from '../../theme/ThemeContext';
import PlayScreen from '../PlayScreen';

const spooky = vectors.palettes.find((p) => p.name === 'spooky').palette;
const CONTEXT = { timeAvailable: 60, energyMood: 'casual', genres: [], platforms: [], sessionType: 'any', discoveryMode: 'familiar' };
const CACHE = { date: '2026-10-05', sessionId: 's1', context: CONTEXT, games: [{ game_id: 'hades', title: 'Hades' }] };

const rootColors = () => mockGradients[0].colors;
const startPlayingColors = () => mockGradients.find((g) => g.start && g.end).colors;

beforeEach(() => {
  jest.clearAllMocks();
  mockGradients.length = 0;
  getLastContext.mockResolvedValue(null);
  getCachedPicks.mockResolvedValue(null);
});

describe('PlayScreen under no provider (default theme)', () => {
  it('keeps today\'s root gradient and Start Playing gradient', async () => {
    const { findByText } = await render(<PlayScreen />);
    await findByText('Start Playing');
    expect(rootColors()).toEqual(['#0a0a1a', '#1a1a2e', '#16213e']);
    expect(startPlayingColors()).toEqual(['#f857a6', '#ff5858']);
  });

  it('keeps today\'s pink icon tint rgba', async () => {
    const { findByText } = await render(<PlayScreen />);
    await findByText('Start Playing');
    const icon = mockGradients.find((g) => !g.start && g.colors.length === 2);
    expect(icon.colors).toEqual(['rgba(248,87,166,0.15)', 'rgba(255,88,88,0.1)']);
  });
});

describe('PlayScreen under the Spooky palette', () => {
  it('uses the season background and keeps the Start Playing brand gradient', async () => {
    const { findByText } = await render(
      <ThemeProvider palette={spooky}>
        <PlayScreen />
      </ThemeProvider>
    );
    await findByText('Start Playing');
    expect(rootColors()).toEqual(spooky.bg_gradient);
    expect(startPlayingColors()).toEqual(['#f857a6', '#ff5858']);
  });

  it('tints the Tonight card border with the season accent but keeps Change brand pink', async () => {
    getLastContext.mockResolvedValue(CONTEXT);
    getCachedPicks.mockResolvedValue(CACHE);
    const { getByTestId, getByText } = await render(
      <ThemeProvider palette={spooky}>
        <PlayScreen />
      </ThemeProvider>
    );
    await waitFor(() => getByText("Tonight's Picks"));
    const card = getByTestId('tonight-card');
    const flat = StyleSheet.flatten(card.props.style);
    expect(flat.borderColor).toBe('rgba(255,138,61,0.25)');
    // Change is tappable: brand pink stays locked, only non-interactive accents are seasonal.
    expect(StyleSheet.flatten(getByText('Change').props.style).color).toBe('#f857a6');
  });
});

describe('Tonight card under no provider', () => {
  it('keeps today\'s pink border and Change color', async () => {
    getLastContext.mockResolvedValue(CONTEXT);
    getCachedPicks.mockResolvedValue(CACHE);
    const { getByTestId, getByText } = await render(<PlayScreen />);
    await waitFor(() => getByText("Tonight's Picks"));
    const flat = StyleSheet.flatten(getByTestId('tonight-card').props.style);
    expect(flat.borderColor).toBe('rgba(248, 87, 166, 0.25)');
    expect(StyleSheet.flatten(getByText('Change').props.style).color).toBe('#f857a6');
  });
});
