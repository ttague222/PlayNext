/**
 * seasonalService unit tests.
 * Per-file STATEFUL AsyncStorage mock (as tonightService.test.js), declared
 * before importing the service. Time is injected, never slept.
 */
const store = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((k, v) => { store[k] = v; return Promise.resolve(); }),
  getItem: jest.fn((k) => Promise.resolve(store[k] ?? null)),
  removeItem: jest.fn((k) => { delete store[k]; return Promise.resolve(); }),
}));
jest.mock('../api', () => ({
  __esModule: true,
  default: { getSeasonal: jest.fn(), getRecommendations: jest.fn() },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import {
  SEASONAL_CACHE_KEY,
  COLLECTION_PICKS_KEY,
  REFRESH_MS,
  isValidContent,
  loadSeasonalContent,
  getCachedSeasonalContentSync,
  activeSeason,
  visibleCollections,
  fetchCollectionPicks,
  getCachedCollectionPicks,
  platformFilterKey,
  __resetSeasonalServiceForTests,
} from '../seasonalService';
import { localDateString } from '../tonightService';

const fallback = require('../../config/seasonal.fallback.json');

const palette = {
  bg_gradient: ['#000000', '#111111', '#222222'],
  bg_decor: '#333333',
  accent_season: '#444444',
  on_accent_season: '#555555',
};
const makeSeason = (id, starts, ends, collections = []) => ({
  id, name: id, starts, ends, palette, collections,
});
const makeCollection = (id, extra = {}) => ({
  id,
  title: id,
  blurb: `${id} blurb`,
  params: { time_available: 60, energy_mood: 'casual', session_type: 'any', discovery_mode: 'familiar' },
  ...extra,
});
const makeContent = (seasons) => ({ schema_version: 1, seasons });

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  jest.clearAllMocks();
  __resetSeasonalServiceForTests();
});

describe('isValidContent', () => {
  it('accepts the bundled fallback', () => {
    expect(isValidContent(fallback)).toBe(true);
  });

  it('rejects non-objects, wrong schema_version and non-array seasons', () => {
    expect(isValidContent(null)).toBe(false);
    expect(isValidContent('x')).toBe(false);
    expect(isValidContent({ schema_version: 2, seasons: [] })).toBe(false);
    expect(isValidContent({ schema_version: 1, seasons: 'nope' })).toBe(false);
  });

  it('rejects the whole payload when any season is malformed', () => {
    const good = makeSeason('a', '2026-11-01', '2026-11-30');
    const noPalette = { ...makeSeason('b', '2026-12-01', '2026-12-31') };
    delete noPalette.palette;
    expect(isValidContent(makeContent([good, noPalette]))).toBe(false);
    const shortGradient = { ...good, palette: { ...palette, bg_gradient: ['#000000', '#111111'] } };
    expect(isValidContent(makeContent([shortGradient]))).toBe(false);
    expect(isValidContent(makeContent([{ ...good, collections: 'x' }]))).toBe(false);
    expect(isValidContent(makeContent([{ ...good, starts: undefined }]))).toBe(false);
  });
});

describe('activeSeason (bundled calendar)', () => {
  const byDate = (d) => activeSeason(fallback, d)?.id ?? null;

  it('picks harvest across its whole window', () => {
    expect(byDate('2026-11-01')).toBe('harvest-2026');
    expect(byDate('2026-11-30')).toBe('harvest-2026');
  });

  it('is null in the gap (no Spooky 2026)', () => {
    expect(byDate('2026-10-31')).toBeNull();
  });

  it('crosses the year boundary into winter holidays', () => {
    expect(byDate('2026-12-31')).toBe('winter-holidays-2026');
    expect(byDate('2027-01-01')).toBe('winter-holidays-2026');
  });

  it('moves on to deep winter', () => {
    expect(byDate('2027-01-08')).toBe('deep-winter-2027');
  });

  it('defaults the date to the local date', () => {
    const content = makeContent([makeSeason('today', localDateString(), localDateString())]);
    expect(activeSeason(content)?.id).toBe('today');
  });
});

describe('activeSeason selection re-runs on the date, not on cache age', () => {
  it('a cache fetched during Spooky yields harvest on 2026-11-02', async () => {
    const spooky = makeSeason('spooky-2026', '2026-10-01', '2026-10-31');
    const harvest = makeSeason('harvest-2026', '2026-11-01', '2026-11-30');
    const cached = makeContent([spooky, harvest]);
    store[SEASONAL_CACHE_KEY] = JSON.stringify({ content: cached, fetchedAt: Date.parse('2026-10-15T12:00:00Z') });
    api.getSeasonal.mockRejectedValue(new Error('offline'));

    const content = await loadSeasonalContent({ now: Date.parse('2026-11-02T12:00:00Z') });
    expect(activeSeason(content, '2026-10-15')?.id).toBe('spooky-2026');
    expect(activeSeason(content, '2026-11-02')?.id).toBe('harvest-2026');
  });
});

describe('visibleCollections', () => {
  const winter = fallback.seasons.find((s) => s.id === 'deep-winter-2027');
  const valentines = 'deep-winter-2027-valentines';

  it('puts the one-day micro-moment first on its day, capped at 2', () => {
    const list = visibleCollections(winter, '2027-02-14');
    expect(list.length).toBeLessThanOrEqual(2);
    expect(list[0].id).toBe(valentines);
  });

  it('excludes it the day before', () => {
    const ids = visibleCollections(winter, '2027-02-13').map((c) => c.id);
    expect(ids).not.toContain(valentines);
  });

  it('treats window bounds as inclusive and skips windows that ended', () => {
    const season = makeSeason('s', '2026-01-01', '2026-12-31', [
      makeCollection('plain'),
      makeCollection('window', { starts: '2026-05-10', ends: '2026-05-12' }),
    ]);
    expect(visibleCollections(season, '2026-05-10').map((c) => c.id)).toEqual(['window', 'plain']);
    expect(visibleCollections(season, '2026-05-12').map((c) => c.id)).toEqual(['window', 'plain']);
    expect(visibleCollections(season, '2026-05-13').map((c) => c.id)).toEqual(['plain']);
    expect(visibleCollections(season, '2026-05-09').map((c) => c.id)).toEqual(['plain']);
  });

  it('slices to 2 and tolerates a null season', () => {
    const season = makeSeason('s', '2026-01-01', '2026-12-31', [
      makeCollection('a'), makeCollection('b'), makeCollection('c'),
    ]);
    expect(visibleCollections(season, '2026-02-01').map((c) => c.id)).toEqual(['a', 'b']);
    expect(visibleCollections(null, '2026-02-01')).toEqual([]);
  });
});

describe('loadSeasonalContent', () => {
  const NOW = Date.parse('2026-11-02T12:00:00Z');
  const fresh = makeContent([makeSeason('fresh', '2026-11-01', '2026-11-30')]);
  const cachedContent = makeContent([makeSeason('cached', '2026-11-01', '2026-11-30')]);

  it('falls back to the bundled content when fetch fails and nothing is cached', async () => {
    api.getSeasonal.mockRejectedValue(new Error('offline'));
    expect(await loadSeasonalContent({ now: NOW })).toEqual(fallback);
  });

  it('uses a valid cache when the payload has the wrong schema_version', async () => {
    store[SEASONAL_CACHE_KEY] = JSON.stringify({ content: cachedContent, fetchedAt: NOW - REFRESH_MS - 1 });
    api.getSeasonal.mockResolvedValue({ schema_version: 2 });
    expect(await loadSeasonalContent({ now: NOW })).toEqual(cachedContent);
  });

  it('falls back to bundled when a season is missing palette and there is no cache', async () => {
    const broken = makeContent([makeSeason('x', '2026-11-01', '2026-11-30')]);
    delete broken.seasons[0].palette;
    api.getSeasonal.mockResolvedValue(broken);
    expect(await loadSeasonalContent({ now: NOW })).toEqual(fallback);
  });

  it('fetches, returns and caches a valid payload', async () => {
    api.getSeasonal.mockResolvedValue(fresh);
    expect(await loadSeasonalContent({ now: NOW })).toEqual(fresh);
    expect(JSON.parse(store[SEASONAL_CACHE_KEY])).toEqual({ content: fresh, fetchedAt: NOW });
    expect(getCachedSeasonalContentSync()).toEqual(fresh);
  });

  it('does not refetch while the cache is younger than REFRESH_MS', async () => {
    store[SEASONAL_CACHE_KEY] = JSON.stringify({ content: cachedContent, fetchedAt: NOW - REFRESH_MS + 1000 });
    expect(await loadSeasonalContent({ now: NOW })).toEqual(cachedContent);
    expect(api.getSeasonal).not.toHaveBeenCalled();
  });

  it('refetches once the cache is REFRESH_MS old', async () => {
    store[SEASONAL_CACHE_KEY] = JSON.stringify({ content: cachedContent, fetchedAt: NOW - REFRESH_MS });
    api.getSeasonal.mockResolvedValue(fresh);
    expect(await loadSeasonalContent({ now: NOW })).toEqual(fresh);
    expect(api.getSeasonal).toHaveBeenCalledTimes(1);
  });

  it('ignores a corrupt or invalid cache and never throws', async () => {
    store[SEASONAL_CACHE_KEY] = '{broken';
    api.getSeasonal.mockRejectedValue(new Error('offline'));
    expect(await loadSeasonalContent({ now: NOW })).toEqual(fallback);
    store[SEASONAL_CACHE_KEY] = JSON.stringify({ content: { schema_version: 2 }, fetchedAt: NOW });
    expect(await loadSeasonalContent({ now: NOW })).toEqual(fallback);
  });

  it('returns fetched content even when the cache write fails', async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('disk full'));
    api.getSeasonal.mockResolvedValue(fresh);
    expect(await loadSeasonalContent({ now: NOW })).toEqual(fresh);
  });
});

