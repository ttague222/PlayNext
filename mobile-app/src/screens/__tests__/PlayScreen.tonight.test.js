import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: undefined }),
  // Run focus effects immediately, once, like a focused mount.
  useFocusEffect: (cb) => { const React = require('react'); React.useEffect(cb, []); },
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }) => children }));

const mockStartTonightSession = jest.fn(() => true);
jest.mock('../../context/RecommendationContext', () => ({
  useRecommendation: () => ({
    startSession: jest.fn(),
    resetPreferences: jest.fn(),
    startTonightSession: mockStartTonightSession,
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
}));
jest.mock('../../utils/tonightReminderPrompt', () => ({
  maybeOfferTonightReminder: jest.fn(() => Promise.resolve(false)),
}));
jest.mock('../../services/analyticsService', () => ({ logEvent: jest.fn() }));
jest.mock('../../services/gameImages', () => ({
  getGameImage: jest.fn(() => Promise.resolve({ imageUrl: null, fallbackColors: ['#1a1a2e', '#16213e'] })),
}));

import { getLastContext, getCachedPicks, fetchTonightsPicks, recordTonightView } from '../../services/tonightService';
import { logEvent } from '../../services/analyticsService';
import PlayScreen from '../PlayScreen';

const CONTEXT = { timeAvailable: 60, energyMood: 'casual', genres: [], platforms: [], sessionType: 'any', discoveryMode: 'familiar' };
const CACHE = { date: '2026-10-05', sessionId: 's1', context: CONTEXT, games: [{ game_id: 'hades', title: 'Hades' }] };

beforeEach(() => jest.clearAllMocks());

it('shows no card when no context is saved', async () => {
  getLastContext.mockResolvedValue(null);
  const { queryByText } = await render(<PlayScreen />);
  await waitFor(() => expect(getLastContext).toHaveBeenCalled());
  expect(queryByText("Tonight's Picks")).toBeNull();
  expect(fetchTonightsPicks).not.toHaveBeenCalled();
});

it('renders ready card straight from cache without fetching', async () => {
  getLastContext.mockResolvedValue(CONTEXT);
  getCachedPicks.mockResolvedValue(CACHE);
  const { getByText } = await render(<PlayScreen />);
  await waitFor(() => getByText("Tonight's Picks"));
  getByText('Hades');
  expect(fetchTonightsPicks).not.toHaveBeenCalled();
});

it('prefetches when no cache exists yet', async () => {
  getLastContext.mockResolvedValue(CONTEXT);
  getCachedPicks.mockResolvedValue(null);
  fetchTonightsPicks.mockResolvedValue(CACHE);
  const { getByText } = await render(<PlayScreen />);
  await waitFor(() => getByText('Hades'));
  expect(fetchTonightsPicks).toHaveBeenCalled();
});

it('tapping a ready card seeds the session, navigates, records the view', async () => {
  getLastContext.mockResolvedValue(CONTEXT);
  getCachedPicks.mockResolvedValue(CACHE);
  const { getByTestId, getByText } = await render(<PlayScreen />);
  await waitFor(() => getByText('Hades'));
  fireEvent.press(getByTestId('tonight-card'));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Results'));
  expect(mockStartTonightSession).toHaveBeenCalledWith(CACHE);
  expect(recordTonightView).toHaveBeenCalled();
  expect(logEvent).toHaveBeenCalledWith('tonight_picks_viewed', { via: 'card' });
});

it('shows the error state when the prefetch fails', async () => {
  getLastContext.mockResolvedValue(CONTEXT);
  getCachedPicks.mockResolvedValue(null);
  fetchTonightsPicks.mockRejectedValue(new Error('offline'));
  const { getByText } = await render(<PlayScreen />);
  await waitFor(() => getByText("Couldn't load tonight's picks. Tap to retry."));
});
