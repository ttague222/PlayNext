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
 */
export const shouldShowChangelog = async (currentVersion, entries = CHANGELOG) => {
  if (!currentVersion) return false;
  try {
    const lastSeen = await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY);
    if (!lastSeen) {
      // Fresh install: nothing is "new" — record and stay quiet.
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
