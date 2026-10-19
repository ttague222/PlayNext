/**
 * Share Service
 *
 * Captures the off-screen ShareCard as an image and hands it to the native
 * share sheet, with the text message (and store links) riding along where
 * the platform supports it. Falls back to the text-only share if capture
 * fails, so sharing never breaks.
 */

import { Platform, Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import api from './api';
import { auth } from '../config/firebase';
import { buildShareLink, buildShareMessage } from '../utils/shareGame';
import { logEvent } from './analyticsService';
import {
  SHARE_CARD_EXPORT_WIDTH,
  SHARE_CARD_EXPORT_HEIGHT,
} from '../components/ShareCard';

/**
 * Scoreboard's result_shared: "card" when the image went out, "link" when
 * only the text message did. game_count/num_picks is how many games the
 * share carried (the celebration share carries the whole set).
 */
function logResultShared(withImage, context, pickCount) {
  const { timeAvailable, energyMood } = context || {};
  logEvent('result_shared', {
    surface: withImage ? 'card' : 'link',
    scenario: timeAvailable && energyMood ? `${timeAvailable}min_${energyMood}` : 'none',
    game_count: pickCount,
    num_picks: pickCount,
  });
}

/**
 * Store the share behind a /s/<share-id> page and return its link, or null
 * when it can't be stored (no scenario, API down). The link then degrades to
 * the game's /pick page -- sharing must never break.
 *
 * The API reads why/match out of each pick's signed pick_token and prefers
 * the verified Firebase uid over the body's sharer_id.
 */
async function createShareLink(picks, context) {
  const { timeAvailable, energyMood } = context || {};
  if (!timeAvailable || !energyMood) return null;

  try {
    const response = await api.createShare({
      surface: 'app',
      sharer_id: auth.currentUser?.uid || 'app-anon',
      time_available: timeAvailable,
      energy_mood: energyMood,
      picks: picks.map((pick) => ({
        game_id: pick.game_id,
        pick_token: pick.pick_token || null,
      })),
    });
    return response?.share_id ? buildShareLink(response.share_id) : null;
  } catch (err) {
    return null;
  }
}

/**
 * Capture the ShareCard behind cardRef and open the native share sheet.
 * @param {object} cardRef - Ref to the mounted (off-screen) ShareCard view
 * @param {object} game - The accepted game (names the share message)
 * @param {string} source - Entry point for analytics (detail | celebration)
 * @param {{ timeAvailable?: number|null, energyMood?: string|null, picks?: object[] }} [context]
 *   Session context, plus the full pick set when the caller has one
 * @returns {boolean} whether a share sheet was opened
 */
export async function shareGameCard(cardRef, game, source, context = {}) {
  logEvent('share_opened', { source, game_id: game?.game_id || null });

  const picks = context?.picks?.length ? context.picks : [game].filter(Boolean);
  const shareLink = await createShareLink(picks, context);
  const { title, message } = buildShareMessage(game, context, shareLink);

  let imageUri = null;
  if (cardRef?.current) {
    try {
      imageUri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        width: SHARE_CARD_EXPORT_WIDTH,
        height: SHARE_CARD_EXPORT_HEIGHT,
      });
    } catch (err) {
      // Capture failed (view not laid out yet, low memory) — text still works
      imageUri = null;
    }
  }

  try {
    if (imageUri && Platform.OS === 'ios') {
      // iOS share sheet carries the image AND the message with store links
      const result = await Share.share({ title, message, url: imageUri });
      if (result?.action === Share.dismissedAction) {
        logEvent('share_dismissed', { source });
      } else {
        logEvent('share_completed', { source, with_image: true });
        logResultShared(true, context, picks.length);
      }
      return true;
    }

    if (imageUri && (await Sharing.isAvailableAsync())) {
      // Android: image via the system sheet; the card itself carries the
      // branding and store line, since text can't ride along here
      await Sharing.shareAsync(imageUri, {
        mimeType: 'image/png',
        dialogTitle: title,
      });
      logEvent('share_completed', { source, with_image: true });
      logResultShared(true, context, picks.length);
      return true;
    }

    // Fallback: the original text-only share
    const result = await Share.share({ title, message });
    if (result?.action === Share.dismissedAction) {
      logEvent('share_dismissed', { source });
    } else {
      logEvent('share_completed', { source, with_image: false });
      logResultShared(false, context, picks.length);
    }
    return true;
  } catch (err) {
    // User dismissed or share unavailable
    logEvent('share_dismissed', { source });
    return false;
  }
}
