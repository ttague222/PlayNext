import { shouldShowWorkedUpsell, COOLDOWN_DAYS } from '../upsellPrompt';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe('shouldShowWorkedUpsell', () => {
  it('shows when not premium and never shown', () => {
    expect(shouldShowWorkedUpsell({ isPremium: false, lastShownAt: null, now: Date.now() })).toBe(true);
  });
  it('does not show for premium users', () => {
    expect(shouldShowWorkedUpsell({ isPremium: true, lastShownAt: null, now: Date.now() })).toBe(false);
  });
  it('respects the cooldown', () => {
    const now = Date.now();
    expect(shouldShowWorkedUpsell({ isPremium: false, lastShownAt: now - (COOLDOWN_DAYS - 1) * ONE_DAY_MS, now })).toBe(false);
    expect(shouldShowWorkedUpsell({ isPremium: false, lastShownAt: now - (COOLDOWN_DAYS + 1) * ONE_DAY_MS, now })).toBe(true);
  });
});
