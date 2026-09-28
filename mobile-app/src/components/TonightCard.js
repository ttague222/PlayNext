/**
 * Tonight's Picks card for the Play tab.
 * Presentation-only: parent owns state and data.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getGameImage } from '../services/gameImages';

const MOOD_LABELS = {
  wind_down: 'Wind down',
  casual: 'Casual',
  focused: 'Focused',
  intense: 'Intense',
};

export function formatContextLine(context) {
  if (!context) return '';
  const time = context.timeAvailable >= 120 ? '2+ hrs' : `${context.timeAvailable} min`;
  const mood = MOOD_LABELS[context.energyMood] || context.energyMood;
  return `${time} · ${mood}`;
}

const Thumb = ({ game }) => {
  const [uri, setUri] = useState(null);
  useEffect(() => {
    let mounted = true;
    getGameImage(game.game_id, game.title)
      .then((img) => { if (mounted && img) setUri(img); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [game.game_id, game.title]);

  return (
    <View style={styles.thumbWrap}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="game-controller-outline" size={18} color="#4a4a6a" />
        </View>
      )}
      <Text style={styles.thumbTitle} numberOfLines={1}>{game.title}</Text>
    </View>
  );
};

/**
 * @param {'loading'|'ready'|'error'} status
 * @param {object} context - saved context (subtitle line)
 * @param {Array} games - today's picks (ready state)
 * @param {Function} onPress - open picks (ready) or retry (error/loading)
 * @param {Function} onChangePress - jump into the normal input flow
 */
const TonightCard = ({ status, context, games, onPress, onChangePress }) => {
  return (
    <TouchableOpacity
      testID="tonight-card"
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Tonight's Picks, ${formatContextLine(context)}`}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="moon-outline" size={16} color="#e94560" />
          <Text style={styles.title}>Tonight's Picks</Text>
        </View>
        <TouchableOpacity onPress={onChangePress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.change}>Change</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.contextLine}>{formatContextLine(context)}</Text>

      {status === 'ready' && (
        <View style={styles.thumbRow}>
          {games.map((game) => (
            <Thumb key={game.game_id} game={game} />
          ))}
        </View>
      )}
      {status === 'loading' && <Text style={styles.stateText}>Picking for tonight…</Text>}
      {status === 'error' && (
        <Text style={styles.stateText}>Couldn't load tonight's picks. Tap to retry.</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.25)',
    padding: 16,
    marginTop: 24,
    width: '100%',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  change: { color: '#e94560', fontSize: 13, fontWeight: '600' },
  contextLine: { color: '#a0a0b8', fontSize: 13, marginTop: 4 },
  thumbRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  thumbWrap: { flex: 1, alignItems: 'center' },
  thumb: { width: '100%', aspectRatio: 3 / 4, borderRadius: 8 },
  thumbPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbTitle: { color: '#d0d0e0', fontSize: 11, marginTop: 6, maxWidth: '100%' },
});

export default TonightCard;
