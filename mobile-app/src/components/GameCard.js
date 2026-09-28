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
  Pressable,
  StyleSheet,
  Animated,
  Image,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import { getGameImage } from '../services/gameImages';
import {
  generateStoreAffiliateLink,
  generateSubscriptionAffiliateLink,
  trackAffiliateClick,
} from '../services/affiliateService';

const PLATFORM_LABELS = {
  pc: 'PC',
  console: 'Console',
  handheld: 'Switch',
  mobile: 'Mobile',
};


// Subscription service branding and platform mapping
const SUBSCRIPTION_CONFIG = {
  xbox_game_pass: {
    name: 'Xbox Game Pass',
    icon: '🟢',
    colors: ['#107C10', '#0e6b0e'],
    textColor: '#ffffff',
    platforms: ['pc', 'console'], // Available on PC and Xbox Console
  },
  playstation_plus: {
    name: 'PlayStation Plus',
    icon: '🔵',
    colors: ['#003087', '#00246d'],
    textColor: '#ffffff',
    platforms: ['console'], // PlayStation only
  },
  ea_play: {
    name: 'EA Play',
    icon: '⚽',
    colors: ['#ff4747', '#cc3939'],
    textColor: '#ffffff',
    platforms: ['pc', 'console'], // Available on PC, Xbox, PlayStation
  },
  ubisoft_plus: {
    name: 'Ubisoft+',
    icon: '🎯',
    colors: ['#0070ff', '#005acc'],
    textColor: '#ffffff',
    platforms: ['pc', 'console'], // PC and consoles
  },
  nintendo_switch_online: {
    name: 'Nintendo Switch Online',
    icon: '🔴',
    colors: ['#e60012', '#cc0010'],
    textColor: '#ffffff',
    platforms: ['handheld'], // Nintendo Switch
  },
  netflix_games: {
    name: 'Netflix Games',
    icon: '📺',
    colors: ['#E50914', '#B20710'],
    textColor: '#ffffff',
    platforms: ['mobile'], // Mobile only
  },
  amazon_luna: {
    name: 'Amazon Luna',
    icon: '🌙',
    colors: ['#00A8E1', '#0078A8'],
    textColor: '#ffffff',
    platforms: ['pc', 'mobile'], // Cloud gaming on multiple devices
  },
  apple_arcade: {
    name: 'Apple Arcade',
    icon: '🍎',
    colors: ['#FA243C', '#C41E32'],
    textColor: '#ffffff',
    platforms: ['mobile', 'pc'], // iOS, macOS, tvOS
  },
  default: {
    name: 'Subscription',
    icon: '✨',
    colors: ['#6366f1', '#4f46e5'],
    textColor: '#ffffff',
    platforms: [],
  },
};

// Store/platform branding for purchase links
const STORE_CONFIG = {
  steam: {
    name: 'Steam',
    colors: ['#1b2838', '#2a475e'],
    textColor: '#ffffff',
    platforms: ['pc'],
  },
  playstation: {
    name: 'PlayStation',
    colors: ['#003087', '#00246d'],
    textColor: '#ffffff',
    platforms: ['console'],
  },
  xbox: {
    name: 'Xbox',
    colors: ['#107C10', '#0e6b0e'],
    textColor: '#ffffff',
    platforms: ['console', 'pc'],
  },
  nintendo: {
    name: 'Nintendo',
    colors: ['#e60012', '#cc0010'],
    textColor: '#ffffff',
    platforms: ['handheld'],
  },
  epic: {
    name: 'Epic Games',
    colors: ['#313131', '#1a1a1a'],
    textColor: '#ffffff',
    platforms: ['pc'],
  },
  gog: {
    name: 'GOG',
    colors: ['#7b5794', '#5c3d73'],
    textColor: '#ffffff',
    platforms: ['pc'],
  },
  ios: {
    name: 'App Store',
    colors: ['#007AFF', '#0056CC'],
    textColor: '#ffffff',
    platforms: ['mobile'],
  },
  android: {
    name: 'Google Play',
    colors: ['#01875f', '#016847'],
    textColor: '#ffffff',
    platforms: ['mobile'],
  },
  battlenet: {
    name: 'Battle.net',
    colors: ['#148eff', '#0074e0'],
    textColor: '#ffffff',
    platforms: ['pc'],
  },
};

