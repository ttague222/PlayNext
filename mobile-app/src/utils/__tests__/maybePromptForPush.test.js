/**
 * Integration tests for maybePromptForPush — the side-effecting wrapper around
 * shouldShowPushPrompt. Mocks AsyncStorage + Alert + notificationService so we
 * can prove the actual modal-firing behavior without rendering ResultsScreen.
 */

import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { maybePromptForPush, PUSH_PROMPT_SEEN_KEY } from '../pushPrompt';
import { registerForPushNotifications } from '../../services/notificationService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Stubs out the whole module so it does not try to import expo-notifications.
jest.mock('../../services/notificationService', () => ({
  registerForPushNotifications: jest.fn(),
}));

describe('maybePromptForPush', () => {
  let alertSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('shows the Alert when not previously seen', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    const result = await maybePromptForPush();

    expect(result).toBe(true);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, body, buttons] = alertSpy.mock.calls[0];
    expect(title).toBe('Stay in the loop?');
    expect(body).toContain('once a week');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].text).toBe('Not now');
    expect(buttons[0].style).toBe('cancel');
    expect(buttons[1].text).toBe('Enable');
  });

  it('records SEEN before showing the Alert (so cancel still counts as seen)', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    await maybePromptForPush();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(PUSH_PROMPT_SEEN_KEY, 'true');
  });

  it('"Enable" button calls registerForPushNotifications', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    await maybePromptForPush();

    const [, , buttons] = alertSpy.mock.calls[0];
    const enable = buttons.find((b) => b.text === 'Enable');
    enable.onPress();

    expect(registerForPushNotifications).toHaveBeenCalledTimes(1);
  });

  it('"Not now" button has no onPress that registers', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    await maybePromptForPush();

    const [, , buttons] = alertSpy.mock.calls[0];
    const notNow = buttons.find((b) => b.text === 'Not now');
    // Either no onPress or one that does not call register.
    if (notNow.onPress) notNow.onPress();
    expect(registerForPushNotifications).not.toHaveBeenCalled();
  });

  it('does NOT show again once SEEN flag is set', async () => {
    AsyncStorage.getItem.mockResolvedValue('true');

    const result = await maybePromptForPush();

    expect(result).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('is fire-and-forget: an AsyncStorage rejection does not throw', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('boom'));

    const result = await maybePromptForPush();

    expect(result).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
