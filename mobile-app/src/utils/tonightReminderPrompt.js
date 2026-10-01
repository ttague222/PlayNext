import { Alert } from 'react-native';
import {
  shouldOfferReminder,
  markReminderPromptShown,
  setReminder,
  DEFAULT_REMINDER_TIME,
} from '../services/tonightService';
import { logEvent } from '../services/analyticsService';

/**
 * One-time soft prompt for the nightly reminder, shown after the second
 * distinct day of viewing Tonight's Picks. Fire-and-forget at call sites:
 * never throws, never blocks navigation.
 */
export async function maybeOfferTonightReminder() {
  try {
    if (!(await shouldOfferReminder())) return false;
    // Record BEFORE showing so "Not now" (or a lost callback) never reprompts.
    await markReminderPromptShown();
    Alert.alert(
      'Nightly nudge?',
      "Want a reminder when tonight's picks are ready? One quiet notification around 8pm. You can change the time in Profile.",
      [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => logEvent('tonight_reminder_prompt', { accepted: false }),
        },
        {
          text: 'Remind me',
          onPress: async () => {
            logEvent('tonight_reminder_prompt', { accepted: true });
            const result = await setReminder(true, DEFAULT_REMINDER_TIME);
            logEvent('tonight_reminder_set', { enabled: !!result.enabled });
          },
        },
      ],
    );
    return true;
  } catch {
    return false;
  }
}
