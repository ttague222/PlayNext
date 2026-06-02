import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { registerForPushNotifications } from '../services/notificationService';

export const PUSH_PROMPT_SEEN_KEY = '@playnxt_push_prompt_seen';

/**
 * Whether to show the soft pre-prompt: only once, only after the first accept.
 */
export function shouldShowPushPrompt({ promptSeen, hasAccepted }) {
  return !promptSeen && !!hasAccepted;
}

/**
 * Side-effecting entry point called after the first accepted recommendation.
 * Reads/writes AsyncStorage and shows the native Alert.
 * Returns `true` if the alert was shown, `false` otherwise.
 *
 * Fire-and-forget at call sites: never throws, never blocks the accept flow.
 */
export async function maybePromptForPush() {
  try {
    const promptSeen = (await AsyncStorage.getItem(PUSH_PROMPT_SEEN_KEY)) === 'true';
    if (!shouldShowPushPrompt({ promptSeen, hasAccepted: true })) {
      return false;
    }
    // Record SEEN before showing the alert so "Not now" still records and
    // we never reprompt — even if the alert closure callback never fires.
    await AsyncStorage.setItem(PUSH_PROMPT_SEEN_KEY, 'true');
    Alert.alert(
      'Stay in the loop?',
      "Want a heads-up when we add games you'd like? About once a week, never spammy.",
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Enable', onPress: () => registerForPushNotifications() },
      ],
    );
    return true;
  } catch (e) {
    return false;
  }
}
