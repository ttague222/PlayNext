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
import * as Notifications from 'expo-notifications';
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
  recordTonightView,
  shouldOfferReminder,
  markReminderPromptShown,
  TONIGHT_META_KEY,
  getReminderSettings,
  setReminder,
  DEFAULT_REMINDER_TIME,
  REMINDER_NOTIFICATION_ID,
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

describe('view tracking and reminder offer', () => {
  it('does not offer after a single day of views', async () => {
    await recordTonightView();
    await recordTonightView(); // same day, deduped
    const meta = JSON.parse(store[TONIGHT_META_KEY]);
    expect(meta.viewDates).toHaveLength(1);
    expect(await shouldOfferReminder()).toBe(false);
  });

  it('offers on the second distinct day, once', async () => {
    store[TONIGHT_META_KEY] = JSON.stringify({ viewDates: ['2020-01-01'], promptShown: false, reminderEnabled: false, reminderTime: '20:00' });
    await recordTonightView(); // second distinct day
    expect(await shouldOfferReminder()).toBe(true);
    await markReminderPromptShown();
    expect(await shouldOfferReminder()).toBe(false); // never re-prompt
  });

  it('does not offer when the reminder is already enabled', async () => {
    store[TONIGHT_META_KEY] = JSON.stringify({ viewDates: ['2020-01-01', localDateString()], promptShown: false, reminderEnabled: true, reminderTime: '20:00' });
    expect(await shouldOfferReminder()).toBe(false);
  });

  it('caps stored view dates at 30', async () => {
    const dates = Array.from({ length: 30 }, (_, i) => `2020-01-${String(i + 1).padStart(2, '0')}`);
    store[TONIGHT_META_KEY] = JSON.stringify({ viewDates: dates, promptShown: true, reminderEnabled: false, reminderTime: '20:00' });
    await recordTonightView();
    const meta = JSON.parse(store[TONIGHT_META_KEY]);
    expect(meta.viewDates).toHaveLength(30);
    expect(meta.viewDates[29]).toBe(localDateString());
  });
});

describe('reminder scheduling', () => {
  it('schedules a daily notification and persists settings', async () => {
    const result = await setReminder(true, '21:00');
    expect(result).toEqual({ enabled: true, time: '21:00' });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: REMINDER_NOTIFICATION_ID,
      content: {
        title: 'PlayNxt',
        body: 'Your picks for tonight are ready.',
        data: { deep_link: 'tonight' },
      },
      trigger: { type: 'daily', hour: 21, minute: 0 },
    });
    expect(await getReminderSettings()).toEqual({ enabled: true, time: '21:00' });
  });

  it('cancels before rescheduling so only one reminder ever exists', async () => {
    await setReminder(true, '20:00');
    await setReminder(true, '22:00');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_NOTIFICATION_ID);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('disabling cancels and persists', async () => {
    await setReminder(true, '20:00');
    const result = await setReminder(false);
    expect(result.enabled).toBe(false);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_NOTIFICATION_ID);
    expect(await getReminderSettings()).toEqual({ enabled: false, time: '20:00' }); // time remembered
  });

  it('reports permissionDenied without scheduling when OS denies', async () => {
    Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    Notifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    const result = await setReminder(true, DEFAULT_REMINDER_TIME);
    expect(result).toEqual({ enabled: false, permissionDenied: true });
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(await getReminderSettings()).toEqual(expect.objectContaining({ enabled: false }));
  });

  it('falls back to the default time when given an invalid time string', async () => {
    const result = await setReminder(true, '8:00 PM');
    expect(result).toEqual({ enabled: true, time: DEFAULT_REMINDER_TIME });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: { type: 'daily', hour: 20, minute: 0 },
      })
    );
    expect(await getReminderSettings()).toEqual({ enabled: true, time: '20:00' });
  });

  it('reconciles stale enabled state when OS permission was revoked after the fact', async () => {
    await setReminder(true, '21:00');
    Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    expect(await getReminderSettings()).toEqual({ enabled: false, time: '21:00' });
  });
});
