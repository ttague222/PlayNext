import AsyncStorage from '@react-native-async-storage/async-storage';
import { logEvent } from '../services/analyticsService';

export const REVIEW_LAST_PROMPT_KEY = '@playnxt_review_last_prompt';
export const REVIEW_PROMPT_COUNT_KEY = '@playnxt_review_prompt_count';
export const COOLDOWN_DAYS = 60;
// iOS grants at most 3 system review prompts per app per 365 days — never ask
// for more than that lifetime here so every ask lands at a happy moment.
export const MAX_LIFETIME_PROMPTS = 3;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure decision logic for the store review prompt:
 * - Never when another prompt (upsell, push pre-prompt) was just shown.
 * - At most MAX_LIFETIME_PROMPTS ever, at most once per COOLDOWN_DAYS.
 */
export function shouldRequestReview({ lastPromptAt, promptCount, otherPromptShown, now }) {
  if (otherPromptShown) return false;
  if ((promptCount || 0) >= MAX_LIFETIME_PROMPTS) return false;
  if (lastPromptAt && now - lastPromptAt < COOLDOWN_DAYS * ONE_DAY_MS) return false;
  return true;
}

/**
 * Side-effecting entry point. Call only after a positive signal
 * ("this worked for me", "loved it") — never after an ad or an error.
 *
 * Fire-and-forget at call sites: never throws, never blocks the caller.
 * Returns `true` if the system review dialog was requested.
 */
export async function maybeRequestReview({ otherPromptShown = false, trigger = 'unknown' } = {}) {
  try {
    const [last, count] = await Promise.all([
      AsyncStorage.getItem(REVIEW_LAST_PROMPT_KEY),
      AsyncStorage.getItem(REVIEW_PROMPT_COUNT_KEY),
    ]);
    const lastPromptAt = last ? Number(last) : null;
    const promptCount = count ? Number(count) : 0;

    if (!shouldRequestReview({ lastPromptAt, promptCount, otherPromptShown, now: Date.now() })) {
      return false;
    }

    // Lazy require so web/tests don't need the native module
    const StoreReview = require('expo-store-review');
    if (!(await StoreReview.isAvailableAsync())) {
      return false;
    }

    // Record before requesting: the OS may silently swallow the request and
    // we still want the cooldown to apply.
    await Promise.all([
      AsyncStorage.setItem(REVIEW_LAST_PROMPT_KEY, String(Date.now())),
      AsyncStorage.setItem(REVIEW_PROMPT_COUNT_KEY, String(promptCount + 1)),
    ]);

    await StoreReview.requestReview();
    logEvent('review_prompt_requested', { trigger });
    return true;
  } catch (e) {
    return false;
  }
}
