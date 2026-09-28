import { Alert } from 'react-native';

jest.mock('../../services/tonightService', () => ({
  shouldOfferReminder: jest.fn(),
  markReminderPromptShown: jest.fn(() => Promise.resolve()),
  setReminder: jest.fn(() => Promise.resolve({ enabled: true, time: '20:00' })),
  DEFAULT_REMINDER_TIME: '20:00',
}));
jest.mock('../../services/analyticsService', () => ({ logEvent: jest.fn() }));

import { shouldOfferReminder, markReminderPromptShown, setReminder } from '../../services/tonightService';
import { logEvent } from '../../services/analyticsService';
import { maybeOfferTonightReminder } from '../tonightReminderPrompt';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

it('does nothing when the gate says no', async () => {
  shouldOfferReminder.mockResolvedValue(false);
  expect(await maybeOfferTonightReminder()).toBe(false);
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(markReminderPromptShown).not.toHaveBeenCalled();
});

it('marks shown BEFORE presenting, then shows the alert', async () => {
  shouldOfferReminder.mockResolvedValue(true);
  expect(await maybeOfferTonightReminder()).toBe(true);
  expect(markReminderPromptShown).toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledTimes(1);
});

it('accept button enables the reminder and logs both events', async () => {
  shouldOfferReminder.mockResolvedValue(true);
  await maybeOfferTonightReminder();
  const buttons = Alert.alert.mock.calls[0][2];
  const accept = buttons.find((b) => b.text !== 'Not now');
  await accept.onPress();
  expect(setReminder).toHaveBeenCalledWith(true, '20:00');
  expect(logEvent).toHaveBeenCalledWith('tonight_reminder_prompt', { accepted: true });
  expect(logEvent).toHaveBeenCalledWith('tonight_reminder_set', { enabled: true });
});

it('decline logs the prompt event only', async () => {
  shouldOfferReminder.mockResolvedValue(true);
  await maybeOfferTonightReminder();
  const decline = Alert.alert.mock.calls[0][2].find((b) => b.text === 'Not now');
  decline.onPress();
  expect(logEvent).toHaveBeenCalledWith('tonight_reminder_prompt', { accepted: false });
  expect(setReminder).not.toHaveBeenCalled();
});
