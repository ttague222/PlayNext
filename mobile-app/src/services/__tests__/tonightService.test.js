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
