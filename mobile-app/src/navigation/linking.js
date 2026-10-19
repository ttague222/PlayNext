/**
 * Deep linking (Universal Links / App Links for playnxt.io/s/*).
 *
 * Share links are handled imperatively in deepLinkService — count the open,
 * land the viewer on the Play tab — rather than mapped to a route, because
 * the app has no share-viewing screen on purpose: the landing page already
 * showed the picks, and in-app the next step is getting your own.
 *
 * This is a deliberately closed surface: no URL is ever handed to React
 * Navigation. Its route-name fallback would otherwise let any crafted link
 * (playnxt://Premium, https://playnxt.io/SignIn) drive navigation from
 * outside the app. OAuth redirects are consumed by expo-auth-session's own
 * Linking listener, which registers independently of the navigator.
 */

import { Linking } from 'react-native';
import { handleShareUrl } from '../services/deepLinkService';

export function createLinking(navigationRef) {
  return {
    prefixes: ['https://playnxt.io', 'playnxt://'],
    config: { screens: {} },
    async getInitialURL() {
      // Cold start from a share link: count it; the default route is already
      // the Play tab, so there is nowhere further to go. Nothing else may
      // reach the navigator.
      handleShareUrl(await Linking.getInitialURL());
      return null;
    },
    subscribe(listener) {
      // `listener` is the navigator's URL feed; it is intentionally never
      // called. Share links are acted on here, everything else is ignored.
      void listener;
      const subscription = Linking.addEventListener('url', ({ url }) => {
        if (handleShareUrl(url) && navigationRef.isReady()) {
          // Warm open: surface the Play tab so the link visibly did something.
          navigationRef.navigate('Main', { screen: 'Play', params: { screen: 'PlayHome' } });
        }
      });
      return () => subscription.remove();
    },
  };
}
