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

jest.mock('../api', () => ({
  __esModule: true,
  default: { createShare: jest.fn() },
}));

jest.mock('../../config/firebase', () => ({
  auth: { currentUser: { uid: 'firebase-uid-123' } },
}));

import api from '../api';

const game = { game_id: 'hades', title: 'Hades', pick_token: 'signed.hades' };
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
    api.createShare.mockResolvedValue({ share_id: 'aK3m9Qp2Rb' });
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

  describe('the share loop (/s/<share-id>)', () => {
    const picks = [
      game,
      { game_id: 'unpacking', title: 'Unpacking', pick_token: 'signed.unpacking' },
      { game_id: 'celeste', title: 'Celeste', pick_token: null },
    ];
    const context = { timeAvailable: 30, energyMood: 'wind_down', picks };

    it('stores the picks and points the message at the share page', async () => {
      await shareGameCard(cardRef, game, 'celebration', context);

      expect(api.createShare).toHaveBeenCalledWith({
        surface: 'app',
        sharer_id: 'firebase-uid-123',
        time_available: 30,
        energy_mood: 'wind_down',
        picks: [
          { game_id: 'hades', pick_token: 'signed.hades' },
          { game_id: 'unpacking', pick_token: 'signed.unpacking' },
          { game_id: 'celeste', pick_token: null },
        ],
      });
      expect(shareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('/s/aK3m9Qp2Rb'),
        })
      );
    });

    it('shares the accepted game alone when the caller has no pick list', async () => {
      await shareGameCard(cardRef, game, 'celebration', {
        timeAvailable: 30,
        energyMood: 'wind_down',
      });

      expect(api.createShare).toHaveBeenCalledWith(
        expect.objectContaining({
          picks: [{ game_id: 'hades', pick_token: 'signed.hades' }],
        })
      );
    });

    it('falls back to the /pick link when the share cannot be stored', async () => {
      // Sharing must never break: the link degrades, the sheet still opens.
      api.createShare.mockRejectedValue(new Error('api down'));

      const ok = await shareGameCard(cardRef, game, 'celebration', context);

      expect(ok).toBe(true);
      expect(shareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('/pick/hades'),
        })
      );
    });

    it('does not try to store a share without the required scenario', async () => {
      // The detail screen shares outside a fresh engine run: no time/mood,
      // and the API requires both, so go straight to the /pick link.
      await shareGameCard(cardRef, game, 'detail');

      expect(api.createShare).not.toHaveBeenCalled();
      expect(shareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('/pick/hades'),
        })
      );
    });
  });

  describe('result_shared (activation scoreboard)', () => {
    const shared = () =>
      logEvent.mock.calls.filter(([n]) => n === 'result_shared').map(([, p]) => p);

    it('card share carries the scenario and the number of picks shared', async () => {
      await shareGameCard(cardRef, game, 'celebration', {
        timeAvailable: 30,
        energyMood: 'wind_down',
        picks: [game, { game_id: 'unpacking' }, { game_id: 'celeste' }],
      });
      expect(shared()).toEqual([
        { surface: 'card', scenario: '30min_wind_down', game_count: 3, num_picks: 3 },
      ]);
    });

    it('text-only share is a link; no context means scenario none', async () => {
      captureRef.mockRejectedValue(new Error('not laid out'));
      await shareGameCard(cardRef, game, 'detail');
      expect(shared()).toEqual([
        { surface: 'link', scenario: 'none', game_count: 1, num_picks: 1 },
      ]);
    });

    it('Android image share counts as a card', async () => {
      Platform.OS = 'android';
      await shareGameCard(cardRef, game, 'celebration', { timeAvailable: 15, energyMood: 'casual' });
      expect(shared()).toEqual([
        { surface: 'card', scenario: '15min_casual', game_count: 1, num_picks: 1 },
      ]);
    });

    it('does not fire when the sheet is dismissed', async () => {
      shareSpy.mockResolvedValue({ action: Share.dismissedAction });
      await shareGameCard(cardRef, game, 'detail', { timeAvailable: 30, energyMood: 'wind_down' });
      expect(shared()).toEqual([]);
    });
  });

  it('returns false and logs a dismissal when sharing throws', async () => {
    shareSpy.mockRejectedValue(new Error('unavailable'));

    const ok = await shareGameCard(cardRef, game, 'detail');

    expect(ok).toBe(false);
    expect(logEvent).toHaveBeenCalledWith('share_dismissed', { source: 'detail' });
  });
});
