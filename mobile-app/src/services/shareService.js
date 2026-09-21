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
import { buildShareMessage } from '../utils/shareGame';
import { logEvent } from './analyticsService';
import {
  SHARE_CARD_EXPORT_WIDTH,
  SHARE_CARD_EXPORT_HEIGHT,
} from '../components/ShareCard';

/**
 * Capture the ShareCard behind cardRef and open the native share sheet.
 * @param {object} cardRef - Ref to the mounted (off-screen) ShareCard view
 * @param {object} game - The recommended game
 * @param {string} source - Entry point for analytics (detail | celebration)
 * @returns {boolean} whether a share sheet was opened
 */
export async function shareGameCard(cardRef, game, source) {
  logEvent('share_opened', { source, game_id: game?.game_id || null });
  const { title, message } = buildShareMessage(game);

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
      return true;
    }

    // Fallback: the original text-only share
    const result = await Share.share({ title, message });
    if (result?.action === Share.dismissedAction) {
      logEvent('share_dismissed', { source });
    } else {
      logEvent('share_completed', { source, with_image: false });
    }
    return true;
  } catch (err) {
    // User dismissed or share unavailable
    logEvent('share_dismissed', { source });
    return false;
  }
}
