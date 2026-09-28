/**
 * PlayNext Game Card Component
 *
 * Displays a single game recommendation with details and actions.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
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
import ShimmerBlock from './ShimmerBlock';
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
    platforms: ['pc', 'console'], // Available on PC and Xbox Console
  },
  playstation_plus: {
    name: 'PlayStation Plus',
    platforms: ['console'], // PlayStation only
  },
  ea_play: {
    name: 'EA Play',
    platforms: ['pc', 'console'], // Available on PC, Xbox, PlayStation
  },
  ubisoft_plus: {
    name: 'Ubisoft+',
    platforms: ['pc', 'console'], // PC and consoles
  },
  nintendo_switch_online: {
    name: 'Nintendo Switch Online',
    platforms: ['handheld'], // Nintendo Switch
  },
  netflix_games: {
    name: 'Netflix Games',
    platforms: ['mobile'], // Mobile only
  },
  amazon_luna: {
    name: 'Amazon Luna',
    platforms: ['pc', 'mobile'], // Cloud gaming on multiple devices
  },
  apple_arcade: {
    name: 'Apple Arcade',
    platforms: ['mobile', 'pc'], // iOS, macOS, tvOS
  },
  default: {
    name: 'Subscription',
    platforms: [],
  },
};

// Store/platform branding for purchase links
const STORE_CONFIG = {
  steam: {
    name: 'Steam',
    platforms: ['pc'],
  },
  playstation: {
    name: 'PlayStation',
    platforms: ['console'],
  },
  xbox: {
    name: 'Xbox',
    platforms: ['console', 'pc'],
  },
  nintendo: {
    name: 'Nintendo',
    platforms: ['handheld'],
  },
  epic: {
    name: 'Epic Games',
    platforms: ['pc'],
  },
  gog: {
    name: 'GOG',
    platforms: ['pc'],
  },
  ios: {
    name: 'App Store',
    platforms: ['mobile'],
  },
  android: {
    name: 'Google Play',
    platforms: ['mobile'],
  },
  battlenet: {
    name: 'Battle.net',
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
          {imageLoading && <ShimmerBlock style={styles.thumbnailShimmer} />}
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
            darkenOnPress
            pressedOverlayStyle={{ borderRadius: styles.acceptButton.borderRadius }}
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
              {game.explanation.time_fit && (
                <View style={styles.explanationPoint}>
                  <Ionicons name="timer-outline" size={14} color="#a0a0a0" style={styles.explanationIcon} />
                  <Text style={styles.explanationText}>{game.explanation.time_fit}</Text>
                </View>
              )}
              {game.explanation.session_fit && (
                <View style={styles.explanationPoint}>
                  <Ionicons name="hourglass-outline" size={14} color="#a0a0a0" style={styles.explanationIcon} />
                  <Text style={styles.explanationText}>{game.explanation.session_fit}</Text>
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
                        try {
                          await Linking.openURL(affiliateUrl);
                        } catch (err) {
                          Alert.alert('Error', `Could not open ${config.name}.`);
                        }
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

        {/* Secondary actions — labeled (P0.5) */}
        <View style={styles.secondaryActions}>
          <PressableScale
            style={[styles.secondaryButton, isSwapping && styles.buttonDisabled]}
            onPress={isSwapping ? undefined : onAlreadyPlayed}
            disabled={isSwapping}
            accessibilityLabel="Played it"
          >
            {isSwapping ? (
              <ActivityIndicator color="#a0a0a0" size="small" />
            ) : (
              <>
                <Ionicons name="game-controller-outline" size={15} color="#c2c2d2" />
                <Text style={styles.secondaryButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Played it</Text>
              </>
            )}
          </PressableScale>
          {onNotForMe && (
            <PressableScale
              style={[styles.secondaryButton, styles.notForMeButton, isSwapping && styles.buttonDisabled]}
              onPress={isSwapping ? undefined : onNotForMe}
              disabled={isSwapping}
              accessibilityLabel="Not for me"
            >
              <Ionicons name="thumbs-down-outline" size={15} color="#f89b9b" />
              <Text style={styles.notForMeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Not for me</Text>
            </PressableScale>
          )}
          {onSave && (
            <PressableScale
              style={[styles.secondaryButton, styles.saveButton, isSwapping && styles.buttonDisabled]}
              onPress={isSwapping ? undefined : onSave}
              disabled={isSwapping}
              accessibilityLabel="Save"
            >
              <Ionicons name="bookmark-outline" size={15} color="#f5b544" />
              <Text style={styles.saveButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Save</Text>
            </PressableScale>
          )}
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
  thumbnailShimmer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
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
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#c2c2d2',
  },
  notForMeButton: {
    borderColor: 'rgba(248,113,113,0.35)',
  },
  notForMeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f89b9b',
  },
  saveButton: {
    borderColor: 'rgba(245,158,11,0.4)',
    backgroundColor: 'rgba(245,158,11,0.05)',
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f5b544',
  },
  acceptText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default GameCard;
