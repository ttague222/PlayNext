import { DAILY_REROLL_CAP, hasHitDailyRerollCap, rerollsRemainingToday } from '../rerollCap';

describe('hasHitDailyRerollCap', () => {
  it('returns false when under the cap', () => {
    expect(hasHitDailyRerollCap(0)).toBe(false);
    expect(hasHitDailyRerollCap(DAILY_REROLL_CAP - 1)).toBe(false);
  });

  it('returns true at exactly the cap', () => {
    expect(hasHitDailyRerollCap(DAILY_REROLL_CAP)).toBe(true);
  });

  it('returns true when over the cap', () => {
    expect(hasHitDailyRerollCap(DAILY_REROLL_CAP + 5)).toBe(true);
  });
});

describe('rerollsRemainingToday', () => {
  it('returns full cap when none used', () => {
    expect(rerollsRemainingToday(0)).toBe(DAILY_REROLL_CAP);
  });

  it('counts down correctly', () => {
    expect(rerollsRemainingToday(3)).toBe(DAILY_REROLL_CAP - 3);
  });

  it('never returns negative', () => {
    expect(rerollsRemainingToday(DAILY_REROLL_CAP + 10)).toBe(0);
  });
});
