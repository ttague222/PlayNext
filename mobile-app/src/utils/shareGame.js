// Share links point at the playnxt.io /pick landing page (SHAREABLE-RESULTS
// spec §4 v2): it unfurls as the shared game with cover art, sells the pick
// to cold recipients, offers both stores platform-neutrally, and funnels
// into the web quiz. utm_source=share_card attributes the inbound visit;
// the page's own outbound links carry utm_source=pick_page.
const PICK_BASE_URL = 'https://playnxt.io/pick/';
const SHARE_BASE_URL = 'https://playnxt.io/s/';
const HOME_URL = 'https://playnxt.io/?utm_source=share_card';

const MOOD_LABELS = {
  wind_down: 'Wind Down',
  casual: 'Casual',
  focused: 'Focused',
  intense: 'Intense',
};

/**
 * Build the /pick link for a game, carrying the session context when known.
 * @param {object} game
 * @param {{ timeAvailable?: number|null, energyMood?: string|null }} [context]
 */
export function buildPickLink(game, context = {}) {
  if (!game?.game_id) return HOME_URL;
  const params = new URLSearchParams({ utm_source: 'share_card' });
  if (context.timeAvailable) params.set('t', String(context.timeAvailable));
  if (context.energyMood && MOOD_LABELS[context.energyMood]) params.set('m', context.energyMood);
  return `${PICK_BASE_URL}${encodeURIComponent(game.game_id)}?${params}`;
}

/**
 * Build the /s/<share-id> link for a stored share, tagged the same way the
 * web tags its share links so inbound visits attribute to sharing.
 * @param {string} shareId
 */
export function buildShareLink(shareId) {
  const params = new URLSearchParams({ utm_source: 'share', utm_medium: 'app' });
  return `${SHARE_BASE_URL}${encodeURIComponent(shareId)}?${params}`;
}

/**
 * Build the share sheet content for an accepted game recommendation.
 * Returns { title, message } for use with React Native's Share.share().
 * @param {object} game
 * @param {{ timeAvailable?: number|null, energyMood?: string|null }} [context]
 * @param {string|null} [shareLink] - The /s/<share-id> link when a share was
 *   stored; falls back to the game's /pick page when not.
 */
export function buildShareMessage(game, context = {}, shareLink = null) {
  const gameTitle = game?.title || 'a game';
  const link = shareLink || buildPickLink(game, context);
  const moodLabel = context.energyMood ? MOOD_LABELS[context.energyMood] : null;
  const contextLine =
    context.timeAvailable && moodLabel
      ? `PlayNxt said: ${gameTitle} for a ${context.timeAvailable}-minute ${moodLabel} session.`
      : `PlayNxt said: ${gameTitle}.`;
  return {
    title: `Playing ${gameTitle} tonight`,
    message: `Playing ${gameTitle} tonight 🎮\n\n${contextLine}\n\n${link}`,
  };
}
