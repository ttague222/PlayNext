import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import {
  parseInstallReferrer,
  getInstallSource,
  initAttribution,
  _resetForTesting,
} from '../attributionService';
import { logEvent, setDefaultEventParams, setUserProperty } from '../analyticsService';

jest.mock('../analyticsService', () => ({
  logEvent: jest.fn(),
  setDefaultEventParams: jest.fn(),
  setUserProperty: jest.fn(),
}));

const TAGGED =
  'utm_source=scenario-pages&utm_medium=web&utm_campaign=playnxt-30min-lowenergy';

// In-memory AsyncStorage so first-open state carries across calls in a test
let store;

describe('parseInstallReferrer', () => {
  it('reads utm_source and utm_campaign from a tagged referrer', () => {
    expect(parseInstallReferrer(TAGGED)).toEqual({
      source: 'scenario-pages',
      campaign: 'playnxt-30min-lowenergy',
    });
  });

  it('handles a double-encoded referrer and mixed case', () => {
    expect(parseInstallReferrer('utm_source%3Dreddit%26utm_campaign%3Dplaynxt-community')).toEqual({
      source: 'reddit',
      campaign: 'playnxt-community',
    });
    expect(parseInstallReferrer('utm_source=Reddit&utm_medium=social').source).toBe('reddit');
  });

  it("treats Play's untagged default as organic", () => {
    expect(parseInstallReferrer('utm_source=google-play&utm_medium=organic')).toEqual({
      source: 'organic',
      campaign: null,
    });
    expect(parseInstallReferrer('utm_source=(not%20set)&utm_medium=(not%20set)').source).toBe(
      'organic'
    );
  });

  it('falls back to organic for empty or junk input', () => {
    expect(parseInstallReferrer('').source).toBe('organic');
    expect(parseInstallReferrer(null).source).toBe('organic');
    expect(parseInstallReferrer('%E0%A4%A').source).toBe('organic');
  });

  it('strips characters that do not belong in a param value', () => {
    expect(parseInstallReferrer('utm_source=cre ator<script>').source).toBe('creatorscript');
  });
});

describe('initAttribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetForTesting();
    store = {};
    AsyncStorage.getItem.mockImplementation((k) => Promise.resolve(store[k] ?? null));
    AsyncStorage.setItem.mockImplementation((k, v) => {
      store[k] = v;
      return Promise.resolve();
    });
    Platform.OS = 'android';
    Application.getInstallReferrerAsync.mockResolvedValue(TAGGED);
    Application.getInstallationTimeAsync.mockResolvedValue(new Date());
  });

  it('Android: tags every event with the referrer source and logs app_first_open once', async () => {
    await initAttribution();

    expect(setDefaultEventParams).toHaveBeenCalledWith({ source: 'scenario-pages' });
    expect(setUserProperty).toHaveBeenCalledWith('install_source', 'scenario-pages');
    expect(setUserProperty).toHaveBeenCalledWith('install_campaign', 'playnxt-30min-lowenergy');
    expect(logEvent).toHaveBeenCalledWith('app_first_open', {
      platform: 'android',
      app_version: '1.5.1',
      source: 'scenario-pages',
    });

    // Second launch: same source, no second app_first_open
    _resetForTesting();
    logEvent.mockClear();
    Application.getInstallReferrerAsync.mockClear();
    await initAttribution();
    expect(logEvent).not.toHaveBeenCalled();
    expect(Application.getInstallReferrerAsync).not.toHaveBeenCalled();
    expect(setDefaultEventParams).toHaveBeenLastCalledWith({ source: 'scenario-pages' });
  });

  it('iOS: resolves to organic without touching the referrer API', async () => {
    Platform.OS = 'ios';
    await initAttribution();
    expect(Application.getInstallReferrerAsync).not.toHaveBeenCalled();
    expect(setDefaultEventParams).toHaveBeenCalledWith({ source: 'organic' });
    expect(logEvent).toHaveBeenCalledWith(
      'app_first_open',
      expect.objectContaining({ platform: 'ios', source: 'organic' })
    );
  });

  it('skips app_first_open for users upgrading from a pre-attribution build', async () => {
    Application.getInstallationTimeAsync.mockResolvedValue(new Date(Date.now() - 30 * 86400000));
    await initAttribution();
    expect(logEvent).not.toHaveBeenCalled();
    expect(setDefaultEventParams).toHaveBeenCalledWith({ source: 'scenario-pages' });
    expect(store['@playnxt_first_open_logged']).toBe('1');
  });

  it('referrer failure resolves to organic and never throws', async () => {
    Application.getInstallReferrerAsync.mockRejectedValue(new Error('no play store'));
    await expect(initAttribution()).resolves.toBeUndefined();
    expect(await getInstallSource()).toBe('organic');
  });
});
