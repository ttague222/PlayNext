/**
 * Share Card
 *
 * Branded card rendered off-screen and captured as an image for the native
 * share sheet (see services/shareService). Laid out at 360x450 and captured
 * at 3x (1080x1350), which renders well in Discord embeds and phone chats.
 * No user-identifying data — only the pick and the session context chips.
 */

import React, { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 450;
export const SHARE_CARD_EXPORT_WIDTH = 1080;
export const SHARE_CARD_EXPORT_HEIGHT = 1350;

// Same vocabulary as GameCard's badges
const TIME_TO_FUN_LABELS: Record<string, string> = {
  short: 'Jump right in',
  medium: 'Brief setup',
  long: 'Worth the wait',
};

const STOP_FRIENDLINESS_LABELS: Record<string, string> = {
  anytime: 'Stop anytime',
  checkpoints: 'Save points',
  commitment: 'Block of time',
};

const SUBSCRIPTION_LABELS: Record<string, string> = {
  xbox_game_pass: 'On Game Pass',
  playstation_plus: 'On PS Plus',
  ea_play: 'On EA Play',
  apple_arcade: 'On Apple Arcade',
  netflix_games: 'On Netflix Games',
};

const TIME_LABELS: Record<number, string> = {
  15: '15 min',
  30: '30 min',
  60: '1 hour',
  90: '90 min',
  120: '2+ hours',
};

const MOOD_LABELS: Record<string, string> = {
  wind_down: '😌 Wind Down',
  casual: '🙂 Casual',
  focused: '🎯 Focused',
  intense: '🔥 Intense',
};

type ShareCardProps = {
  game: {
    title?: string;
    description_short?: string;
    explanation?: { summary?: string; mood_fit?: string };
    time_to_fun?: string;
    stop_friendliness?: string;
    subscription_services?: string[];
  };
  timeAvailable?: number | null;
  energyMood?: string | null;
};

const truncate = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

const ShareCard = forwardRef<View, ShareCardProps>(
  ({ game, timeAvailable, energyMood }, ref) => {
    const timeLabel = timeAvailable ? TIME_LABELS[timeAvailable] : null;
    const moodLabel = energyMood ? MOOD_LABELS[energyMood] : null;
    const why =
      game?.explanation?.summary || game?.description_short || '';
    const subscription = (game?.subscription_services || []).find(
      (s) => SUBSCRIPTION_LABELS[s]
    );

    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        <LinearGradient
          colors={['#0f0c29', '#1a1a2e', '#16213e']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.content}>
          {(timeLabel || moodLabel) && (
            <View style={styles.chipRow}>
              {timeLabel && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>⏱ {timeLabel}</Text>
                </View>
              )}
              {moodLabel && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{moodLabel}</Text>
                </View>
              )}
            </View>
          )}

          <Text style={styles.kicker}>TONIGHT'S PICK</Text>
          <Text style={styles.title} numberOfLines={2}>
            {game?.title || 'A great game'}
          </Text>

          {!!why && (
            <View style={styles.whyBox}>
              <Text style={styles.whyLabel}>Why this fits</Text>
              <Text style={styles.whyText}>{truncate(why, 160)}</Text>
            </View>
          )}

          <View style={styles.badgeRow}>
            {game?.time_to_fun && TIME_TO_FUN_LABELS[game.time_to_fun] && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  ⚡ {TIME_TO_FUN_LABELS[game.time_to_fun]}
                </Text>
              </View>
            )}
            {game?.stop_friendliness &&
              STOP_FRIENDLINESS_LABELS[game.stop_friendliness] && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    ✋ {STOP_FRIENDLINESS_LABELS[game.stop_friendliness]}
                  </Text>
                </View>
              )}
            {subscription && (
              <View style={[styles.badge, styles.subscriptionBadge]}>
                <Text style={[styles.badgeText, styles.subscriptionBadgeText]}>
                  {SUBSCRIPTION_LABELS[subscription]}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.spacer} />

          <View style={styles.footer}>
            <Text style={styles.wordmark}>
              Play<Text style={styles.wordmarkAccent}>Nxt</Text>
            </Text>
            <View style={styles.footerRight}>
              <Text style={styles.tagline}>What to play, in your free time</Text>
              <Text style={styles.storeLine}>App Store · Google Play</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }
);

ShareCard.displayName = 'ShareCard';

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    borderRadius: 0,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 26,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 13,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#a0a0b0',
    marginBottom: 6,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 16,
  },
  whyBox: {
    backgroundColor: 'rgba(248, 87, 166, 0.1)',
    borderColor: 'rgba(248, 87, 166, 0.35)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  whyLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#f857a6',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  whyText: {
    fontSize: 15,
    lineHeight: 21,
    color: '#e6e6ef',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c9c9d6',
  },
  subscriptionBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
  },
  subscriptionBadgeText: {
    color: '#4ade80',
  },
  spacer: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.14)',
    paddingTop: 16,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  wordmarkAccent: {
    color: '#f857a6',
  },
  footerRight: {
    alignItems: 'flex-end',
  },
  tagline: {
    fontSize: 11,
    color: '#a0a0b0',
    marginBottom: 2,
  },
  storeLine: {
    fontSize: 11,
    fontWeight: '600',
    color: '#c9c9d6',
  },
});

export default ShareCard;
