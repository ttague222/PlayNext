/**
 * tonightService unit tests.
 * Uses a per-file STATEFUL AsyncStorage mock (the global jest.setup stub is
 * stateless by design) — declared before importing the service.
 */
const store = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((k, v) => { store[k] = v; return Promise.resolve(); }),
  getItem: jest.fn((k) => Promise.resolve(store[k] ?? null)),
  removeItem: jest.fn((k) => { delete store[k]; return Promise.resolve(); }),
}));
jest.mock('../api', () => ({
  __esModule: true,
  default: { getRecommendations: jest.fn() },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import {
  localDateString,
  saveLastContext,
  getLastContext,
  LAST_CONTEXT_KEY,
  saveTonightCache,
  getCachedPicks,
  TONIGHT_PICKS_KEY,
  fetchTonightsPicks,
} from '../tonightService';

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  jest.clearAllMocks();
});

describe('localDateString', () => {
  it('formats a date as local YYYY-MM-DD', () => {
    expect(localDateString(new Date(2026, 9, 5))).toBe('2026-10-05'); // month is 0-based
  });
});

describe('last context persistence', () => {
  const prefs = {
    timeAvailable: 60,
    energyMood: 'wind_down',
    genres: ['roguelike'],
    platforms: ['pc'],
    sessionType: 'solo',
    discoveryMode: 'familiar',
    favorHistory: true, // premium field: must NOT be persisted
  };

  it('round-trips the context subset', async () => {
    expect(await saveLastContext(prefs)).toBe(true);
    const loaded = await getLastContext();
    expect(loaded).toEqual({
      timeAvailable: 60,
      energyMood: 'wind_down',
      genres: ['roguelike'],
      platforms: ['pc'],
      sessionType: 'solo',
      discoveryMode: 'familiar',
    });
  });

  it('refuses to save without required inputs', async () => {
    expect(await saveLastContext({ timeAvailable: 60 })).toBe(false);
    expect(await saveLastContext({ energyMood: 'casual' })).toBe(false);
    expect(store[LAST_CONTEXT_KEY]).toBeUndefined();
  });

  it('returns null when nothing stored or JSON is corrupt', async () => {
    expect(await getLastContext()).toBeNull();
    store[LAST_CONTEXT_KEY] = '{not json';
    expect(await getLastContext()).toBeNull();
  });
});

describe('tonight cache', () => {
  const context = { timeAvailable: 60, energyMood: 'casual', genres: [], platforms: [], sessionType: 'any', discoveryMode: 'familiar' };
  const games = [{ game_id: 'hades', title: 'Hades' }];

  it('stores todays cache and returns it', async () => {
    await saveTonightCache({ context, sessionId: 's1', games });
    const cached = await getCachedPicks();
    expect(cached.date).toBe(localDateString());
    expect(cached.sessionId).toBe('s1');
    expect(cached.games).toEqual(games);
    expect(cached.context).toEqual(context);
  });

  it('returns null for a stale (yesterday) cache', async () => {
    store[TONIGHT_PICKS_KEY] = JSON.stringify({ date: '2020-01-01', context, sessionId: 's1', games });
    expect(await getCachedPicks()).toBeNull();
  });

  it('returns null for empty games or corrupt JSON', async () => {
    store[TONIGHT_PICKS_KEY] = JSON.stringify({ date: localDateString(), context, sessionId: 's1', games: [] });
    expect(await getCachedPicks()).toBeNull();
    store[TONIGHT_PICKS_KEY] = '{broken';
    expect(await getCachedPicks()).toBeNull();
  });
});

describe('fetchTonightsPicks', () => {
  const context = { timeAvailable: 30, energyMood: 'wind_down', genres: [], platforms: ['pc'], sessionType: 'solo', discoveryMode: 'familiar' };
  const response = { session_id: 'srv-1', recommendations: [{ game_id: 'celeste', title: 'Celeste' }], fallback_applied: false };

  it('returns null without a saved context and never calls the API', async () => {
    expect(await fetchTonightsPicks()).toBeNull();
    expect(api.getRecommendations).not.toHaveBeenCalled();
  });

  it('fetches with the saved context and caches the result', async () => {
    store[LAST_CONTEXT_KEY] = JSON.stringify(context);
    api.getRecommendations.mockResolvedValue(response);

    const result = await fetchTonightsPicks({ excludedGameIds: ['notme'] });

    expect(api.getRecommendations).toHaveBeenCalledWith(expect.objectContaining({
      time_available: 30,
      energy_mood: 'wind_down',
      genres: null,           // empty array collapses to null, matching the normal flow
      platforms: ['pc'],
      session_type: 'solo',
      discovery_mode: 'familiar',
      excluded_game_ids: ['notme'],
    }));
    expect(result.games).toEqual(response.recommendations);
    expect(result.sessionId).toBe('srv-1');
    expect(await getCachedPicks()).toEqual(result); // persisted
  });

  it('returns the existing cache without refetching', async () => {
    store[LAST_CONTEXT_KEY] = JSON.stringify(context);
    await saveTonightCache({ context, sessionId: 'old', games: [{ game_id: 'x', title: 'X' }] });
    const result = await fetchTonightsPicks();
    expect(result.sessionId).toBe('old');
    expect(api.getRecommendations).not.toHaveBeenCalled();
  });

  it('single-flights concurrent calls', async () => {
    store[LAST_CONTEXT_KEY] = JSON.stringify(context);
    let resolve;
    api.getRecommendations.mockReturnValue(new Promise((r) => { resolve = r; }));
    const p1 = fetchTonightsPicks();
    const p2 = fetchTonightsPicks();
    resolve(response);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(api.getRecommendations).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });

  it('propagates API failure and clears the in-flight guard', async () => {
    store[LAST_CONTEXT_KEY] = JSON.stringify(context);
    api.getRecommendations.mockRejectedValueOnce(new Error('boom'));
    await expect(fetchTonightsPicks()).rejects.toThrow('boom');
    api.getRecommendations.mockResolvedValueOnce(response);
    const retry = await fetchTonightsPicks(); // guard must not be stuck
    expect(retry.sessionId).toBe('srv-1');
  });
});
