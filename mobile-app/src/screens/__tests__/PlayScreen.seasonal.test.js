import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setParams: jest.fn() }),
  useRoute: () => ({ params: undefined }),
  // Run focus effects immediately, once, like a focused mount.
  useFocusEffect: (cb) => { const React = require('react'); React.useEffect(cb, []); },
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }) => children ?? null }));

const mockStartCollectionSession = jest.fn(() => true);
// Mutable so a test can play the provider hydrating saved preferences after mount.
const mockRec = { savedPlatforms: ['pc'], savedPreferencesLoaded: true };
jest.mock('../../context/RecommendationContext', () => ({
  useRecommendation: () => ({
    startSession: jest.fn(),
    resetPreferences: jest.fn(),
    startTonightSession: jest.fn(() => true),
    startCollectionSession: mockStartCollectionSession,
    savedPlatforms: mockRec.savedPlatforms,
    savedPreferencesLoaded: mockRec.savedPreferencesLoaded,
  }),
}));
jest.mock('../../context/SavedGamesContext', () => ({
  useSavedGames: () => ({ notForMeGameIds: [] }),
}));
jest.mock('../../services/tonightService', () => ({
  getLastContext: jest.fn(() => Promise.resolve(null)),
  getCachedPicks: jest.fn(() => Promise.resolve(null)),
  fetchTonightsPicks: jest.fn(),
  recordTonightView: jest.fn(() => Promise.resolve()),
  localDateString: jest.fn(() => '2026-11-05'),
}));
// The real service module is used for season math; only its network edges are faked.
jest.mock('../../services/api', () => ({ __esModule: true, default: {} }));
jest.mock('../../services/seasonalService', () => ({
  ...jest.requireActual('../../services/seasonalService'),
  loadSeasonalContent: jest.fn(),
  fetchCollectionPicks: jest.fn(),
}));
jest.mock('../../utils/tonightReminderPrompt', () => ({
  maybeOfferTonightReminder: jest.fn(() => Promise.resolve(false)),
}));
jest.mock('../../services/analyticsService', () => ({ logEvent: jest.fn() }));
jest.mock('../../services/gameImages', () => ({
  getGameImage: jest.fn(() => Promise.resolve({ imageUrl: null, fallbackColors: ['#1a1a2e', '#16213e'] })),
}));

import { localDateString } from '../../services/tonightService';
import {
  loadSeasonalContent,
  fetchCollectionPicks,
  getCachedSeasonalContentSync,
} from '../../services/seasonalService';
import { logEvent } from '../../services/analyticsService';
import PlayScreen from '../PlayScreen';

const COLLECTION_ID = 'harvest-2026-long-weekend';
const PICKS = {
  date: '2026-11-05',
  collectionId: COLLECTION_ID,
  platformFilter: 'pc',
  sessionId: 's1',
  games: [
    { game_id: 'hades', title: 'Hades' },
    { game_id: 'celeste', title: 'Celeste' },
    { game_id: 'unpacking', title: 'Unpacking' },
  ],
  fallbackApplied: false,
  fallbackMessage: null,
};
const harvestCollection = () =>
  getCachedSeasonalContentSync().seasons.find((s) => s.id === 'harvest-2026').collections[0];

const viewedCalls = () => logEvent.mock.calls.filter(([name]) => name === 'seasonal_collection_viewed');

let store;

beforeEach(() => {
  jest.clearAllMocks();
  store = {};
  AsyncStorage.getItem.mockImplementation((key) => Promise.resolve(store[key] ?? null));
  AsyncStorage.setItem.mockImplementation((key, value) => {
    store[key] = value;
    return Promise.resolve();
  });
  localDateString.mockReturnValue('2026-11-05');
  loadSeasonalContent.mockImplementation(() => Promise.resolve(getCachedSeasonalContentSync()));
  fetchCollectionPicks.mockResolvedValue(PICKS);
  mockStartCollectionSession.mockReturnValue(true);
  mockRec.savedPlatforms = ['pc'];
  mockRec.savedPreferencesLoaded = true;
});

