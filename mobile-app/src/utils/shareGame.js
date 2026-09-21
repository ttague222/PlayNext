// Campaign-tagged store links so installs from shares are attributable.
// Play passes utm params through the install referrer; the iOS params are
// best-effort (full attribution needs an Apple campaign token) but harmless.
const IOS_URL = 'https://apps.apple.com/app/id6757089064?utm_source=share_card';
const ANDROID_URL =
  'https://play.google.com/store/apps/details?id=com.playnxt.app&referrer=utm_source%3Dshare_card';

/**
 * Build the share sheet content for an accepted game recommendation.
 * Returns { title, message } for use with React Native's Share.share().
 */
export function buildShareMessage(game) {
  const gameTitle = game?.title || 'a game';
  return {
    title: `Playing ${gameTitle} tonight`,
    message: `Playing ${gameTitle} tonight 🎮\n\nFound it with PlayNxt — the app that recommends games based on your mood and time.\n\niOS: ${IOS_URL}\nAndroid: ${ANDROID_URL}`,
  };
}
