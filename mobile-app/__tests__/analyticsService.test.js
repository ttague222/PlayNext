/**
 * Analytics Service Tests
 *
 * The service must forward events to Firebase Analytics when available,
 * and silently no-op (never throw) when it is not.
 */

import * as firebaseAnalytics from '@react-native-firebase/analytics';
import {
  logEvent,
  logScreenView,
  setAnalyticsUserId,
  _resetForTesting,
} from '../src/services/analyticsService';

describe('analyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetForTesting();
  });

  it('forwards logEvent with name and params', () => {
    logEvent('rec_requested', { mood: 'casual', is_reroll: false });

    expect(firebaseAnalytics.logEvent).toHaveBeenCalledWith(
      expect.anything(),
      'rec_requested',
      { mood: 'casual', is_reroll: false }
    );
  });

  it('defaults params to an empty object', () => {
    logEvent('paywall_viewed');

    expect(firebaseAnalytics.logEvent).toHaveBeenCalledWith(
      expect.anything(),
      'paywall_viewed',
      {}
    );
  });

  it('logs screen views with screen_name and screen_class', () => {
    logScreenView('Results');

    expect(firebaseAnalytics.logScreenView).toHaveBeenCalledWith(
      expect.anything(),
      { screen_name: 'Results', screen_class: 'Results' }
    );
  });

  it('ignores empty screen names', () => {
    logScreenView(null);

    expect(firebaseAnalytics.logScreenView).not.toHaveBeenCalled();
  });

  it('sets and clears the analytics user id', () => {
    setAnalyticsUserId('user-123');
    expect(firebaseAnalytics.setUserId).toHaveBeenCalledWith(
      expect.anything(),
      'user-123'
    );

    setAnalyticsUserId(null);
    expect(firebaseAnalytics.setUserId).toHaveBeenLastCalledWith(
      expect.anything(),
      null
    );
  });

  it('swallows synchronous errors from the firebase module', () => {
    firebaseAnalytics.logEvent.mockImplementationOnce(() => {
      throw new Error('native module exploded');
    });

    expect(() => logEvent('rec_accepted', { game_id: 'g1' })).not.toThrow();
  });

  it('no-ops for the whole session when the module is unavailable', () => {
    firebaseAnalytics.getAnalytics.mockImplementationOnce(() => {
      throw new Error('module not linked');
    });

    expect(() => logEvent('first')).not.toThrow();
    // Second call must not retry getAnalytics or attempt to log
    logEvent('second');

    expect(firebaseAnalytics.getAnalytics).toHaveBeenCalledTimes(1);
    expect(firebaseAnalytics.logEvent).not.toHaveBeenCalled();
  });
});
