/**
 * changelogService — decides whether the post-update changelog modal shows.
 * Rules (spec 2026-09-22): fresh installs never see it; it shows once per
 * version, only when a changelog entry exists for the running version.
 *
 * Fresh-install protection lives in App.js, not here: App.js stamps
 * LAST_SEEN_VERSION_KEY via markChangelogSeen when the welcome flow
 * completes, and only calls shouldShowChangelog after welcome has already
 * been seen. So at the service level, an empty stored key means the caller
 * upgraded from a version before this key existed (a pre-tracking
 * upgrader) — see the "no stored version" tests below.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  shouldShowChangelog,
  markChangelogSeen,
  LAST_SEEN_VERSION_KEY,
} from '../changelogService';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const ENTRIES = { '1.4.0': { title: 'Test', features: [] } };

beforeEach(() => AsyncStorage.clear());

describe('shouldShowChangelog', () => {
  it('no stored version with an entry: shows (pre-tracking upgrader)', async () => {
    const show = await shouldShowChangelog('1.4.0', ENTRIES);
    expect(show).toBe(true);
    // Not marked seen here — the dismiss/CTA handler owns that write.
    expect(await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY)).toBeNull();
  });

  it('no stored version without an entry: records, does not show', async () => {
    const show = await shouldShowChangelog('1.5.0', ENTRIES);
    expect(show).toBe(false);
    expect(await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe('1.5.0');
  });

  it('upgrade with an entry: shows', async () => {
    await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, '1.3.0');
    expect(await shouldShowChangelog('1.4.0', ENTRIES)).toBe(true);
  });

  it('same version: does not show', async () => {
    await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, '1.4.0');
    expect(await shouldShowChangelog('1.4.0', ENTRIES)).toBe(false);
  });

  it('upgrade without an entry: records version, does not show', async () => {
    await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, '1.3.0');
    expect(await shouldShowChangelog('1.5.0', ENTRIES)).toBe(false);
    expect(await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe('1.5.0');
  });

  it('missing version: does not show', async () => {
    expect(await shouldShowChangelog(undefined, ENTRIES)).toBe(false);
  });

  it('storage failure: does not show, does not throw', async () => {
    // Note: no spy.mockRestore() here — the underlying async-storage-mock
    // exposes getItem as a jest.fn() already, so jest.spyOn() returns that
    // same mock instead of wrapping it; calling mockRestore() on it wipes
    // its default implementation instead of restoring it (a known Jest
    // quirk: https://github.com/facebook/jest/issues/7136). The
    // mockRejectedValueOnce queue is single-use, so no cleanup is needed —
    // the next call naturally falls through to the real implementation.
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('boom'));
    expect(await shouldShowChangelog('1.4.0', ENTRIES)).toBe(false);
  });
});

describe('markChangelogSeen', () => {
  it('records the version', async () => {
    await markChangelogSeen('1.4.0');
    expect(await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe('1.4.0');
  });
});
