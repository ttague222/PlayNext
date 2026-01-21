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
};

// Map user platform preferences to store platforms
const PLATFORM_TO_STORES = {
  pc: ['steam', 'epic', 'gog', 'xbox'],
  console: ['playstation', 'xbox'],
  handheld: ['nintendo'],
  mobile: ['ios', 'android'],
};

const GameCard = ({ game, rank, onAccept, onAlreadyPlayed, onSave, isSwapping, isAccepting, userPlatforms }) => {
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
                <Ionicons name="star" size={14} color="#ffffff" />
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
          <Text style={styles.platforms}>
            {validatedPlatforms.map((p) => PLATFORM_LABELS[p] || p).join(' · ')}
          </Text>
        </View>

        {/* Description */}
        <Text style={styles.description}>{game.description_short}</Text>

        {/* Why this fits - Simplified with icons */}
        {game.explanation && (
          <View style={styles.explanationBox}>
            <LinearGradient
              colors={['rgba(248, 87, 166, 0.15)', 'rgba(255, 88, 88, 0.05)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
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
            </View>
          </View>
        )}

        {/* Meta tags */}
        <View style={styles.metaRow}>
          <View style={styles.metaTag}>
            <Ionicons name="flash-outline" size={14} color="#a0a0a0" />
            <Text style={styles.metaText}>
              {TIME_TO_FUN_LABELS[game.time_to_fun] || 'Quick start'}
            </Text>
          </View>
          <View style={styles.metaTag}>
            <Ionicons name="pause-circle-outline" size={14} color="#a0a0a0" />
            <Text style={styles.metaText}>
              {STOP_FRIENDLINESS_LABELS[game.stop_friendliness] || 'Flexible'}
            </Text>
          </View>
        </View>

        {/* Subscription Services */}
        {game.subscription_services?.length > 0 && (
          <View style={styles.subscriptionSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="ticket-outline" size={14} color="#a0a0a0" />
              <Text style={styles.subscriptionLabel}>Play with subscription</Text>
            </View>
            <View style={styles.subscriptionChips}>
              {game.subscription_services.map((service) => {
                const config = SUBSCRIPTION_CONFIG[service] || SUBSCRIPTION_CONFIG.default;
                const affiliateUrl = generateSubscriptionAffiliateLink(service, game.title);

                const handleSubscriptionPress = async () => {
                  if (affiliateUrl) {
                    trackAffiliateClick('subscription', service, game.game_id, game.title);
                    await Linking.openURL(affiliateUrl);
                  }
                };

                return (
                  <TouchableOpacity
                    key={service}
                    style={styles.subscriptionChip}
                    onPress={handleSubscriptionPress}
                    activeOpacity={affiliateUrl ? 0.8 : 1}
                    disabled={!affiliateUrl}
                  >
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
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Store Links */}
        {game.store_links && Object.keys(game.store_links).length > 0 && (
          <View style={styles.storeSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cart-outline" size={14} color="#a0a0a0" />
              <Text style={styles.storeLabel}>Where to buy</Text>
            </View>
            <View style={styles.storeChips}>
              {(() => {
                // Get available stores from store_links
                const availableStores = Object.entries(game.store_links)
                  .filter(([, url]) => url)
                  .map(([store]) => store);

                // Prioritize stores based on user platform preferences
                let prioritizedStores = [];
                let otherStores = [];

                if (userPlatforms && userPlatforms.length > 0) {
                  // Get stores that match user's platform preferences
                  const preferredStoreIds = new Set(
                    userPlatforms.flatMap((platform) => PLATFORM_TO_STORES[platform] || [])
                  );
                  prioritizedStores = availableStores.filter((store) =>
                    preferredStoreIds.has(store)
                  );
                  otherStores = availableStores.filter(
                    (store) => !preferredStoreIds.has(store)
                  );
                } else {
                  prioritizedStores = availableStores;
                }

                // Show prioritized stores first, then others
                const sortedStores = [...prioritizedStores, ...otherStores];

                return sortedStores.map((store, index) => {
                  const config = STORE_CONFIG[store];
                  if (!config) return null;
                  const originalUrl = game.store_links[store];
                  const affiliateUrl = generateStoreAffiliateLink(store, originalUrl, game.game_id);
                  const isPrioritized = prioritizedStores.includes(store);

                  const handleStorePress = () => {
                    Alert.alert(
                      'Leave App?',
                      `You're about to visit ${config.name} to purchase this game. Continue?`,
                      [
                        {
                          text: 'Cancel',
                          style: 'cancel',
                        },
                        {
                          text: 'Yes, Continue',
                          onPress: async () => {
                            // Track the click for analytics
                            trackAffiliateClick('store', store, game.game_id, game.title);
                            // Open the affiliate-wrapped URL
                            await Linking.openURL(affiliateUrl);
                          },
                        },
                      ]
                    );
                  };

                  return (
                    <TouchableOpacity
                      key={store}
                      style={[
                        styles.storeChip,
                        !isPrioritized && userPlatforms?.length > 0 && styles.storeChipDimmed,
                      ]}
                      onPress={handleStorePress}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={config.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.storeChipGradient}
                      >
                        <Text style={[styles.storeChipText, { color: config.textColor }]}>
                          {config.name}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.acceptButton,
              (isSwapping || isAccepting) && styles.buttonDisabled,
              pressed && !isSwapping && !isAccepting && styles.buttonPressed,
            ]}
            onPress={(isSwapping || isAccepting) ? undefined : onAccept}
            disabled={isSwapping || isAccepting}
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
          </Pressable>

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
    borderLeftWidth: 3,
    borderLeftColor: '#f857a6',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  subscriptionSection: {
    marginBottom: 16,
  },
  subscriptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a0a0a0',
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
  storeSection: {
    marginBottom: 16,
  },
  storeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a0a0a0',
  },
  storeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  storeChip: {
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  storeChipDimmed: {
    opacity: 0.5,
  },
  storeChipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  storeChipText: {
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
