import { Platform, Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { shareGameCard } from '../shareService';
import { logEvent } from '../analyticsService';

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('../analyticsService', () => ({
  logEvent: jest.fn(),
}));

const game = { game_id: 'hades', title: 'Hades' };
const cardRef = { current: {} };

describe('shareGameCard', () => {
  let shareSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    captureRef.mockResolvedValue('file:///tmp/card.png');
    Sharing.isAvailableAsync.mockResolvedValue(true);
    Sharing.shareAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    shareSpy.mockRestore();
  });

  it('iOS: shares the captured image with the message attached', async () => {
    const ok = await shareGameCard(cardRef, game, 'detail');

    expect(ok).toBe(true);
    expect(captureRef).toHaveBeenCalledWith(cardRef, expect.objectContaining({
      format: 'png',
      width: 1080,
      height: 1350,
    }));
    expect(shareSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'file:///tmp/card.png',
        message: expect.stringContaining('Hades'),
      })
    );
    expect(logEvent).toHaveBeenCalledWith('share_opened', { source: 'detail', game_id: 'hades' });
    expect(logEvent).toHaveBeenCalledWith('share_completed', { source: 'detail', with_image: true });
  });

  it('iOS: logs a dismissal when the sheet is cancelled', async () => {
    shareSpy.mockResolvedValue({ action: Share.dismissedAction });

    await shareGameCard(cardRef, game, 'detail');

    expect(logEvent).toHaveBeenCalledWith('share_dismissed', { source: 'detail' });
    expect(logEvent).not.toHaveBeenCalledWith('share_completed', expect.anything());
  });

  it('Android: shares the image through expo-sharing', async () => {
    Platform.OS = 'android';

    const ok = await shareGameCard(cardRef, game, 'celebration');

    expect(ok).toBe(true);
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/card.png', expect.objectContaining({
      mimeType: 'image/png',
    }));
    expect(shareSpy).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith('share_completed', {
      source: 'celebration',
      with_image: true,
    });
  });

  it('falls back to text-only when capture fails', async () => {
    captureRef.mockRejectedValue(new Error('not laid out'));

    const ok = await shareGameCard(cardRef, game, 'detail');

    expect(ok).toBe(true);
    expect(shareSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({ url: expect.anything() })
    );
    expect(logEvent).toHaveBeenCalledWith('share_completed', {
      source: 'detail',
      with_image: false,
    });
  });

  it('falls back to text-only without a card ref', async () => {
    const ok = await shareGameCard(null, game, 'detail');

    expect(ok).toBe(true);
    expect(captureRef).not.toHaveBeenCalled();
    expect(shareSpy).toHaveBeenCalled();
  });

  it('returns false and logs a dismissal when sharing throws', async () => {
    shareSpy.mockRejectedValue(new Error('unavailable'));

    const ok = await shareGameCard(cardRef, game, 'detail');

    expect(ok).toBe(false);
    expect(logEvent).toHaveBeenCalledWith('share_dismissed', { source: 'detail' });
  });
});