// Map user platform preferences to store platforms
const PLATFORM_TO_STORES = {
  pc: ['steam', 'epic', 'gog', 'battlenet', 'xbox'],
  console: ['playstation', 'xbox'],
  handheld: ['nintendo'],
  mobile: ['ios', 'android'],
};

const GameCard = ({ game, rank, onAccept, onAlreadyPlayed, onNotForMe, onSave, isSwapping, isAccepting, userPlatforms }) => {
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

  const matchPercent = Math.round((game.match_score || 0.85) * 100);

  // Derive platforms from store links AND subscription services
  const validatedPlatforms = React.useMemo(() => {
    const hasStoreLinks = game.store_links && Object.keys(game.store_links).length > 0;
    const hasSubscriptions = game.subscription_services && game.subscription_services.length > 0;

    if (!hasStoreLinks && !hasSubscriptions) {
      return game.platforms; // No store links or subscriptions, show all platforms from data
    }

    const platformsSet = new Set();

    // Add platforms from store links
    if (hasStoreLinks) {
      const availableStores = Object.keys(game.store_links).filter(store => game.store_links[store]);
      availableStores.forEach(store => {
        const storeConfig = STORE_CONFIG[store];
        if (storeConfig?.platforms) {
          storeConfig.platforms.forEach(platform => platformsSet.add(platform));
        }
      });
    }

    // Add platforms from subscription services
    if (hasSubscriptions) {
      game.subscription_services.forEach(service => {
        const subConfig = SUBSCRIPTION_CONFIG[service];
        if (subConfig?.platforms) {
          subConfig.platforms.forEach(platform => platformsSet.add(platform));
        }
      });
    }

    // Return derived platforms if we have any, otherwise fall back to game.platforms
    const derivedPlatforms = Array.from(platformsSet);
    return derivedPlatforms.length > 0 ? derivedPlatforms : game.platforms;
  }, [game.platforms, game.store_links, game.subscription_services]);

  // Store prioritization by user platform preferences (WHERE TO PLAY, P0.3)
  const availableStores = Object.entries(game.store_links || {})
    .filter(([, url]) => url)
    .map(([store]) => store);
  let prioritizedStores = [];
  let otherStores = [];
  if (userPlatforms && userPlatforms.length > 0) {
    const preferredStoreIds = new Set(
      userPlatforms.flatMap((platform) => PLATFORM_TO_STORES[platform] || [])
    );
    prioritizedStores = availableStores.filter((s) => preferredStoreIds.has(s));
    otherStores = availableStores.filter((s) => !preferredStoreIds.has(s));
  } else {
    prioritizedStores = availableStores;
  }
  const sortedStores = [...prioritizedStores, ...otherStores];

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
          {/* Hero scrim — soft darkening vignette, never opaque */}
          <LinearGradient
            colors={['transparent', 'rgba(15, 12, 41, 0.30)', 'rgba(15, 12, 41, 0.55)']}
            locations={[0.45, 0.78, 1]}
            style={styles.heroScrim}
            pointerEvents="none"
          />
          {/* Top Pick Badge - overlay on image */}
          {rank === 1 && (
            <View style={styles.topPickBadge}>
              <LinearGradient
                colors={['#f857a6', '#ff5858']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.topPickGradient}
              >
                <Ionicons name="star" size={14} color="#ffffff" />
                <Text style={styles.topPickText}>TOP PICK</Text>
              </LinearGradient>
            </View>
          )}
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>{game.title}</Text>
            <View style={styles.matchPill} testID="match-pill">
              <Text style={styles.matchPillText}>{matchPercent}% match</Text>
            </View>
          </View>
          <Text style={styles.platforms}>
            {validatedPlatforms.map((p) => PLATFORM_LABELS[p] || p).join(' · ')}
          </Text>
        </View>

        {/* Description */}
        <Text style={styles.description}>{game.description_short}</Text>

        {/* Primary CTA — above the fold (P0.1) */}
        <View testID="card-cta">
          <PressableScale
            style={[styles.acceptButton, (isSwapping || isAccepting) && styles.buttonDisabled]}
            onPress={(isSwapping || isAccepting) ? undefined : onAccept}
            disabled={isSwapping || isAccepting}
            accessibilityLabel="I'll play this"
          >
            <LinearGradient
              colors={(isSwapping || isAccepting) ? ['#888', '#666'] : ['#f857a6', '#ff5858']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.acceptGradient}
            >
              <Ionicons name="game-controller" size={20} color="#ffffff" />
              <Text style={styles.acceptText}>{isAccepting ? 'Saving...' : "I'll play this!"}</Text>
            </LinearGradient>
          </PressableScale>
        </View>

        {/* Why this fits - Simplified with icons */}
        {game.explanation && (
          <View style={styles.explanationBox} testID="card-why">
            <View style={styles.explanationHeader}>
              <Ionicons name="bulb-outline" size={16} color="#f857a6" />
              <Text style={styles.explanationLabel}>Why this fits</Text>
            </View>
            <View style={styles.explanationPoints}>
              {game.explanation.mood_fit && (
                <View style={styles.explanationPoint}>
                  <Ionicons name="sparkles-outline" size={14} color="#a0a0a0" style={styles.explanationIcon} />
                  <Text style={styles.explanationText}>{game.explanation.mood_fit}</Text>
                </View>
              )}
              {game.explanation.stop_fit && (
                <View style={styles.explanationPoint}>
                  <Ionicons name="time-outline" size={14} color="#a0a0a0" style={styles.explanationIcon} />
                  <Text style={styles.explanationText}>{game.explanation.stop_fit}</Text>
                </View>
              )}
              {game.explanation.style_fit && (
                <View style={styles.explanationPoint}>
                  <Ionicons name="checkmark-circle-outline" size={14} color="#a0a0a0" style={styles.explanationIcon} />
                  <Text style={styles.explanationText}>{game.explanation.style_fit}</Text>
                </View>
              )}
              {game.explanation.library_fit && (
                <View style={styles.explanationPoint}>
                  <Ionicons name="logo-steam" size={14} color="#4ade80" style={styles.explanationIcon} />
                  <Text style={styles.explanationText}>{game.explanation.library_fit}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Meta tags */}
        <View style={styles.metaRow}>
          {game.in_library && (
            <View style={[styles.metaTag, styles.libraryTag]}>
              <Ionicons name="logo-steam" size={14} color="#4ade80" />
              <Text style={[styles.metaText, styles.libraryTagText]}>In your library</Text>
            </View>
          )}
        </View>

        {/* WHERE TO PLAY — one demoted commerce row (P0.3) */}
        {(game.subscription_services?.length > 0 || sortedStores.length > 0) && (
          <View style={styles.whereToPlaySection}>
            <Text style={styles.whereToPlayLabel}>WHERE TO PLAY</Text>
            <View style={styles.whereToPlayChips}>
              {game.subscription_services?.map((service) => {
                const config = SUBSCRIPTION_CONFIG[service] || SUBSCRIPTION_CONFIG.default;
                const affiliateUrl = generateSubscriptionAffiliateLink(service, game.title);
                return (
                  <PressableScale
                    key={service}
                    style={[styles.ghostChip, styles.ghostChipIncluded]}
                    disabled={!affiliateUrl}
                    onPress={async () => {
                      if (affiliateUrl) {
                        trackAffiliateClick('subscription', service, game.game_id, game.title);
                        await Linking.openURL(affiliateUrl);
                      }
                    }}
                    accessibilityLabel={`Play on ${config.name}`}
                  >
                    <View style={styles.includedDot} />
                    <Text style={styles.ghostChipTextIncluded}>{config.name} · included</Text>
                  </PressableScale>
                );
              })}
              {sortedStores.map((store) => {
                const config = STORE_CONFIG[store];
                if (!config) return null;
                const affiliateUrl = generateStoreAffiliateLink(
                  store, game.store_links[store], game.game_id
                );
                const isPrioritized = prioritizedStores.includes(store);
                return (
                  <PressableScale
                    key={store}
                    style={[
                      styles.ghostChip,
                      !isPrioritized && userPlatforms?.length > 0 && styles.ghostChipDimmed,
                    ]}
                    onPress={async () => {
                      trackAffiliateClick('store', store, game.game_id, game.title);
                      try {
                        await Linking.openURL(affiliateUrl);
                      } catch (err) {
                        Alert.alert('Error', `Could not open ${config.name}.`);
                      }
                    }}
                    accessibilityLabel={`Buy on ${config.name}`}
                  >
                    <Text style={styles.ghostChipText}>{config.name}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {/* Secondary actions row */}
          <View style={styles.secondaryActions}>
            {/* Already Played Button */}
            <Pressable
              style={({ pressed }) => [
                styles.alreadyPlayedButton,
                isSwapping && styles.buttonDisabled,
                pressed && !isSwapping && styles.buttonPressed,
              ]}
              onPress={isSwapping ? undefined : onAlreadyPlayed}
            >
              {isSwapping ? (
                <ActivityIndicator color="#a0a0a0" size="small" />
              ) : (
                <>
                  <Text style={styles.alreadyPlayedIcon}>✓</Text>
                  <Text style={styles.alreadyPlayedText}>Already played</Text>
                </>
              )}
            </Pressable>

            {/* Not For Me Button — opens the "Why not?" sheet */}
            {onNotForMe && (
              <TouchableOpacity
                style={[
                  styles.notForMeButton,
                  isSwapping && styles.buttonDisabled,
                ]}
                onPress={onNotForMe}
                disabled={isSwapping}
                activeOpacity={0.7}
                accessibilityLabel="Not for me"
              >
                <Ionicons name="thumbs-down-outline" size={18} color="#f87171" />
              </TouchableOpacity>
            )}

            {/* Save Button */}
            {onSave && (
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  isSwapping && styles.buttonDisabled,
                ]}
                onPress={onSave}
                disabled={isSwapping}
                activeOpacity={0.7}
              >
                <Ionicons name="bookmark-outline" size={18} color="#f59e0b" />
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            )}
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
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 5,
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
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.35)',
    flexShrink: 0,
  },
  matchPillText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
    letterSpacing: -0.5,
    flexShrink: 1,
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
    padding: 14,
    marginBottom: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 18,
    overflow: 'hidden',
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  explanationLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f857a6',
  },
  explanationPoints: {
    gap: 6,
  },
  explanationPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  explanationIcon: {
    marginTop: 2,
  },
  explanationText: {
    fontSize: 13,
    color: '#d0d0d0',
    lineHeight: 18,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: '#a0a0a0',
    fontWeight: '500',
  },
  libraryTag: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  libraryTagText: {
    color: '#4ade80',
  },
  whereToPlaySection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 18,
    marginBottom: 16,
    gap: 12,
  },
  whereToPlayLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: '#8a8aa5',
  },
  whereToPlayChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ghostChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  ghostChipIncluded: {
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  ghostChipDimmed: {
    opacity: 0.5,
  },
  includedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  ghostChipText: {
    fontSize: 13,
    color: '#b8b8c8',
  },
  ghostChipTextIncluded: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dde9e0',
  },
  actionsContainer: {},
  acceptButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#f857a6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    marginBottom: 18,
  },
  acceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  alreadyPlayedButton: {
    flex: 1,
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
  notForMeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: 6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f59e0b',
  },
  acceptText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});

export default GameCard;
