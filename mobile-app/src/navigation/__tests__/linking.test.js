/**
 * The navigator's deep-link handling must be a closed surface: share links
 * are counted and land on the Play tab, and NO external URL is ever handed
 * to React Navigation (its route-name fallback would let a crafted link like
 * playnxt://Premium drive navigation). OAuth redirects belong to
 * expo-auth-session's own listener, which this never touches.
 */
import { Linking } from 'react-native';
import { createLinking } from '../linking';
import { logEvent } from '../../services/analyticsService';

jest.mock('../../services/analyticsService', () => ({
  logEvent: jest.fn(),
}));

function fakeNavigationRef() {
  return { isReady: () => true, navigate: jest.fn() };
}

describe('createLinking', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getInitialURL (cold start)', () => {
    it('counts a share link and keeps it away from the navigator', async () => {
      jest
        .spyOn(Linking, 'getInitialURL')
        .mockResolvedValue('https://playnxt.io/s/aK3m9Qp2Rb');

      const linking = createLinking(fakeNavigationRef());

      expect(await linking.getInitialURL()).toBeNull();
      expect(logEvent).toHaveBeenCalledWith('app_open_from_share', {
        share_id: 'aK3m9Qp2Rb',
      });
    });

    it('never hands any other URL to the navigator either', async () => {
      // playnxt://Premium would match the Premium route by name.
      jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('playnxt://Premium');

      const linking = createLinking(fakeNavigationRef());

      expect(await linking.getInitialURL()).toBeNull();
      expect(logEvent).not.toHaveBeenCalled();
    });
  });

  describe('subscribe (warm opens)', () => {
    function emit(url, navigationRef) {
      let urlHandler;
      jest.spyOn(Linking, 'addEventListener').mockImplementation((event, handler) => {
        urlHandler = handler;
        return { remove: jest.fn() };
      });
      const listener = jest.fn();
      const unsubscribe = createLinking(navigationRef).subscribe(listener);
      urlHandler({ url });
      return { listener, unsubscribe };
    }

    it('counts a share link and surfaces the Play tab', () => {
      const navigationRef = fakeNavigationRef();

      const { listener } = emit('https://playnxt.io/s/aK3m9Qp2Rb', navigationRef);

      expect(logEvent).toHaveBeenCalledWith('app_open_from_share', {
        share_id: 'aK3m9Qp2Rb',
      });
      expect(navigationRef.navigate).toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
    });

    it('ignores every other URL instead of forwarding it', () => {
      const navigationRef = fakeNavigationRef();

      const { listener } = emit('playnxt://SignIn', navigationRef);

      expect(listener).not.toHaveBeenCalled();
      expect(navigationRef.navigate).not.toHaveBeenCalled();
      expect(logEvent).not.toHaveBeenCalled();
    });

    it('cleans up its event subscription', () => {
      const removeSpy = jest.fn();
      jest
        .spyOn(Linking, 'addEventListener')
        .mockReturnValue({ remove: removeSpy });

      const unsubscribe = createLinking(fakeNavigationRef()).subscribe(jest.fn());
      unsubscribe();

      expect(removeSpy).toHaveBeenCalled();
    });
  });
});
