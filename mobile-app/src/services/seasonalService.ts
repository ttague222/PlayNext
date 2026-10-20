/**
 * Seasonal content service.
 *
 * Fetches the seasonal calendar from the API, caches it, and falls back to the
 * copy bundled at build time (config/seasonal.fallback.json) so a first launch
 * with no network still has a calendar. Which season is "active" is decided on
 * the device from the local date, never by the server or by cache age: a cache
 * fetched during one season yields the next season on the first day of it.
 *
 * Also owns the per-collection daily picks cache behind the seasonal cards.
 * Pure logic + storage: no React imports. Screens read through this service
 * and never call the seasonal API directly.
 *
 * Spec: docs/superpowers/specs/2026-10-20-seasonal-themes-design.md
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { localDateString } from './tonightService';
import bundledContent from '../config/seasonal.fallback.json';

export type Palette = {
  bg_gradient: string[];
  bg_decor: string;
  accent_season: string;
  on_accent_season: string;
};

export type CollectionParams = {
  time_available: number;
  energy_mood: string;
  genres?: string[] | null;
  session_type?: string;
  discovery_mode?: string;
};

export type Collection = {
  id: string;
  title: string;
  blurb: string;
  params: CollectionParams;
  /** Inclusive YYYY-MM-DD window for micro-moment collections; absent = whole season. */
  starts?: string | null;
  ends?: string | null;
};

export type Season = {
  id: string;
  name: string;
  /** Inclusive YYYY-MM-DD bounds. */
  starts: string;
  ends: string;
  palette: Palette;
  header_image?: { url: string; alt: string } | null;
  collections: Collection[];
};

export type SeasonalContent = {
  schema_version: 1;
  seasons: Season[];
};

export type CollectionPicks = {
  date: string;
  collectionId: string;
  /** platformFilterKey of the platforms these picks were fetched for. */
  platformFilter: string;
  sessionId: string;
  games: object[];
  fallbackApplied: boolean;
  fallbackMessage: string | null;
};

export const SEASONAL_CACHE_KEY = '@playnxt_seasonal_content';
export const COLLECTION_PICKS_KEY = '@playnxt_collection_picks';
export const REFRESH_MS = 6 * 60 * 60 * 1000;

const GRADIENT_STOPS = 3;
const MAX_VISIBLE_COLLECTIONS = 2;

const BUNDLED: SeasonalContent = bundledContent as SeasonalContent;

// Last content loaded this session; null until loadSeasonalContent succeeds.
let memoryContent: SeasonalContent | null = null;
// In-flight picks requests per collection and platform filter (see fetchCollectionPicks).
const inFlightPicks = new Map<string, Promise<CollectionPicks>>();
// Tail of the picks-cache write queue (see storePicks).
let picksWriteQueue: Promise<void> = Promise.resolve();

/** Clear module state between tests. */
export function __resetSeasonalServiceForTests(): void {
  memoryContent = null;
  inFlightPicks.clear();
  picksWriteQueue = Promise.resolve();
}

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

function isValidCollection(x: unknown): boolean {
  return isObject(x) && typeof x.id === 'string' && isObject(x.params);
}

function isValidSeason(x: unknown): boolean {
  if (!isObject(x)) return false;
  if (typeof x.id !== 'string' || typeof x.starts !== 'string' || typeof x.ends !== 'string') return false;
  const palette = x.palette;
  if (!isObject(palette)) return false;
  if (!Array.isArray(palette.bg_gradient) || palette.bg_gradient.length !== GRADIENT_STOPS) return false;
  return Array.isArray(x.collections) && x.collections.every(isValidCollection);
}

/**
 * Shape check for a payload from the network or from storage. All-or-nothing:
 * one malformed season rejects the whole payload, so a half-bad calendar never
 * renders a half-themed app.
 */
export function isValidContent(x: unknown): x is SeasonalContent {
  return isObject(x) && x.schema_version === 1 && Array.isArray(x.seasons) && x.seasons.every(isValidSeason);
}

async function readCache(): Promise<{ content: SeasonalContent; fetchedAt: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(SEASONAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isObject(parsed) || typeof parsed.fetchedAt !== 'number' || !isValidContent(parsed.content)) return null;
    return { content: parsed.content, fetchedAt: parsed.fetchedAt };
  } catch {
    return null;
  }
}

/**
 * The seasonal calendar to render. Uses the cache while it is younger than
 * REFRESH_MS, otherwise refetches. A failed or invalid fetch falls back to a
 * valid cache, then to the bundled copy. Never throws.
 */
export async function loadSeasonalContent({ now = Date.now() }: { now?: number } = {}): Promise<SeasonalContent> {
  const cache = await readCache();
  const age = cache ? now - cache.fetchedAt : Infinity;
  // A negative age (device clock moved back) is treated as stale.
  if (cache && age >= 0 && age < REFRESH_MS) {
    memoryContent = cache.content;
    return cache.content;
  }

  try {
    const fetched: unknown = await api.getSeasonal();
    if (isValidContent(fetched)) {
      memoryContent = fetched;
      try {
        await AsyncStorage.setItem(SEASONAL_CACHE_KEY, JSON.stringify({ content: fetched, fetchedAt: now }));
      } catch {
        // A failed write must not discard a successful fetch.
      }
      return fetched;
    }
  } catch {
    // Offline or server error: fall through to cache / bundled.
  }

  if (cache) {
    memoryContent = cache.content;
    return cache.content;
  }
  return BUNDLED;
}

