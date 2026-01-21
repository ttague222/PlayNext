/**
 * GameDetailScreen
 *
 * Displays full game details for a saved game from collections.
 * Fetches game data from API and shows purchase options.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../services/api';
import { getGameImage } from '../services/gameImages';
import {
  generateStoreAffiliateLink,
  generateSubscriptionAffiliateLink,
  trackAffiliateClick,
} from '../services/affiliateService';
import { useSavedGames, BUCKET_CONFIG, BUCKET_TYPES } from '../context/SavedGamesContext';

const PLATFORM_LABELS = {
  pc: 'PC',
  console: 'Console',
  handheld: 'Handheld',
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

const GameDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { gameId, gameTitle, bucketType, savedGameData } = route.params || {};
  const { moveGame, removeGameFromBucket } = useSavedGames();

  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [fallbackColors, setFallbackColors] = useState(['#667eea', '#764ba2']);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    fetchGameDetails();
  }, [gameId]);

  const fetchGameDetails = async () => {
    if (!gameId) {
      setError('No game ID provided');
      setLoading(false);
      return;
    }

    try {
      const gameData = await api.getGame(gameId);
      setGame(gameData);

      // Fetch image
      const imageResult = await getGameImage(gameId, gameData.title || gameTitle);
      setImageUrl(imageResult.imageUrl);
      setFallbackColors(imageResult.fallbackColors);
    } catch (err) {
      console.error('Error fetching game details:', err);
      console.error('Game ID:', gameId);
      console.error('Error message:', err?.message);
      console.error('Error response:', err?.response?.status, err?.response?.data);

      // Try to use saved game data as fallback (for offline/local storage)
      if (savedGameData && (savedGameData.platforms || savedGameData.store_links)) {
        // We have full game data from local storage
        setGame({
          title: savedGameData.game_title || gameTitle,
          platforms: savedGameData.platforms,
          description_short: savedGameData.description_short,
          store_links: savedGameData.store_links,
          subscription_services: savedGameData.subscription_services,
          time_to_fun: savedGameData.time_to_fun,
          stop_friendliness: savedGameData.stop_friendliness,
          fun_fact: savedGameData.fun_fact,
          genres: savedGameData.genres,
          moods: savedGameData.moods,
          play_style: savedGameData.play_style,
          energy_level: savedGameData.energy_level,
        });
        // Still try to fetch image
        try {
          const imageResult = await getGameImage(gameId, savedGameData.game_title || gameTitle);
          setImageUrl(imageResult.imageUrl);
          setFallbackColors(imageResult.fallbackColors);
        } catch {
          // Image fetch failed, use defaults
        }
      } else if (gameTitle) {
        // Minimal fallback - only title available
        setGame({ title: gameTitle });
        // Still try to fetch image
        try {
          const imageResult = await getGameImage(gameId, gameTitle);
          setImageUrl(imageResult.imageUrl);
          setFallbackColors(imageResult.fallbackColors);
        } catch {
          // Image fetch failed, use defaults
        }
      } else {
        setError('Failed to load game details');
      }
    } finally {
      setLoading(false);
      setImageLoading(false);
    }
  };

  const handleMoveGame = () => {
    const otherBuckets = Object.values(BUCKET_TYPES).filter((t) => t !== bucketType);
    const options = otherBuckets.map((type) => ({
      text: BUCKET_CONFIG[type].name,
      onPress: async () => {
        try {
          await moveGame(bucketType, type, gameId);
          navigation.goBack();
        } catch (err) {
          console.error('Error moving game:', err);
          Alert.alert('Error', 'Failed to move game');
        }
      },
    }));

    Alert.alert(
      'Move to Collection',
      `Move "${game?.title || gameTitle}" to:`,
      [...options, { text: 'Cancel', style: 'cancel' }]
    );
  };

  const handleRemoveGame = () => {
    Alert.alert(
      'Remove Game',
      `Remove "${game?.title || gameTitle}" from your collection?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeGameFromBucket(bucketType, gameId);
              navigation.goBack();
            } catch (err) {
              console.error('Error removing game:', err);
              Alert.alert('Error', 'Failed to remove game');
            }
          },
        },
      ]
    );
  };

  const handleStorePress = (store, url) => {
    const config = STORE_CONFIG[store];
    const affiliateUrl = generateStoreAffiliateLink(store, url, gameId);

    Alert.alert(
      'Leave App?',
      `You're about to visit ${config.name} to purchase this game. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Continue',
          onPress: async () => {
            trackAffiliateClick('store', store, gameId, game?.title || gameTitle);
            await Linking.openURL(affiliateUrl);
          },
        },
      ]
    );
  };

  const handleSubscriptionPress = async (service) => {
    const affiliateUrl = generateSubscriptionAffiliateLink(service, game?.title || gameTitle);
    if (affiliateUrl) {
      trackAffiliateClick('subscription', service, gameId, game?.title || gameTitle);
      await Linking.openURL(affiliateUrl);
    }
  };

  // Derive platforms from store links
  const validatedPlatforms = React.useMemo(() => {
    if (!game?.store_links || Object.keys(game.store_links).length === 0) {
      return game?.platforms || [];
    }

    const availableStores = Object.keys(game.store_links).filter(store => game.store_links[store]);
    const platformsFromStores = new Set();

    availableStores.forEach(store => {
      const storeConfig = STORE_CONFIG[store];
      if (storeConfig?.platforms) {
        storeConfig.platforms.forEach(platform => platformsFromStores.add(platform));
      }
    });

    const derivedPlatforms = Array.from(platformsFromStores);
    return derivedPlatforms.length > 0 ? derivedPlatforms : game?.platforms || [];
  }, [game?.platforms, game?.store_links]);

  if (loading) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#f857a6" size="large" />
            <Text style={styles.loadingText}>Loading game details...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <View style={styles.errorContainer}>
            <Text style={styles.errorEmoji}>😕</Text>
            <Text style={styles.errorTitle}>Couldn't Load Game</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchGameDetails}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const displayTitle = game?.title || gameTitle || 'Unknown Game';

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerAction} onPress={handleMoveGame}>
              <Ionicons name="swap-horizontal" size={22} color="#808080" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerAction} onPress={handleRemoveGame}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
                <Text style={styles.thumbnailTitle}>{displayTitle}</Text>
              </LinearGradient>
            )}
            {imageLoading && (
              <View style={styles.thumbnailLoading}>
                <ActivityIndicator color="#ffffff" size="small" />
              </View>
            )}
          </View>

          {/* Title & Platforms */}
          <Text style={styles.title}>{displayTitle}</Text>
          <Text style={styles.platforms}>
            {validatedPlatforms.map((p) => PLATFORM_LABELS[p] || p).join(' · ')}
          </Text>

          {/* Description */}
          {game?.description_short && (
            <Text style={styles.description}>{game.description_short}</Text>
          )}

          {/* Meta tags */}
          {(game?.time_to_fun || game?.stop_friendliness) && (
            <View style={styles.metaRow}>
              {game?.time_to_fun && (
                <View style={styles.metaTag}>
                  <Ionicons name="flash-outline" size={14} color="#a0a0a0" />
                  <Text style={styles.metaText}>
                    {TIME_TO_FUN_LABELS[game.time_to_fun] || 'Quick start'}
                  </Text>
                </View>
              )}
              {game?.stop_friendliness && (
                <View style={styles.metaTag}>
                  <Ionicons name="pause-circle-outline" size={14} color="#a0a0a0" />
                  <Text style={styles.metaText}>
                    {STOP_FRIENDLINESS_LABELS[game.stop_friendliness] || 'Flexible'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Fun Fact */}
          {game?.fun_fact && (
            <View style={styles.funFactBox}>
              <View style={styles.funFactHeader}>
                <Ionicons name="bulb-outline" size={16} color="#fbbf24" />
                <Text style={styles.funFactLabel}>Did you know?</Text>
              </View>
              <Text style={styles.funFactText}>{game.fun_fact}</Text>
            </View>
          )}

          {/* Subscription Services */}
          {game?.subscription_services?.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="ticket-outline" size={14} color="#a0a0a0" />
                <Text style={styles.sectionLabel}>Play with subscription</Text>
              </View>
              <View style={styles.chips}>
                {game.subscription_services.map((service) => {
                  const config = SUBSCRIPTION_CONFIG[service] || SUBSCRIPTION_CONFIG.default;
                  const affiliateUrl = generateSubscriptionAffiliateLink(service, game.title);

                  return (
                    <TouchableOpacity
                      key={service}
                      style={styles.chip}
                      onPress={() => handleSubscriptionPress(service)}
                      activeOpacity={affiliateUrl ? 0.8 : 1}
                      disabled={!affiliateUrl}
                    >
                      <LinearGradient
                        colors={config.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.chipGradient}
                      >
                        <Text style={styles.chipIcon}>{config.icon}</Text>
                        <Text style={[styles.chipText, { color: config.textColor }]}>
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
          {game?.store_links && Object.keys(game.store_links).length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="cart-outline" size={14} color="#a0a0a0" />
                <Text style={styles.sectionLabel}>Where to buy</Text>
              </View>
              <View style={styles.chips}>
                {Object.entries(game.store_links)
                  .filter(([, url]) => url)
                  .map(([store, url]) => {
                    const config = STORE_CONFIG[store];
                    if (!config) return null;

                    return (
                      <TouchableOpacity
                        key={store}
                        style={styles.chip}
                        onPress={() => handleStorePress(store, url)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={config.colors}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.chipGradient}
                        >
                          <Text style={[styles.chipText, { color: config.textColor }]}>
                            {config.name}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </View>
          )}

          {/* Collection badge */}
          {bucketType && BUCKET_CONFIG[bucketType] && (
            <View style={[styles.collectionBadge, { borderColor: `${BUCKET_CONFIG[bucketType].color}40` }]}>
              <View style={[styles.collectionBadgeIcon, { backgroundColor: `${BUCKET_CONFIG[bucketType].color}30` }]}>
                <Ionicons name={BUCKET_CONFIG[bucketType].icon} size={16} color={BUCKET_CONFIG[bucketType].color} />
              </View>
              <Text style={styles.collectionBadgeText}>
                In your {BUCKET_CONFIG[bucketType].name}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerAction: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#808080',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#808080',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(248, 87, 166, 0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f857a6',
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f857a6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  thumbnailContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
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
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  platforms: {
    fontSize: 14,
    color: '#909090',
    fontWeight: '500',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#c0c0c0',
    lineHeight: 24,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#a0a0a0',
    fontWeight: '500',
  },
  funFactBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#fbbf24',
  },
  funFactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  funFactLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fbbf24',
  },
  funFactText: {
    fontSize: 14,
    color: '#d0d0d0',
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a0a0a0',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  chipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 6,
  },
  chipIcon: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  collectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 10,
    gap: 10,
    borderWidth: 1,
  },
  collectionBadgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionBadgeText: {
    fontSize: 14,
    color: '#808080',
    fontWeight: '500',
  },
});

export default GameDetailScreen;
