import { shouldShowPushPrompt } from '../pushPrompt';

describe('shouldShowPushPrompt', () => {
  it('shows on first accept when not seen', () => {
    expect(shouldShowPushPrompt({ promptSeen: false, hasAccepted: true })).toBe(true);
  });
  it('does not show before the first accept', () => {
    expect(shouldShowPushPrompt({ promptSeen: false, hasAccepted: false })).toBe(false);
  });
  it('does not show again once seen', () => {
    expect(shouldShowPushPrompt({ promptSeen: true, hasAccepted: true })).toBe(false);
  });
});