describe('getCachedSeasonalContentSync', () => {
  it('returns the bundled content before anything is loaded, without touching storage', () => {
    expect(getCachedSeasonalContentSync()).toEqual(fallback);
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it('hydrates from a valid AsyncStorage cache when the fetch fails', async () => {
    const cachedContent = makeContent([makeSeason('cached', '2026-11-01', '2026-11-30')]);
    store[SEASONAL_CACHE_KEY] = JSON.stringify({ content: cachedContent, fetchedAt: 0 });
    api.getSeasonal.mockRejectedValue(new Error('offline'));
    await loadSeasonalContent({ now: REFRESH_MS * 10 });
    expect(getCachedSeasonalContentSync()).toEqual(cachedContent);
  });
});

describe('collection picks', () => {
  const collectionA = makeCollection('col-a', {
    params: { time_available: 45, energy_mood: 'wind_down', genres: ['puzzle'], session_type: 'solo', discovery_mode: 'surprise' },
  });
  const collectionB = makeCollection('col-b');
  const response = {
    session_id: 'srv-1',
    recommendations: [{ game_id: 'celeste', title: 'Celeste' }],
    fallback_applied: true,
    fallback_message: 'We widened the search',
  };
  const today = localDateString();

  it('sends collection params plus platforms and maps the response', async () => {
    api.getRecommendations.mockResolvedValue(response);
    const result = await fetchCollectionPicks(collectionA, { platforms: ['pc'] });

    expect(api.getRecommendations).toHaveBeenCalledTimes(1);
    expect(api.getRecommendations).toHaveBeenCalledWith(expect.objectContaining({
      time_available: 45,
      energy_mood: 'wind_down',
      genres: ['puzzle'],
      session_type: 'solo',
      discovery_mode: 'surprise',
      platforms: ['pc'],
      excluded_game_ids: [],
      session_id: expect.stringMatching(/^local-seasonal-\d+$/),
    }));
    expect(result).toEqual({
      date: today,
      collectionId: 'col-a',
      platformFilter: 'pc',
      sessionId: 'srv-1',
      games: response.recommendations,
      fallbackApplied: true,
      fallbackMessage: 'We widened the search',
    });
  });

  it('sends platforms null when empty or omitted', async () => {
    api.getRecommendations.mockResolvedValue(response);
    await fetchCollectionPicks(collectionA, { platforms: [] });
    expect(api.getRecommendations.mock.calls[0][0].platforms).toBeNull();
    await fetchCollectionPicks(collectionB);
    expect(api.getRecommendations.mock.calls[1][0].platforms).toBeNull();
  });

  it('defaults optional fields: genres null, fallbackMessage null', async () => {
    api.getRecommendations.mockResolvedValue({ session_id: 's', recommendations: [{ game_id: 'x' }] });
    const result = await fetchCollectionPicks(collectionB, { platforms: [] });
    expect(api.getRecommendations.mock.calls[0][0].genres).toBeNull();
    expect(result.fallbackApplied).toBe(false);
    expect(result.fallbackMessage).toBeNull();
  });

  it('single-flights concurrent calls for the same collection', async () => {
    let resolve;
    api.getRecommendations.mockReturnValue(new Promise((r) => { resolve = r; }));
    const p1 = fetchCollectionPicks(collectionA, { platforms: [] });
    const p2 = fetchCollectionPicks(collectionA, { platforms: [] });
    resolve(response);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(api.getRecommendations).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });

  it('does not share the in-flight request across different collections', async () => {
    api.getRecommendations.mockResolvedValue(response);
    await Promise.all([
      fetchCollectionPicks(collectionA, { platforms: [] }),
      fetchCollectionPicks(collectionB, { platforms: [] }),
    ]);
    expect(api.getRecommendations).toHaveBeenCalledTimes(2);
  });

  it('keeps both entries when two collections resolve together', async () => {
    api.getRecommendations.mockImplementation(async (p) => ({ ...response, session_id: `srv-${p.time_available}` }));
    const [a, b] = await Promise.all([
      fetchCollectionPicks(collectionA, { platforms: [] }),
      fetchCollectionPicks(collectionB, { platforms: [] }),
    ]);
    expect(await getCachedCollectionPicks('col-a')).toEqual(a);
    expect(await getCachedCollectionPicks('col-b')).toEqual(b);
  });

  it('serves a same-day repeat from cache without refetching', async () => {
    api.getRecommendations.mockResolvedValue(response);
    const first = await fetchCollectionPicks(collectionA, { platforms: [] });
    const second = await fetchCollectionPicks(collectionA, { platforms: [] });
    expect(api.getRecommendations).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(await getCachedCollectionPicks('col-a')).toEqual(first);
  });

  it('does not return a cached result for another date', async () => {
    store[COLLECTION_PICKS_KEY] = JSON.stringify({
      'col-a|2020-01-01|all': { date: '2020-01-01', collectionId: 'col-a', platformFilter: 'all', sessionId: 'old', games: [{ game_id: 'old' }], fallbackApplied: false, fallbackMessage: null },
    });
    expect(await getCachedCollectionPicks('col-a', { date: '2020-01-02' })).toBeNull();
    expect((await getCachedCollectionPicks('col-a', { date: '2020-01-01' })).sessionId).toBe('old');

    api.getRecommendations.mockResolvedValue(response);
    const result = await fetchCollectionPicks(collectionA, { platforms: [] });
    expect(api.getRecommendations).toHaveBeenCalledTimes(1);
    expect(result.sessionId).toBe('srv-1');
  });

  it('does not return collection A picks for collection B', async () => {
    api.getRecommendations.mockResolvedValue(response);
    await fetchCollectionPicks(collectionA, { platforms: [] });
    expect(await getCachedCollectionPicks('col-b')).toBeNull();
    api.getRecommendations.mockResolvedValue({ ...response, session_id: 'srv-b' });
    const b = await fetchCollectionPicks(collectionB, { platforms: [] });
    expect(b.sessionId).toBe('srv-b');
    expect(api.getRecommendations).toHaveBeenCalledTimes(2);
  });

  it('prunes stale entries so the cache stays small', async () => {
    store[COLLECTION_PICKS_KEY] = JSON.stringify({
      'col-a|2020-01-01|all': { date: '2020-01-01', collectionId: 'col-a', platformFilter: 'all', sessionId: 'old', games: [{ game_id: 'old' }], fallbackApplied: false, fallbackMessage: null },
    });
    api.getRecommendations.mockResolvedValue(response);
    await fetchCollectionPicks(collectionA, { platforms: [] });
    const stored = JSON.parse(store[COLLECTION_PICKS_KEY]);
    expect(Object.keys(stored)).toEqual([`col-a|${today}|all`]);
  });

  it('returns the picks even when the cache write fails', async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('disk full'));
    api.getRecommendations.mockResolvedValue(response);
    const result = await fetchCollectionPicks(collectionA, { platforms: [] });
    expect(result.games).toEqual(response.recommendations);
  });

  it('does not cache empty results', async () => {
    api.getRecommendations.mockResolvedValue({ session_id: 's', recommendations: [] });
    await fetchCollectionPicks(collectionA, { platforms: [] });
    expect(await getCachedCollectionPicks('col-a')).toBeNull();
  });

  it('propagates API failure and clears the in-flight guard', async () => {
    api.getRecommendations.mockRejectedValueOnce(new Error('boom'));
    await expect(fetchCollectionPicks(collectionA, { platforms: [] })).rejects.toThrow('boom');
    api.getRecommendations.mockResolvedValueOnce(response);
    const retry = await fetchCollectionPicks(collectionA, { platforms: [] });
    expect(retry.sessionId).toBe('srv-1');
  });

  it('does not return picks cached for one platform filter to another', async () => {
    api.getRecommendations.mockResolvedValue({ ...response, session_id: 'srv-pc' });
    const pc = await fetchCollectionPicks(collectionA, { platforms: ['pc'] });
    expect(await getCachedCollectionPicks('col-a', { platforms: ['pc'] })).toEqual(pc);
    expect(await getCachedCollectionPicks('col-a', { platforms: ['switch'] })).toBeNull();
    expect(await getCachedCollectionPicks('col-a')).toBeNull();

    api.getRecommendations.mockResolvedValue({ ...response, session_id: 'srv-switch' });
    const sw = await fetchCollectionPicks(collectionA, { platforms: ['switch'] });
    expect(sw.sessionId).toBe('srv-switch');
    expect(api.getRecommendations).toHaveBeenCalledTimes(2);
    expect(api.getRecommendations.mock.calls[1][0].platforms).toEqual(['switch']);
  });

  it('treats the same platforms in any order as one filter', async () => {
    api.getRecommendations.mockResolvedValue(response);
    const first = await fetchCollectionPicks(collectionA, { platforms: ['switch', 'pc'] });
    const second = await fetchCollectionPicks(collectionA, { platforms: ['pc', 'switch'] });
    expect(api.getRecommendations).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(first.platformFilter).toBe(platformFilterKey(['pc', 'switch']));
  });

  it('does not single-flight requests for different platform filters', async () => {
    let resolvePc;
    api.getRecommendations
      .mockReturnValueOnce(new Promise((r) => { resolvePc = r; }))
      .mockResolvedValueOnce({ ...response, session_id: 'srv-switch' });
    const pPc = fetchCollectionPicks(collectionA, { platforms: ['pc'] });
    const pSwitch = fetchCollectionPicks(collectionA, { platforms: ['switch'] });
    resolvePc({ ...response, session_id: 'srv-pc' });
    const [pc, sw] = await Promise.all([pPc, pSwitch]);
    expect(api.getRecommendations).toHaveBeenCalledTimes(2);
    expect(pc.sessionId).toBe('srv-pc');
    expect(sw.sessionId).toBe('srv-switch');
  });

  it('platformFilterKey sorts and joins, with a distinct key for no filter', () => {
    expect(platformFilterKey(['switch', 'pc'])).toBe('pc,switch');
    expect(platformFilterKey([])).toBe('all');
    expect(platformFilterKey(undefined)).toBe('all');
  });

  it('getCachedCollectionPicks tolerates corrupt storage', async () => {
    store[COLLECTION_PICKS_KEY] = '{broken';
    expect(await getCachedCollectionPicks('col-a')).toBeNull();
  });
});
