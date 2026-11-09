/**
 * Regression for 2026-11-09: covers came only from a live RAWG search by
 * title. RAWG has been unreachable since about 2026-11-06, so every card
 * waited ~20s for the request to fail and then showed a placeholder. The
 * catalog now stores cover_url; it must win without any network call, and a
 * hung RAWG request must give up quickly.
 */

const COVER = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1145360/header.jpg';

const load = () => {
  let mod;
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({ expoConfig: { extra: { rawgApiKey: 'test-key' } } }));
    mod = require('../gameImages');
  });
  return mod;
};

describe('getGameImage', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('uses the catalog cover_url without calling RAWG', async () => {
    const { getGameImage } = load();
    const result = await getGameImage('hades', 'Hades', COVER);
    expect(result.imageUrl).toBe(COVER);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to RAWG when there is no cover_url', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ background_image: 'https://media.rawg.io/x.jpg' }] }),
    });
    const { getGameImage } = load();
    const result = await getGameImage('celeste', 'Celeste');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.imageUrl).toBe('https://media.rawg.io/x.jpg');
  });

  it('gives up on a hung RAWG request and returns the placeholder', async () => {
    jest.useFakeTimers();
    // Never settles unless aborted, like a request to an unreachable origin.
    global.fetch.mockImplementation(
      (_url, opts) =>
        new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    const { getGameImage, RAWG_TIMEOUT_MS } = load();
    expect(RAWG_TIMEOUT_MS).toBeLessThanOrEqual(10000);
    const pending = getGameImage('celeste', 'Celeste');
    await jest.advanceTimersByTimeAsync(RAWG_TIMEOUT_MS);
    const result = await pending;
    expect(global.fetch.mock.calls[0][1]?.signal).toBeDefined();
    expect(result.imageUrl).toBeNull();
    expect(result.fallbackColors).toHaveLength(2);
    jest.useRealTimers();
  });
});