describe('saved platforms still loading at mount', () => {
  // The provider hydrates savedPlatforms from storage after PlayScreen mounts.
  const hydrate = async (screen, platforms) => {
    mockRec.savedPlatforms = platforms;
    mockRec.savedPreferencesLoaded = true;
    await screen.rerender(<PlayScreen />);
  };

  beforeEach(() => {
    mockRec.savedPlatforms = [];
    mockRec.savedPreferencesLoaded = false;
  });

  it('holds the first picks fetch until they load, then fetches with them', async () => {
    const screen = await render(<PlayScreen />);
    await screen.findByTestId('seasonal-card-loading');
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchCollectionPicks).not.toHaveBeenCalled();

    await hydrate(screen, ['switch']);
    await screen.findByText('Hades');
    expect(fetchCollectionPicks).toHaveBeenCalledTimes(1);
    expect(fetchCollectionPicks).toHaveBeenCalledWith(harvestCollection(), { platforms: ['switch'] });
  });

  it('a tap before they load waits, then opens picks fetched with them', async () => {
    const switchPicks = { ...PICKS, platformFilter: 'switch' };
    fetchCollectionPicks.mockResolvedValue(switchPicks);
    const screen = await render(<PlayScreen />);
    await act(async () => {
      fireEvent.press(await screen.findByTestId(`seasonal-card-${COLLECTION_ID}`));
    });
    expect(fetchCollectionPicks).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();

    await hydrate(screen, ['switch']);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Results'));
    expect(mockStartCollectionSession).toHaveBeenCalledWith(harvestCollection(), switchPicks);
    expect(fetchCollectionPicks.mock.calls.every(([, opts]) => opts.platforms[0] === 'switch')).toBe(true);
  });
});

it('a tap refetches when the saved platforms changed since the card loaded', async () => {
  const screen = await render(<PlayScreen />);
  await screen.findByText('Hades');
  mockRec.savedPlatforms = ['switch'];
  await screen.rerender(<PlayScreen />);
  const switchPicks = { ...PICKS, platformFilter: 'switch', sessionId: 's2' };
  fetchCollectionPicks.mockResolvedValue(switchPicks);
  await act(async () => {
    fireEvent.press(screen.getByTestId(`seasonal-card-${COLLECTION_ID}`));
  });
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Results'));
  expect(fetchCollectionPicks).toHaveBeenLastCalledWith(harvestCollection(), { platforms: ['switch'] });
  expect(mockStartCollectionSession).toHaveBeenCalledWith(harvestCollection(), switchPicks);
});

it('shows the seasonal card in season, prefetching with the saved platforms', async () => {
  const { findByText, getByText } = await render(<PlayScreen />);
  await findByText("Couch co-op for when everyone's over");
  await findByText('Hades');
  getByText('60 min · Casual · Couch co-op');
  getByText('Harvest');
  expect(fetchCollectionPicks).toHaveBeenCalledWith(harvestCollection(), { platforms: ['pc'] });
});

it('shows no card between seasons and makes no picks request', async () => {
  localDateString.mockReturnValue('2026-10-25');
  const { findByText, queryByText } = await render(<PlayScreen />);
  await findByText('Time-matched');
  expect(queryByText("Couch co-op for when everyone's over")).toBeNull();
  expect(fetchCollectionPicks).not.toHaveBeenCalled();
  expect(viewedCalls()).toHaveLength(0);
});

it('replaces the feature pills while a seasonal card is showing', async () => {
  const { findByText, queryByText } = await render(<PlayScreen />);
  await findByText('Hades');
  expect(queryByText('Time-matched')).toBeNull();
});

it('keeps the hero Start Playing CTA ahead of the seasonal card', async () => {
  const screen = await render(<PlayScreen />);
  await screen.findByText('Hades');
  const tree = JSON.stringify(screen.toJSON());
  const cta = tree.indexOf('Start Playing');
  const card = tree.indexOf("Couch co-op for when everyone's over");
  expect(cta).toBeGreaterThan(-1);
  expect(card).toBeGreaterThan(cta);
});

