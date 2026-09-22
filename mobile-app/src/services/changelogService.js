/**
 * Decides whether the post-update changelog modal shows (spec 2026-09-22).
 * Compares the stored last-seen app version to the running version.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHANGELOG } from '../config/changelog';

export const LAST_SEEN_VERSION_KEY = '@playnxt_last_seen_version';

export const markChangelogSeen = async (version) => {
  try {
    await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, version);
  } catch {
    // Non-fatal: worst case the modal shows again next launch.
  }
};

/**
 * @param {string} currentVersion - running app version (Constants.expoConfig.version)
 * @param {object} [entries] - changelog map (injectable for tests; defaults to CHANGELOG)
 * @returns {Promise<boolean>} whether to show the modal for currentVersion
 *
 * No stored key here does NOT mean a fresh install: App.js only calls this
 * after the welcome screen has already been seen, and it stamps
 * LAST_SEEN_VERSION_KEY itself when the welcome flow completes — so a
 * genuine fresh install never reaches this function with an empty key.
 * A missing key here means the user upgraded from a version before this
 * tracking key existed (pre-1.4.0). If there's an entry for currentVersion,
 * show it (don't mark seen — the dismiss/CTA handler owns that write, same
 * as any other upgrade path). If there's nothing to announce, record and
 * stay quiet, same as the "upgrade without an entry" case below.
 */
export const shouldShowChangelog = async (currentVersion, entries = CHANGELOG) => {
  if (!currentVersion) return false;
  try {
    const lastSeen = await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY);
    if (!lastSeen) {
      if (entries[currentVersion]) {
        // Pre-tracking upgrader: announce this version's entry.
        return true;
      }
      // Nothing to announce — record so future checks short-circuit.
      await markChangelogSeen(currentVersion);
      return false;
    }
    if (lastSeen === currentVersion) return false;
    if (!entries[currentVersion]) {
      // Updated, but nothing to announce for this version.
      await markChangelogSeen(currentVersion);
      return false;
    }
    return true;
  } catch {
    return false;
  }
};
