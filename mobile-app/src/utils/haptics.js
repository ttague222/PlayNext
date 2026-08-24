/**
 * PlayNxt Haptics
 *
 * Thin fail-safe wrapper around expo-haptics. Feedback is a nicety —
 * it must never throw or block on devices/simulators without support.
 */

import * as Haptics from 'expo-haptics';

/** Light tick for routine interactions (reroll, undo, chips). */
export const hapticLight = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Success notification for the big moment ("I'll play this!"). */
export const hapticSuccess = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

/** Selection tick for option picks inside modals. */
export const hapticSelect = () => {
  Haptics.selectionAsync().catch(() => {});
};
