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
