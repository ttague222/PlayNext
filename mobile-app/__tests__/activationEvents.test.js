/**
 * Activation scoreboard events (analytics event brief): the funnel from
 * recommendation_started to game_selected. Names and params are pinned here
 * because the marketing scorecard formulas key on them.
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1', isAnonymous: true } }),
}));

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    createSession: jest.fn(),
    getRecommendations: jest.fn(),
    rerollRecommendations: jest.fn(),
    acceptRecommendation: jest.fn(),
    getBucket: jest.fn(),
    getBuckets: jest.fn(),
  },
}));

jest.mock('../src/services/analyticsService', () => ({
  logEvent: jest.fn(),
}));

jest.mock('../src/services/attributionService', () => ({
  getInstallSource: jest.fn(() => Promise.resolve('scenario-pages')),
}));

import mockApi from '../src/services/api';
import { logEvent } from '../src/services/analyticsService';
import { SavedGamesProvider } from '../src/context/SavedGamesContext';
import {
  RecommendationProvider,
  useRecommendation,
} from '../src/context/RecommendationContext';

const PICKS = [
  { game_id: 'hidden-folks', title: 'Hidden Folks' },
  { game_id: 'unpacking', title: 'Unpacking' },
  { game_id: 'tinykin', title: 'Tinykin' },
];

const response = (recommendations) => ({
  recommendations,
  session_id: 'session-1',
  fallback_applied: false,
  fallback_message: null,
});

const wrapper = ({ children }) => (
  <SavedGamesProvider>
    <RecommendationProvider>{children}</RecommendationProvider>
  </SavedGamesProvider>
);

const eventsNamed = (name) =>
  logEvent.mock.calls.filter(([n]) => n === name).map(([, params]) => params);

const renderWithPrefs = async (prefs) => {
  const { result } = await renderHook(useRecommendation, { wrapper });
  await act(async () => {
    for (const [key, value] of Object.entries(prefs)) {
      await result.current.updatePreference(key, value);
    }
  });
  return result;
};

describe('activation scoreboard events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.createSession.mockResolvedValue({ session_id: 'session-1' });
    mockApi.getRecommendations.mockResolvedValue(response(PICKS));
    mockApi.rerollRecommendations.mockResolvedValue(response(PICKS.slice(0, 2)));
    mockApi.acceptRecommendation.mockResolvedValue({});
    mockApi.getBucket.mockResolvedValue({ games: [], game_count: 0 });
  });

  it('recommendation_started carries the request context', async () => {
    const result = await renderWithPrefs({
      timeAvailable: 30,
      energyMood: 'wind_down',
      platforms: ['switch', 'pc'],
    });
    await act(async () => {
      await result.current.getRecommendations();
    });

    expect(eventsNamed('recommendation_started')).toEqual([
      { minutes: 30, mood: 'wind_down', platform_filter: 'pc,switch', library_mode: 'none' },
    ]);
  });

  it('library_mode reports steam_synced in Backlog Mode, platform_filter none when unset', async () => {
    const result = await renderWithPrefs({
      timeAvailable: 60,
      energyMood: 'focused',
      platforms: [],
      libraryOnly: true,
    });
    await act(async () => {
      await result.current.getRecommendations();
    });

    expect(eventsNamed('recommendation_started')[0]).toMatchObject({
      platform_filter: 'none',
      library_mode: 'steam_synced',
    });
  });

  it('recommendation_viewed fires for initial picks and rerolls, with install_source', async () => {
    const result = await renderWithPrefs({ timeAvailable: 30, energyMood: 'wind_down' });
    await act(async () => {
      await result.current.getRecommendations();
    });
    await act(async () => {
      await result.current.reroll();
    });

    await waitFor(() => expect(eventsNamed('recommendation_viewed')).toHaveLength(2));
    const [first, second] = eventsNamed('recommendation_viewed');
    expect(first).toEqual({
      result_count: 3,
      latency_ms: expect.any(Number),
      install_source: 'scenario-pages',
      pick_source: 'flow',
    });
    expect(second.result_count).toBe(2);
    // A reroll is not a new request: only one recommendation_started
    expect(eventsNamed('recommendation_started')).toHaveLength(1);
  });

  it('recommendation_viewed does not fire for an empty set', async () => {
    mockApi.getRecommendations.mockResolvedValue(response([]));
    const result = await renderWithPrefs({ timeAvailable: 30, energyMood: 'wind_down' });
    await act(async () => {
      await result.current.getRecommendations();
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(eventsNamed('recommendation_viewed')).toHaveLength(0);
  });

  it('game_selected reports the pick rank and echoes the request', async () => {
    const result = await renderWithPrefs({ timeAvailable: 30, energyMood: 'wind_down' });
    await act(async () => {
      await result.current.getRecommendations();
    });
    await act(async () => {
      await result.current.acceptRecommendation('tinykin', 'Tinykin');
    });

    expect(eventsNamed('game_selected')).toEqual([
      { game_id: 'tinykin', rank: 3, minutes: 30, mood: 'wind_down', pick_source: 'flow' },
    ]);
  });

  it("opening Tonight's Picks counts as a view (no latency) and tags selections", async () => {
    const result = await renderWithPrefs({});
    await act(async () => {
      result.current.startTonightSession({
        sessionId: 'session-tonight',
        games: PICKS,
        context: { timeAvailable: 30, energyMood: 'wind_down' },
      });
    });
    await waitFor(() => expect(eventsNamed('recommendation_viewed')).toHaveLength(1));
    expect(eventsNamed('recommendation_viewed')[0]).toEqual({
      result_count: 3,
      install_source: 'scenario-pages',
      pick_source: 'tonight',
    });
    // Seeding from cache is not a new request
    expect(eventsNamed('recommendation_started')).toHaveLength(0);

    await act(async () => {
      await result.current.acceptRecommendation('unpacking', 'Unpacking');
    });
    expect(eventsNamed('game_selected')).toEqual([
      { game_id: 'unpacking', rank: 2, minutes: 30, mood: 'wind_down', pick_source: 'tonight' },
    ]);
  });

  it('game_selected still fires when the history write fails', async () => {
    mockApi.acceptRecommendation.mockRejectedValue(new Error('offline'));
    const result = await renderWithPrefs({ timeAvailable: 15, energyMood: 'casual' });
    await act(async () => {
      await result.current.getRecommendations();
    });
    await act(async () => {
      await result.current.acceptRecommendation('hidden-folks', 'Hidden Folks');
    });

    expect(eventsNamed('game_selected')).toEqual([
      { game_id: 'hidden-folks', rank: 1, minutes: 15, mood: 'casual', pick_source: 'flow' },
    ]);
  });
});
