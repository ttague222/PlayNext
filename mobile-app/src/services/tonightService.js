/**
 * Tonight's Picks — daily ritual service.
 *
 * Owns the persisted last-used recommendation context, the day-scoped picks
 * cache, view tracking for the reminder soft prompt, and the local daily
 * reminder. Pure logic + storage: no React imports.
 *
 * Spec: docs/superpowers/specs/2026-09-28-tonights-picks-design.md
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import api from './api';

export const LAST_CONTEXT_KEY = '@playnxt_last_context';
export const TONIGHT_PICKS_KEY = '@playnxt_tonights_picks';
export const TONIGHT_META_KEY = '@playnxt_tonight_meta';

/** Local-timezone calendar date, e.g. '2026-10-05'. The cache day boundary. */
export function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Persist the subset of preferences Tonight's Picks reuses. Premium filters
 * are deliberately excluded (session-scoped, entitlement-dependent).
 * Returns false (and writes nothing) unless time + mood are both set.
 */
export async function saveLastContext(preferences) {
  if (!preferences?.timeAvailable || !preferences?.energyMood) return false;
  const context = {
    timeAvailable: preferences.timeAvailable,
    energyMood: preferences.energyMood,
    genres: preferences.genres || [],
    platforms: preferences.platforms || [],
    sessionType: preferences.sessionType || 'any',
    discoveryMode: preferences.discoveryMode || 'familiar',
  };
  try {
    await AsyncStorage.setItem(LAST_CONTEXT_KEY, JSON.stringify(context));
    return true;
  } catch {
    return false;
  }
}

export async function getLastContext() {
  try {
    const raw = await AsyncStorage.getItem(LAST_CONTEXT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Write today's cache. Callers pass the context + response they already have. */
export async function saveTonightCache({ context, sessionId, games }) {
  try {
    const cache = { date: localDateString(), context, sessionId, games };
    await AsyncStorage.setItem(TONIGHT_PICKS_KEY, JSON.stringify(cache));
    return cache;
  } catch {
    return null;
  }
}

/** Today's cache, or null when missing, stale, empty, or unreadable. */
export async function getCachedPicks() {
  try {
    const raw = await AsyncStorage.getItem(TONIGHT_PICKS_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (cache?.date !== localDateString()) return null;
    if (!Array.isArray(cache.games) || cache.games.length === 0) return null;
    return cache;
  } catch {
    return null;
  }
}

let _inFlight = null;

/**
 * Return today's picks, fetching and caching them on first call of the day.
 * Concurrent callers share one request. Returns null when no context is
 * saved yet (feature dormant). Throws on API failure — callers show a retry
 * state. `excludedGameIds` lets callers pass Not-For-Me ids (the service has
 * no access to SavedGamesContext).
 */
export async function fetchTonightsPicks({ excludedGameIds = [] } = {}) {
  const cached = await getCachedPicks();
  if (cached) return cached;
  if (_inFlight) return _inFlight;

  _inFlight = (async () => {
    const context = await getLastContext();
    if (!context) return null;
    const response = await api.getRecommendations({
      time_available: context.timeAvailable,
      energy_mood: context.energyMood,
      genres: context.genres?.length ? context.genres : null,
      platforms: context.platforms?.length ? context.platforms : null,
      session_type: context.sessionType,
      discovery_mode: context.discoveryMode,
      session_id: `local-tonight-${Date.now()}`,
      excluded_game_ids: excludedGameIds,
    });
    return saveTonightCache({
      context,
      sessionId: response.session_id,
      games: response.recommendations,
    });
  })();

  try {
    return await _inFlight;
  } finally {
    _inFlight = null;
  }
}

export const DEFAULT_REMINDER_TIME = '20:00';

const DEFAULT_META = {
  viewDates: [],        // distinct local dates the user viewed tonight picks
  promptShown: false,   // soft prompt is once-ever
  reminderEnabled: false,
  reminderTime: DEFAULT_REMINDER_TIME,
};

async function getMeta() {
  try {
    const raw = await AsyncStorage.getItem(TONIGHT_META_KEY);
    return raw ? { ...DEFAULT_META, ...JSON.parse(raw) } : { ...DEFAULT_META };
  } catch {
    return { ...DEFAULT_META };
  }
}

async function saveMeta(meta) {
  try {
    await AsyncStorage.setItem(TONIGHT_META_KEY, JSON.stringify(meta));
  } catch {
    // Meta is best-effort; losing it only delays the soft prompt.
  }
}

/** Record that the user viewed tonight's picks today (deduped per day). */
export async function recordTonightView() {
  const meta = await getMeta();
  const today = localDateString();
  if (!meta.viewDates.includes(today)) {
    meta.viewDates = [...meta.viewDates, today].slice(-30);
    await saveMeta(meta);
  }
  return meta;
}

/** Soft prompt gate: second distinct viewing day, never shown before, not already enabled. */
export async function shouldOfferReminder() {
  const meta = await getMeta();
  return !meta.promptShown && !meta.reminderEnabled && new Set(meta.viewDates).size >= 2;
}

export async function markReminderPromptShown() {
  const meta = await getMeta();
  await saveMeta({ ...meta, promptShown: true });
}

export const REMINDER_NOTIFICATION_ID = 'tonight-reminder';

export async function getReminderSettings() {
  const meta = await getMeta();
  return { enabled: meta.reminderEnabled, time: meta.reminderTime };
}

/**
 * Enable/disable the local daily reminder. Requests OS permission when
 * needed. Returns { enabled, time } on success, { enabled: false,
 * permissionDenied: true } when the OS blocks it.
 */
export async function setReminder(enabled, time = DEFAULT_REMINDER_TIME) {
  const meta = await getMeta();

  if (!enabled) {
    try {
      await Notifications.cancelScheduledNotificationAsync(REMINDER_NOTIFICATION_ID);
    } catch {
      // Nothing scheduled is fine.
    }
    await saveMeta({ ...meta, reminderEnabled: false });
    return { enabled: false };
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') {
    await saveMeta({ ...meta, reminderEnabled: false });
    return { enabled: false, permissionDenied: true };
  }

  const [hour, minute] = time.split(':').map(Number);
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_NOTIFICATION_ID);
  } catch {
    // First schedule: nothing to cancel.
  }
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_NOTIFICATION_ID,
    content: {
      title: 'PlayNxt',
      body: 'Your picks for tonight are ready.',
      data: { deep_link: 'tonight' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
  await saveMeta({ ...meta, reminderEnabled: true, reminderTime: time });
  return { enabled: true, time };
}
