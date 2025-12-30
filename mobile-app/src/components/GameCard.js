/**
 * PlayNext Game Card Component
 *
 * Displays a single game recommendation with details and actions.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getGameImage } from '../services/gameImages';

const PLATFORM_LABELS = {
  pc: 'PC',
  console: 'Console',
  handheld: 'Handheld',
};

const PLATFORM_ICONS = {
  pc: '🖥️',
  console: '🎮',
  handheld: '📱',
};

const TIME_TO_FUN_LABELS = {
  short: 'Jump right in',
  medium: 'Brief setup',
  long: 'Worth the wait',
};

const STOP_FRIENDLINESS_LABELS = {
  anytime: 'Stop anytime',
  checkpoints: 'Save points',
  commitment: 'Block of time',
};

// Subscription service branding
const SUBSCRIPTION_CONFIG = {
  xbox_game_pass: {
    name: 'Xbox Game Pass',
    icon: '🟢',
    colors: ['#107C10', '#0e6b0e'],
    textColor: '#ffffff',
  },
  playstation_plus: {
    name: 'PlayStation Plus',
    icon: '🔵',
    colors: ['#003087', '#00246d'],
    textColor: '#ffffff',
  },
  ea_play: {
    name: 'EA Play',
    icon: '⚽',
    colors: ['#ff4747', '#cc3939'],
    textColor: '#ffffff',
  },
  ubisoft_plus: {
    name: 'Ubisoft+',
    icon: '🎯',
    colors: ['#0070ff', '#005acc'],
    textColor: '#ffffff',
  },
  nintendo_switch_online: {
    name: 'Nintendo Switch Online',
    icon: '🔴',
    colors: ['#e60012', '#cc0010'],
    textColor: '#ffffff',
  },
  netflix_games: {
    name: 'Netflix Games',
    icon: '📺',
    colors: ['#E50914', '#B20710'],
    textColor: '#ffffff',
  },
  amazon_luna: {
    name: 'Amazon Luna',
    icon: '🌙',
    colors: ['#00A8E1', '#0078A8'],
    textColor: '#ffffff',
  },
  apple_arcade: {
    name: 'Apple Arcade',
    icon: '🍎',
    colors: ['#FA243C', '#C41E32'],
    textColor: '#ffffff',
  },
  default: {
    name: 'Subscription',
    icon: '✨',
    colors: ['#6366f1', '#4f46e5'],
    textColor: '#ffffff',
  },
};

const GameCard = ({ game, rank, onAccept, onAlreadyPlayed, isSwapping }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [fallbackColors, setFallbackColors] = useState(['#667eea', '#764ba2']);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
        delay: rank * 150,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        delay: rank * 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [rank]);

  // Fetch game image
  useEffect(() => {
    const fetchImage = async () => {
      try {
        const result = await getGameImage(game.game_id, game.title);
        setImageUrl(result.imageUrl);
        setFallbackColors(result.fallbackColors);
      } catch (error) {
        console.warn('Failed to fetch game image:', error);
      } finally {
        setImageLoading(false);
      }
    };
    fetchImage();
  }, [game.game_id, game.title]);

  const platformIcons = game.platforms
    .map((p) => PLATFORM_ICONS[p] || '🎮')
    .join(' ');

  const matchPercent = Math.round((game.match_score || 0.85) * 100);

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={[styles.card, rank === 1 && styles.cardTopPick]}>
        {/* Top Pick Glow - background effect */}
        {rank === 1 && (
          <LinearGradient
            colors={['rgba(248, 87, 166, 0.2)', 'rgba(248, 87, 166, 0)']}
            style={styles.topPickGlow}
          />
        )}

        {/* Game Thumbnail */}
        <View style={styles.thumbnailContainer}>
          {imageUrl && !imageError ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
            />
          ) : (
            <LinearGradient
              colors={fallbackColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.thumbnailPlaceholder}
            >
              <Text style={styles.thumbnailEmoji}>🎮</Text>
              <Text style={styles.thumbnailTitle}>{game.title}</Text>
            </LinearGradient>
          )}
          {imageLoading && (
            <View style={styles.thumbnailLoading}>
              <ActivityIndicator color="#ffffff" size="small" />
            </View>
          )}
          {/* Top Pick Badge - overlay on image */}
          {rank === 1 && (
            <View style={styles.topPickBadge}>
              <LinearGradient
                colors={['#f857a6', '#ff5858']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.topPickGradient}
              >
                <Text style={styles.topPickIcon}>⭐</Text>
                <Text style={styles.topPickText}>TOP PICK</Text>
              </LinearGradient>
            </View>
          )}
          {/* Match badge overlay */}
          <View style={styles.matchBadgeOverlay}>
            <Text style={styles.matchTextOverlay}>{matchPercent}%</Text>
          </View>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{game.title}</Text>
          <View style={styles.platformRow}>
            <Text style={styles.platformIcons}>{platformIcons}</Text>
            <Text style={styles.platforms}>
              {game.platforms.map((p) => PLATFORM_LABELS[p] || p).join(' · ')}
            </Text>
          </View>
        </View>

        {/* Description */}
        <Text style={styles.description}>{game.description_short}</Text>

        {/* Why this fits - Enhanced with individual points */}
        {game.explanation && (
          <View style={styles.explanationBox}>
            <LinearGradient
              colors={['rgba(248, 87, 166, 0.15)', 'rgba(255, 88, 88, 0.05)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <Text style={styles.explanationLabel}>💡 Why this fits your session</Text>
            <View style={styles.explanationPoints}>
              {game.explanation.mood_fit && (
                <View style={styles.explanationPoint}>
                  <Text style={styles.explanationBullet}>✨</Text>
                  <Text style={styles.explanationText}>{game.explanation.mood_fit}</Text>
                </View>
              )}
              {game.explanation.stop_fit && (
                <View style={styles.explanationPoint}>
                  <Text style={styles.explanationBullet}>⏱️</Text>
                  <Text style={styles.explanationText}>{game.explanation.stop_fit}</Text>
                </View>
              )}
              {game.explanation.style_fit && (
                <View style={styles.explanationPoint}>
                  <Text style={styles.explanationBullet}>🎯</Text>
                  <Text style={styles.explanationText}>{game.explanation.style_fit}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Meta tags */}
        <View style={styles.metaRow}>
          <View style={styles.metaTag}>
            <Text style={styles.metaIcon}>⚡</Text>
            <Text style={styles.metaText}>
              {TIME_TO_FUN_LABELS[game.time_to_fun] || 'Quick start'}
            </Text>
          </View>
          <View style={styles.metaTag}>
            <Text style={styles.metaIcon}>⏸️</Text>
            <Text style={styles.metaText}>
              {STOP_FRIENDLINESS_LABELS[game.stop_friendliness] || 'Flexible'}
            </Text>
          </View>
        </View>

        {/* Subscription Services */}
        {game.subscription_services?.length > 0 && (
          <View style={styles.subscriptionSection}>
            <Text style={styles.subscriptionLabel}>🎟️ Play with your subscription</Text>
            <View style={styles.subscriptionChips}>
              {game.subscription_services.map((service) => {
                const config = SUBSCRIPTION_CONFIG[service] || SUBSCRIPTION_CONFIG.default;
                return (
                  <View key={service} style={styles.subscriptionChip}>
                    <LinearGradient
                      colors={config.colors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.subscriptionChipGradient}
                    >
                      <Text style={styles.subscriptionChipIcon}>{config.icon}</Text>
                      <Text style={[styles.subscriptionChipText, { color: config.textColor }]}>
                        {config.name}
                      </Text>
                    </LinearGradient>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={onAccept}
            activeOpacity={0.9}
            disabled={isSwapping}
          >
            <LinearGradient
              colors={['#f857a6', '#ff5858']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.acceptGradient}
            >
              <Text style={styles.acceptIcon}>🎮</Text>
              <Text style={styles.acceptText}>I'll play this!</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Already Played Button */}
          <TouchableOpacity
            style={styles.alreadyPlayedButton}
            onPress={onAlreadyPlayed}
            activeOpacity={0.8}
            disabled={isSwapping}
          >
            {isSwapping ? (
              <ActivityIndicator color="#a0a0a0" size="small" />
            ) : (
              <>
                <Text style={styles.alreadyPlayedIcon}>✓</Text>
                <Text style={styles.alreadyPlayedText}>Already played</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Match score bar */}
        <View style={styles.matchScoreContainer}>
          <View style={styles.matchScoreBar}>
            <LinearGradient
              colors={['#4ade80', '#22c55e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.matchScoreFill, { width: `${matchPercent}%` }]}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 8,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardTopPick: {
    borderColor: 'rgba(248, 87, 166, 0.5)',
    borderWidth: 2,
  },
  topPickGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    borderRadius: 20,
  },
  topPickBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 10,
  },
  topPickGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  topPickIcon: {
    fontSize: 14,
  },
  topPickText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  thumbnailContainer: {
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  thumbnailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  thumbnailLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchBadgeOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.5)',
  },
  matchTextOverlay: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4ade80',
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  platformIcons: {
    fontSize: 16,
  },
  platforms: {
    fontSize: 14,
    color: '#909090',
    fontWeight: '500',
  },
  description: {
    fontSize: 16,
    color: '#c0c0c0',
    lineHeight: 24,
    marginBottom: 18,
  },
  explanationBox: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    borderLeftWidth: 4,
    borderLeftColor: '#f857a6',
    overflow: 'hidden',
  },
  explanationLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f857a6',
    marginBottom: 12,
  },
  explanationPoints: {
    gap: 8,
  },
  explanationPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  explanationBullet: {
    fontSize: 14,
    marginTop: 1,
  },
  explanationText: {
    fontSize: 14,
    color: '#e0e0e0',
    lineHeight: 20,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  metaIcon: {
    fontSize: 14,
  },
  metaText: {
    fontSize: 13,
    color: '#a0a0a0',
    fontWeight: '500',
  },
  subscriptionSection: {
    marginBottom: 18,
  },
  subscriptionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a0a0a0',
    marginBottom: 10,
  },
  subscriptionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subscriptionChip: {
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  subscriptionChipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  subscriptionChipIcon: {
    fontSize: 14,
  },
  subscriptionChipText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  actionsContainer: {
    gap: 12,
  },
  acceptButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#f857a6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  acceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  alreadyPlayedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  alreadyPlayedIcon: {
    fontSize: 16,
    color: '#4ade80',
  },
  alreadyPlayedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#a0a0a0',
  },
  acceptIcon: {
    fontSize: 20,
  },
  acceptText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  matchScoreContainer: {
    marginTop: 18,
  },
  matchScoreBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  matchScoreFill: {
    height: '100%',
    borderRadius: 2,
  },
});

export default GameCard;
