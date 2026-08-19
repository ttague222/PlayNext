import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import {
  shouldRequestReview,
  maybeRequestReview,
  REVIEW_LAST_PROMPT_KEY,
  REVIEW_PROMPT_COUNT_KEY,
  COOLDOWN_DAYS,
  MAX_LIFETIME_PROMPTS,
} from '../reviewPrompt';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe('shouldRequestReview', () => {
  const base = {
    lastPromptAt: null,
    promptCount: 0,
    otherPromptShown: false,
    now: 1_000_000_000_000,
  };

  it('allows the first prompt', () => {
    expect(shouldRequestReview(base)).toBe(true);
  });

  it('never stacks on another prompt', () => {
    expect(shouldRequestReview({ ...base, otherPromptShown: true })).toBe(false);
  });

  it('respects the cooldown window', () => {
    const recent = base.now - (COOLDOWN_DAYS - 1) * ONE_DAY_MS;
    expect(shouldRequestReview({ ...base, lastPromptAt: recent })).toBe(false);

    const stale = base.now - (COOLDOWN_DAYS + 1) * ONE_DAY_MS;
    expect(shouldRequestReview({ ...base, lastPromptAt: stale })).toBe(true);
  });

  it('stops at the lifetime cap', () => {
    expect(
      shouldRequestReview({ ...base, promptCount: MAX_LIFETIME_PROMPTS })
    ).toBe(false);
  });
});

describe('maybeRequestReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests a review and records prompt state', async () => {
    const result = await maybeRequestReview({ trigger: 'followup_worked' });

    expect(result).toBe(true);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      REVIEW_LAST_PROMPT_KEY,
      expect.any(String)
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      REVIEW_PROMPT_COUNT_KEY,
      '1'
    );
  });

  it('does nothing when another prompt was shown', async () => {
    const result = await maybeRequestReview({ otherPromptShown: true });

    expect(result).toBe(false);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('does nothing within the cooldown window', async () => {
    AsyncStorage.getItem.mockImplementation((key) =>
      Promise.resolve(key === REVIEW_LAST_PROMPT_KEY ? String(Date.now()) : null)
    );

    const result = await maybeRequestReview();

    expect(result).toBe(false);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('does nothing at the lifetime cap', async () => {
    AsyncStorage.getItem.mockImplementation((key) =>
      Promise.resolve(
        key === REVIEW_PROMPT_COUNT_KEY ? String(MAX_LIFETIME_PROMPTS) : null
      )
    );

    const result = await maybeRequestReview();

    expect(result).toBe(false);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('does nothing when the store review API is unavailable', async () => {
    StoreReview.isAvailableAsync.mockResolvedValueOnce(false);

    const result = await maybeRequestReview();

    expect(result).toBe(false);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('never throws when the native call fails', async () => {
    StoreReview.requestReview.mockRejectedValueOnce(new Error('StoreKit error'));

    await expect(maybeRequestReview()).resolves.toBe(false);
  });
});
