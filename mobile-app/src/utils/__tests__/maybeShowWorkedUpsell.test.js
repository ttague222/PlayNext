/**
 * Integration tests for maybeShowWorkedUpsell — the side-effecting wrapper
 * around shouldShowWorkedUpsell. Mocks AsyncStorage + Alert so we can prove
 * the actual modal-firing behavior without rendering ResultsScreen.
 */

import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  maybeShowWorkedUpsell,
  UPSELL_LAST_SHOWN_KEY,
  COOLDOWN_DAYS,
} from '../upsellPrompt';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('maybeShowWorkedUpsell', () => {
  let alertSpy;
  let nowSpy;
  const FIXED_NOW = 1_700_000_000_000; // arbitrary fixed timestamp (ms)

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    nowSpy.mockRestore();
  });

  const fakeNav = () => ({ navigate: jest.fn() });

  it('shows the Alert for a non-premium user with no prior shown timestamp', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    const navigation = fakeNav();

    const result = await maybeShowWorkedUpsell({ isPremium: false, navigation });

    expect(result).toBe(true);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, body, buttons] = alertSpy.mock.calls[0];
    expect(title).toBe('Want sharper picks?');
    expect(body).toContain('learn from your history');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].text).toBe('Not now');
    expect(buttons[0].style).toBe('cancel');
    expect(buttons[1].text).toBe('See how');
  });

  it('records the shown timestamp BEFORE showing the alert (so a tap-through retry is cooldown-blocked)', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    const navigation = fakeNav();

    await maybeShowWorkedUpsell({ isPremium: false, navigation });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      UPSELL_LAST_SHOWN_KEY,
      String(FIXED_NOW),
    );
  });

  it('"See how" button navigates to Premium with source=worked_signal', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    const navigation = fakeNav();

    await maybeShowWorkedUpsell({ isPremium: false, navigation });

    const [, , buttons] = alertSpy.mock.calls[0];
    const seeHow = buttons.find((b) => b.text === 'See how');
    seeHow.onPress();

    expect(navigation.navigate).toHaveBeenCalledWith('Premium', { source: 'worked_signal' });
  });

  it('does NOT show for premium users', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    const navigation = fakeNav();

    const result = await maybeShowWorkedUpsell({ isPremium: true, navigation });

    expect(result).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('does NOT show while in cooldown', async () => {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const inCooldown = FIXED_NOW - (COOLDOWN_DAYS - 1) * ONE_DAY_MS;
    AsyncStorage.getItem.mockResolvedValue(String(inCooldown));
    const navigation = fakeNav();

    const result = await maybeShowWorkedUpsell({ isPremium: false, navigation });

    expect(result).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('does show once the cooldown window has elapsed', async () => {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const past = FIXED_NOW - (COOLDOWN_DAYS + 1) * ONE_DAY_MS;
    AsyncStorage.getItem.mockResolvedValue(String(past));
    const navigation = fakeNav();

    const result = await maybeShowWorkedUpsell({ isPremium: false, navigation });

    expect(result).toBe(true);
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('is fire-and-forget: a thrown AsyncStorage rejects without surfacing', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('boom'));
    const navigation = fakeNav();

    const result = await maybeShowWorkedUpsell({ isPremium: false, navigation });

    expect(result).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
