/**
 * Seasonal collection card for the Play tab.
 * Presentation-only: the parent owns loading, state and navigation.
 *
 * Locked-brand rule (design spec 6.2): the season accent colors only
 * non-interactive highlights here (border, eyebrow, icon). The Retry link is
 * tappable, so it stays brand pink.
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getGameImage } from '../services/gameImages';
import type { Collection, CollectionParams, CollectionPicks } from '../services/seasonalService';
import { useTheme } from '../theme/ThemeContext';
import { alpha } from '../theme/palette';
import ShimmerBlock from './ShimmerBlock';

const MOOD_LABELS: Record<string, string> = {
  wind_down: 'Wind Down',
  casual: 'Casual',
  focused: 'Focused',
  intense: 'Intense',
};

const SESSION_LABELS: Record<string, string> = {
  couch_coop: 'Couch co-op',
  multiplayer: 'With friends',
  online_friends: 'Online with friends',
  solo: 'Solo',
};

const THUMB_COUNT = 3;

/** "60 min · Casual · Couch co-op"; the session part is omitted for any/missing. */
export function formatCollectionContext(params: CollectionParams): string {
  const parts = [
    `${params.time_available} min`,
    MOOD_LABELS[params.energy_mood] ?? params.energy_mood,
  ];
  const session = params.session_type ? SESSION_LABELS[params.session_type] : undefined;
  if (session) parts.push(session);
  return parts.join(' · ');
}

type Game = { game_id: string; title: string };

const Thumb = ({ game }: { game: Game }) => {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    getGameImage(game.game_id, game.title)
      .then((img: { imageUrl?: string | null } | null) => {
        if (mounted) setUri(img?.imageUrl || null);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [game.game_id, game.title]);

  return (
    <View style={styles.thumbWrap}>
      {uri ? (
        <Image
          testID={`seasonal-thumb-image-${game.game_id}`}
          source={{ uri }}
          style={styles.thumb}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="game-controller-outline" size={18} color="#4a4a6a" />
        </View>
      )}
      <Text style={styles.thumbTitle} numberOfLines={1}>
        {game.title}
      </Text>
    </View>
  );
};

type Props = {
  collection: Collection;
  /** Today's picks (ready state). */
  picks: CollectionPicks | null;
  status: 'loading' | 'ready' | 'error';
  /** Open the picks (ready), or retry then open (loading/error). */
  onPress: () => void;
  /** Retry the failed load, without opening the card. */
  onRetry: () => void;
  /** Season name shown as the eyebrow. */
  seasonName?: string;
  /** Optional season illustration; absent on all current content. */
  headerImage?: { url: string; alt: string } | null;
};

const SeasonalCard = ({ collection, picks, status, onPress, onRetry, seasonName, headerImage }: Props) => {
  const theme = useTheme();
  const accent = theme.accent.season ?? theme.accent.brand;
  const contextLine = formatCollectionContext(collection.params);
  const games = ((picks?.games ?? []) as Game[]).slice(0, THUMB_COUNT);

  return (
    <TouchableOpacity
      testID={`seasonal-card-${collection.id}`}
      style={[styles.card, { borderColor: alpha(accent, 0.25) }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${collection.title}, ${contextLine}`}
    >
      {headerImage ? (
        <Image
          testID="seasonal-card-header-image"
          source={{ uri: headerImage.url }}
          style={styles.headerImage}
          resizeMode="cover"
          accessibilityLabel={headerImage.alt}
        />
      ) : null}
      {seasonName ? (
        <View style={styles.eyebrowRow}>
          <Ionicons name="sparkles-outline" size={14} color={accent} />
          <Text style={[styles.eyebrow, { color: accent }]}>{seasonName}</Text>
        </View>
      ) : null}
      <Text style={styles.title}>{collection.title}</Text>
      <Text style={styles.blurb}>{collection.blurb}</Text>
      <Text style={styles.contextLine}>{contextLine}</Text>

      {status === 'ready' && (
        <View style={styles.thumbRow}>
          {games.map((game) => (
            <Thumb key={game.game_id} game={game} />
          ))}
        </View>
      )}
      {status === 'loading' && (
        <View style={styles.thumbRow} testID="seasonal-card-loading">
          {Array.from({ length: THUMB_COUNT }, (_, i) => (
            <ShimmerBlock key={i} style={styles.shimmerThumb} />
          ))}
        </View>
      )}
      {status === 'error' && (
        <View style={styles.errorRow}>
          <Text style={styles.stateText}>Couldn't load today's picks.</Text>
          <TouchableOpacity
            onPress={onRetry}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading today's picks"
          >
            <Text style={[styles.retry, { color: theme.accent.brand }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 16,
    width: '100%',
    overflow: 'hidden',
  },
  headerImage: { width: '100%', height: 96, borderRadius: 8, marginBottom: 12 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  blurb: { color: '#d0d0e0', fontSize: 13, marginTop: 4, lineHeight: 18 },
  contextLine: { color: '#a0a0b8', fontSize: 13, marginTop: 6 },
  thumbRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  thumbWrap: { flex: 1, alignItems: 'center' },
  thumb: { width: '100%', aspectRatio: 3 / 4, borderRadius: 8 },
  shimmerThumb: { flex: 1, aspectRatio: 3 / 4, borderRadius: 8 },
  thumbPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbTitle: { color: '#d0d0e0', fontSize: 11, marginTop: 6, maxWidth: '100%' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  stateText: { color: '#a0a0b8', fontSize: 13 },
  retry: { fontSize: 13, fontWeight: '600' },
});

export default SeasonalCard;
