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