it('tapping a ready card seeds the collection session, then opens Results', async () => {
  const { findByText, getByTestId } = await render(<PlayScreen />);
  await findByText('Hades');
  fireEvent.press(getByTestId(`seasonal-card-${COLLECTION_ID}`));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Results'));
  expect(mockStartCollectionSession).toHaveBeenCalledWith(harvestCollection(), PICKS);
  expect(logEvent).toHaveBeenCalledWith('seasonal_collection_tapped', {
    collection_id: COLLECTION_ID,
    season_id: 'harvest-2026',
  });
  expect(fetchCollectionPicks).toHaveBeenCalledTimes(1);
});

it('does not navigate when the session cannot start', async () => {
  mockStartCollectionSession.mockReturnValue(false);
  const { findByText, getByTestId } = await render(<PlayScreen />);
  await findByText('Hades');
  await act(async () => {
    fireEvent.press(getByTestId(`seasonal-card-${COLLECTION_ID}`));
  });
  expect(mockStartCollectionSession).toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('shows retry on a failed prefetch and recovers on Retry without navigating', async () => {
  fetchCollectionPicks.mockRejectedValueOnce(new Error('offline'));
  const { findByText, getByText } = await render(<PlayScreen />);
  await findByText("Couldn't load today's picks.");
  await act(async () => {
    fireEvent.press(getByText('Retry'));
  });
  await findByText('Hades');
  expect(fetchCollectionPicks).toHaveBeenCalledTimes(2);
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('tapping an errored card retries and opens the picks if they land', async () => {
  fetchCollectionPicks.mockRejectedValueOnce(new Error('offline'));
  const { findByText, getByTestId } = await render(<PlayScreen />);
  await findByText("Couldn't load today's picks.");
  await act(async () => {
    fireEvent.press(getByTestId(`seasonal-card-${COLLECTION_ID}`));
  });
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Results'));
  expect(mockStartCollectionSession).toHaveBeenCalledWith(harvestCollection(), PICKS);
});

it('hides the card when the picks come back empty', async () => {
  fetchCollectionPicks.mockResolvedValue({ ...PICKS, games: [] });
  const { queryByText } = await render(<PlayScreen />);
  await waitFor(() => expect(fetchCollectionPicks).toHaveBeenCalled());
  await waitFor(() => expect(queryByText("Couch co-op for when everyone's over")).toBeNull());
});

describe('seasonal_collection_viewed', () => {
  it('fires once per collection per local date across focuses', async () => {
    const first = await render(<PlayScreen />);
    await first.findByText('Hades');
    await waitFor(() => expect(viewedCalls()).toHaveLength(1));
    expect(viewedCalls()[0][1]).toEqual({ collection_id: COLLECTION_ID, season_id: 'harvest-2026' });
    await act(async () => {
      first.unmount();
    });

    // Second focus, same date: no new event.
    const second = await render(<PlayScreen />);
    await second.findByText('Hades');
    await act(async () => {
      await Promise.resolve();
    });
    expect(viewedCalls()).toHaveLength(1);
    await act(async () => {
      second.unmount();
    });

    // Next local date: fires again.
    localDateString.mockReturnValue('2026-11-06');
    fetchCollectionPicks.mockResolvedValue({ ...PICKS, date: '2026-11-06' });
    const third = await render(<PlayScreen />);
    await third.findByText('Hades');
    await waitFor(() => expect(viewedCalls()).toHaveLength(2));
    await act(async () => {
      third.unmount();
    });
  });
});

// Same act() wrapping as PlayScreen.tonight.test.js's double-tap test: two
// presses in one act block so the second lands while the first is in flight.
it('a double tap only starts one session', async () => {
  const screen = await render(<PlayScreen />);
  await screen.findByText('Hades');
  const card = screen.getByTestId(`seasonal-card-${COLLECTION_ID}`);
  await act(async () => {
    fireEvent.press(card);
    fireEvent.press(card);
  });
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Results'));
  expect(mockStartCollectionSession).toHaveBeenCalledTimes(1);
  await act(async () => {
    screen.unmount();
  });
});
