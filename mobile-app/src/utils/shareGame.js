const IOS_URL = 'https://apps.apple.com/app/id6757089064';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.playnxt.app';

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
