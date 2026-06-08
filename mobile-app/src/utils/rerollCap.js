export const DAILY_REROLL_CAP = 10;

/** True when the user has used all their daily rerolls. */
export function hasHitDailyRerollCap(dailyRerollCount) {
  return dailyRerollCount >= DAILY_REROLL_CAP;
}

/** How many rerolls are left today (never negative). */
export function rerollsRemainingToday(dailyRerollCount) {
  return Math.max(0, DAILY_REROLL_CAP - dailyRerollCount);
}
