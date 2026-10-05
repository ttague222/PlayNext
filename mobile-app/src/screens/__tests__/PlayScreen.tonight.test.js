import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
let mockRouteParams;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setParams: mockSetParams }),
  useRoute: () => ({ params: mockRouteParams }),
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
  // Matches CACHE.date so ready-card taps pass the stale-day guard.
  localDateString: jest.fn(() => '2026-10-05'),
}));
jest.mock('../../utils/tonightReminderPrompt', () => ({
  maybeOfferTonightReminder: jest.fn(() => Promise.resolve(false)),
}));
jest.mock('../../services/analyticsService', () => ({ logEvent: jest.fn() }));
jest.mock('../../services/gameImages', () => ({
  getGameImage: jest.fn(() => Promise.resolve({ imageUrl: null, fallbackColors: ['#1a1a2e', '#16213e'] })),
}));

import { getLastContext, getCachedPicks, fetchTonightsPicks, recordTonightView, localDateString } from '../../services/tonightService';
import { logEvent } from '../../services/analyticsService';
import PlayScreen from '../PlayScreen';

const CONTEXT = { timeAvailable: 60, energyMood: 'casual', genres: [], platforms: [], sessionType: 'any', discoveryMode: 'familiar' };
const CACHE = { date: '2026-10-05', sessionId: 's1', context: CONTEXT, games: [{ game_id: 'hades', title: 'Hades' }] };

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = undefined;
});

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

it('clears the openTonight route param after consuming it', async () => {
  mockRouteParams = { openTonight: 12345 };
  getLastContext.mockResolvedValue(CONTEXT);
  getCachedPicks.mockResolvedValue(CACHE);
  await render(<PlayScreen />);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Results'));
  expect(mockSetParams).toHaveBeenCalledWith({ openTonight: undefined, openTonightVia: undefined });
});

it('hides the feature pills while the Tonight card is showing', async () => {
  getLastContext.mockResolvedValue(CONTEXT);
  getCachedPicks.mockResolvedValue(CACHE);
  const { getByText, queryByText } = await render(<PlayScreen />);
  await waitFor(() => getByText("Tonight's Picks"));
  expect(queryByText('Time-matched')).toBeNull();
});

it('keeps the feature pills when there is no Tonight card', async () => {
  getLastContext.mockResolvedValue(null);
  const { findByText } = await render(<PlayScreen />);
  await findByText('Time-matched');
});

it("What's New link opens tonight's picks and tags the view", async () => {
  mockRouteParams = { openTonight: 'whats_new', openTonightVia: 'whats_new' };
  getLastContext.mockResolvedValue(CONTEXT);
  getCachedPicks.mockResolvedValue(CACHE);
  await render(<PlayScreen />);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Results'));
  expect(logEvent).toHaveBeenCalledWith('tonight_picks_viewed', { via: 'whats_new' });
  expect(mockSetParams).toHaveBeenCalledWith({ openTonight: undefined, openTonightVia: undefined });
});

it("What's New link starts the quiz when there are no picks yet", async () => {
  mockRouteParams = { openTonight: 'whats_new', openTonightVia: 'whats_new' };
  getLastContext.mockResolvedValue(null);
  await render(<PlayScreen />);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('TimeSelect'));
  expect(mockStartTonightSession).not.toHaveBeenCalled();
});

it('deep link keeps a returning user on Play when the picks fail to load', async () => {
  // A fetch error is not "no picks yet": the quiz would reset their
  // preferences and fail offline too. The card's error state offers a retry.
  mockRouteParams = { openTonight: 123 };
  getLastContext.mockResolvedValue(CONTEXT);
  getCachedPicks.mockResolvedValue(null);
  fetchTonightsPicks.mockRejectedValue(new Error('offline'));
  const { findByText } = await render(<PlayScreen />);
  await findByText("Couldn't load tonight's picks. Tap to retry.");
  await waitFor(() => expect(mockSetParams).toHaveBeenCalledWith({ openTonight: undefined, openTonightVia: undefined }));
  expect(mockNavigate).not.toHaveBeenCalledWith('TimeSelect');
  expect(mockNavigate).not.toHaveBeenCalledWith('Results');
});

it("deep link starts the quiz when the picks can't open a session", async () => {
  // A cache the session rejects (no games / no context) must not dead-end.
  mockRouteParams = { openTonight: 'whats_new', openTonightVia: 'whats_new' };
  mockStartTonightSession.mockReturnValueOnce(false);
  getLastContext.mockResolvedValue(CONTEXT);
  getCachedPicks.mockResolvedValue(CACHE);
  await render(<PlayScreen />);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('TimeSelect'));
  expect(mockNavigate).not.toHaveBeenCalledWith('Results');
  expect(logEvent).not.toHaveBeenCalledWith('tonight_picks_viewed', expect.anything());
});

it("deep link reloads instead of opening yesterday's ready card", async () => {
  // App parked on Play across midnight: the in-memory card is still 'ready'
  // with yesterday's picks when the reminder (or What's New) link arrives.
  getLastContext.mockResolvedValue(CONTEXT);
  getCachedPicks.mockResolvedValue(CACHE);
  const { getByText, rerender } = await render(<PlayScreen />);
  await waitFor(() => getByText('Hades'));

  const TODAY = { ...CACHE, date: '2026-10-06', sessionId: 's2', games: [{ game_id: 'celeste', title: 'Celeste' }] };
  localDateString.mockReturnValue('2026-10-06');
  getCachedPicks.mockResolvedValue(null);
  fetchTonightsPicks.mockResolvedValue(TODAY);
  mockRouteParams = { openTonight: 456 };
  await rerender(<PlayScreen />);

  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Results'));
  expect(mockStartTonightSession).toHaveBeenCalledWith(TODAY);
  expect(mockStartTonightSession).not.toHaveBeenCalledWith(CACHE);
  localDateString.mockReturnValue('2026-10-05');
});

// History note: firing two rapid UNFLUSHED fireEvent.press calls in this
// RN test renderer leaked a native-touchable timer that corrupted the next
// render() in the file and kept the Node process alive after a solo run
// (until an eventual OOM crash). Wrapping both presses in one act() block
// fixes the leak while preserving what the test needs: the second press
// still arrives while the first's async open is in flight. Kept last out
// of caution; the act() wrap below is the load-bearing part.
it('a double tap on a ready card only starts one session', async () => {
  getLastContext.mockResolvedValue(CONTEXT);
  getCachedPicks.mockResolvedValue(CACHE);
  const screen = await render(<PlayScreen />);
  await waitFor(() => screen.getByText('Hades'));
  const card = screen.getByTestId('tonight-card');
  // Both presses land inside one act block: the second still arrives while
  // the first's async open is in flight (which is what the guard must
  // block), but the touchable's press aftermath gets flushed instead of
  // leaking a timer that outlives the suite.
  await act(async () => {
    fireEvent.press(card);
    fireEvent.press(card);
  });
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Results'));
  expect(mockStartTonightSession).toHaveBeenCalledTimes(1);
  // Explicit teardown as belt-and-braces alongside the act() press wrap.
  await act(async () => {
    screen.unmount();
  });
});
