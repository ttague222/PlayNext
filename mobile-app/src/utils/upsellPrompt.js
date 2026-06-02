import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export const UPSELL_LAST_SHOWN_KEY = '@playnxt_worked_upsell_last_shown';
export const COOLDOWN_DAYS = 14;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Gentle upsell after a "this worked for me" signal:
 * - Never shown to premium users.
 * - Shown at most once per COOLDOWN_DAYS.
 */
export function shouldShowWorkedUpsell({ isPremium, lastShownAt, now }) {
  if (isPremium) return false;
  if (!lastShownAt) return true;
  return now - lastShownAt >= COOLDOWN_DAYS * ONE_DAY_MS;
}

/**
 * Side-effecting entry point used by ResultsScreen.
 * Reads/writes AsyncStorage and shows the native Alert.
 * Returns `true` if the alert was shown, `false` otherwise.
 *
 * Fire-and-forget at call sites: never throws, never blocks the caller.
 */
export async function maybeShowWorkedUpsell({ isPremium, navigation }) {
  try {
    const last = await AsyncStorage.getItem(UPSELL_LAST_SHOWN_KEY);
    const lastShownAt = last ? Number(last) : null;
    if (!shouldShowWorkedUpsell({ isPremium, lastShownAt, now: Date.now() })) {
      return false;
    }
    await AsyncStorage.setItem(UPSELL_LAST_SHOWN_KEY, String(Date.now()));
    Alert.alert(
      'Want sharper picks?',
      "Save what works and let recommendations learn from your history. Tap below to see how.",
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'See how', onPress: () => navigation.navigate('Premium', { source: 'worked_signal' }) },
      ],
    );
    return true;
  } catch (e) {
    return false;
  }
}
