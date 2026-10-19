/**
 * Deep Link Service
 *
 * Handles incoming playnxt.io/s/<share-id> links (Universal Links on iOS,
 * App Links on Android). The share landing already happened in the sharer's
 * chat — in-app, the valuable moves are counting the open and landing the
 * viewer on the Play tab, where "get your own pick" starts.
 *
 * The navigator's linking config calls this from both the cold-start path
 * (getInitialURL) and the warm path (url events); OAuth and any other links
 * are left for their own handlers.
 */

import { logEvent } from './analyticsService';
import { parseShareLink } from '../utils/shareLinks';

/**
 * Count an incoming share link.
 * @param {string|null|undefined} url
 * @returns {boolean} true when the URL was a share link and was handled
 */
export function handleShareUrl(url) {
  const shareId = parseShareLink(url);
  if (!shareId) return false;

  logEvent('app_open_from_share', { share_id: shareId });
  return true;
}