/**
 * Synchronous read for cold start: the last content loaded this session, else
 * the bundled copy. Never touches AsyncStorage.
 */
export function getCachedSeasonalContentSync(): SeasonalContent {
  return memoryContent ?? BUNDLED;
}

// Dates are 'YYYY-MM-DD', so lexicographic comparison is chronological.
const inWindow = (date: string, starts: string, ends: string) => date >= starts && date <= ends;

/** The season whose inclusive window contains `date`, or null (e.g. between seasons). */
export function activeSeason(content: SeasonalContent, date: string = localDateString()): Season | null {
  return content.seasons.find((s) => inWindow(date, s.starts, s.ends)) ?? null;
}

/**
 * Collections to show for `date`: micro-moment collections whose window
 * contains the date first, then the season's un-windowed collections, capped
 * at two.
 */
export function visibleCollections(season: Season | null, date: string = localDateString()): Collection[] {
  if (!season) return [];
  const windowed = season.collections.filter((c) => c.starts && c.ends && inWindow(date, c.starts, c.ends));
  const evergreen = season.collections.filter((c) => !c.starts && !c.ends);
  return [...windowed, ...evergreen].slice(0, MAX_VISIBLE_COLLECTIONS);
}

/**
 * Cache identity of a platform filter: sorted and comma-joined, so the same
 * platforms in any order share picks; no filter is its own key, 'all'. Mirrors
 * the platform_filter analytics param in RecommendationContext.
 */
export const platformFilterKey = (platforms?: string[] | null): string =>
  platforms?.length ? [...platforms].sort().join(',') : 'all';

const picksKey = (collectionId: string, date: string, platformFilter: string) =>
  `${collectionId}|${date}|${platformFilter}`;

async function readPicksCache(): Promise<Record<string, CollectionPicks>> {
  try {
    const raw = await AsyncStorage.getItem(COLLECTION_PICKS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return isObject(parsed) ? (parsed as Record<string, CollectionPicks>) : {};
  } catch {
    return {};
  }
}

/**
 * Add one entry to the shared picks map. Writes are serialized through a
 * promise chain with the read inside the queued step: two collections often
 * resolve together, and an unqueued read-modify-write would let the second
 * writer's stale read overwrite the first writer's entry. Only today's entries
 * are kept so the stored map cannot grow without bound. Rejects if the storage
 * write fails; the queue itself keeps running.
 */
function storePicks(picks: CollectionPicks): Promise<void> {
  const step = picksWriteQueue.then(async () => {
    const entries = Object.entries(await readPicksCache()).filter(([, p]) => p?.date === picks.date);
    const key = picksKey(picks.collectionId, picks.date, picks.platformFilter);
    const next = { ...Object.fromEntries(entries), [key]: picks };
    await AsyncStorage.setItem(COLLECTION_PICKS_KEY, JSON.stringify(next));
  });
  picksWriteQueue = step.catch(() => {});
  return step;
}

/**
 * Cached picks for this collection, platform filter and `date`, or null when
 * missing, stale, empty, or unreadable. Picks fetched for other platforms
 * never match.
 */
export async function getCachedCollectionPicks(
  collectionId: string,
  { platforms = [], date = localDateString() }: { platforms?: string[]; date?: string } = {},
): Promise<CollectionPicks | null> {
  const platformFilter = platformFilterKey(platforms);
  const entry = (await readPicksCache())[picksKey(collectionId, date, platformFilter)];
  if (!entry || entry.date !== date || entry.collectionId !== collectionId) return null;
  if (entry.platformFilter !== platformFilter) return null;
  if (!Array.isArray(entry.games) || entry.games.length === 0) return null;
  return entry;
}

/**
 * Today's picks for a seasonal collection under the user's platform filter,
 * fetched and cached on the first call of the day for that filter. Concurrent
 * callers for the same collection and filter share one request.
 * Throws on API failure; the card shows its error state.
 *
 * The single-flight guard wraps the ENTIRE body, including the cache check:
 * two callers can both be mid-await on that check before either registers
 * its request, which would otherwise let both through to the API.
 */
export async function fetchCollectionPicks(
  collection: Collection,
  { platforms = [] }: { platforms?: string[] } = {},
): Promise<CollectionPicks> {
  const platformFilter = platformFilterKey(platforms);
  const flightKey = `${collection.id}|${platformFilter}`;
  const existing = inFlightPicks.get(flightKey);
  if (existing) return existing;

  const request = (async (): Promise<CollectionPicks> => {
    const date = localDateString();
    const cached = await getCachedCollectionPicks(collection.id, { platforms, date });
    if (cached) return cached;

    const response = await api.getRecommendations({
      ...collection.params,
      genres: collection.params.genres?.length ? collection.params.genres : null,
      platforms: platforms.length ? platforms : null,
      session_id: `local-seasonal-${Date.now()}`,
      excluded_game_ids: [],
    });
    const picks: CollectionPicks = {
      date,
      collectionId: collection.id,
      platformFilter,
      sessionId: response.session_id,
      games: response.recommendations,
      fallbackApplied: Boolean(response.fallback_applied),
      fallbackMessage: response.fallback_message ?? null,
    };
    if (picks.games.length > 0) {
      try {
        await storePicks(picks);
      } catch {
        // A failed storage write must not discard a successful fetch; the next call refetches.
      }
    }
    return picks;
  })();

  inFlightPicks.set(flightKey, request);
  try {
    return await request;
  } finally {
    inFlightPicks.delete(flightKey);
  }
}
