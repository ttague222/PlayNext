/**
 * Incoming share links (Universal Links / App Links for playnxt.io/s/*).
 *
 * Share ids are 10 chars of base62 today; the pattern is a little looser so
 * a future length change doesn't strand shipped clients, but it never admits
 * anything that couldn't be a share id.
 */

const SHARE_LINK_PATTERN = /^\/s\/([A-Za-z0-9]{6,32})\/?$/;

/**
 * The share id carried by a playnxt.io/s/<share-id> link, or null when the
 * URL is anything else (other pages, other hosts, junk).
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
export function parseShareLink(url) {
  if (!url || typeof url !== 'string') return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // https://playnxt.io/s/<id> is the real link; the custom-scheme form
  // (playnxt://playnxt.io/s/<id>) is accepted for completeness since the
  // scheme is registered anyway.
  if (parsed.hostname !== 'playnxt.io') return null;

  const match = SHARE_LINK_PATTERN.exec(parsed.pathname);
  return match ? match[1] : null;
}
