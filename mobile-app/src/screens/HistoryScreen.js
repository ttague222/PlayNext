/**
 * PlayNxt My Games Screen (Secondary Tab)
 *
 * Unified game library - combines collections and history.
 *
 * Features:
 * - Collection cards (Backlog, Playing, Played, Not For Me)
 * - Recently added games across all collections
 * - Quick actions to move games between collections
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlatList } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import { useRecommendation } from '../context/RecommendationContext';
import { useSavedGames, BUCKET_CONFIG, BUCKET_TYPES } from '../context/SavedGamesContext';
import api from '../services/api';
import { smartHistoryState, smartHistoryRowAction } from '../utils/premiumGating';

// Constants for layout
const HORIZONTAL_PADDING = 24;
const GRID_GAP = 12;

const HistoryScreen = () => {
  const navigation = useNavigation();
  const { user, isAnonymous } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const { hasFeature, isPremium } = usePremium();
  const { seedFromGame } = useRecommendation();
  const {
    buckets,
    fetchBuckets,
    bucketsVersion,
    isUsingLocalStorage,
    getBucketWithGames,
  } = useSavedGames();

  // Smart History (premium)
  const [positiveSignals, setPositiveSignals] = useState([]);

  useEffect(() => {
    if (!isPremium || !hasFeature('smartHistory') || isAnonymous || !user) {
      setPositiveSignals([]);
      return;
    }
    let cancelled = false;
    api.getPositiveSignals(20)
      .then((data) => { if (!cancelled) setPositiveSignals(data || []); })
      .catch(() => { if (!cancelled) setPositiveSignals([]); });
    return () => { cancelled = true; };
  }, [isPremium, hasFeature, isAnonymous, user]);

  const handleFindSimilar = useCallback((signal) => {
    // The signal carries the original session context; seed a fresh
    // recommendation session with the game's tags if we have them.
    seedFromGame({ genre_tags: signal?.context?.play_style_selected
      ? [signal.context.play_style_selected]
      : [] });
    navigation.navigate('Main', { screen: 'Play' });
  }, [seedFromGame, navigation]);

  // Calculate card width based on screen size (2 columns with gap)
  const cardWidth = (screenWidth - (HORIZONTAL_PADDING * 2) - GRID_GAP) / 2;

  const [recentGames, setRecentGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch buckets and recent games when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [bucketsVersion])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      await fetchBuckets();
      await loadRecentGames();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadRecentGames = async () => {
    try {
      // Get games from all buckets and sort by added_at
      const allGames = [];

      for (const bucketType of Object.values(BUCKET_TYPES)) {
        try {
          const bucketData = await getBucketWithGames(bucketType, 10);
          if (bucketData?.games) {
            bucketData.games.forEach((game) => {
              allGames.push({
                ...game,
                bucketType,
                bucketConfig: BUCKET_CONFIG[bucketType],
              });
            });
          }
        } catch (err) {
          // Bucket might be empty, continue
        }
      }

      // Sort by added_at (most recent first) and take top 10
      allGames.sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
      setRecentGames(allGames.slice(0, 10));
    } catch (err) {
      console.error('Failed to load recent games:', err);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleBucketPress = (bucketType) => {
    const config = BUCKET_CONFIG[bucketType];
    navigation.navigate('BucketDetail', {
      bucketType,
      bucketName: config.name,
      bucketIcon: config.icon,
      bucketColor: config.color,
      bucketDescription: config.description,
    });
  };

  const handleSignIn = () => {
    navigation.navigate('Profile');
  };

  const renderBucketCard = (bucketType) => {
    const config = BUCKET_CONFIG[bucketType];
    const bucket = buckets.find((b) => b.bucket_type === bucketType);
    const count = bucket?.game_count || 0;

    return (
      <TouchableOpacity
        key={bucketType}
        style={[styles.bucketCard, { width: cardWidth }]}
        onPress={() => handleBucketPress(bucketType)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[`${config.color}20`, `${config.color}08`]}
          style={styles.bucketCardGradient}
        >
          <View style={[styles.bucketIconContainer, { backgroundColor: `${config.color}30` }]}>
            <Ionicons name={config.icon} size={22} color={config.color} />
          </View>
          <Text style={styles.bucketName}>{config.name}</Text>
          <Text style={styles.bucketCount}>
            {count} game{count !== 1 ? 's' : ''}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderRecentGame = ({ item }) => {
    const config = item.bucketConfig;

    return (
      <TouchableOpacity
        style={styles.recentItem}
        onPress={() => handleBucketPress(item.bucketType)}
        activeOpacity={0.7}
      >
        <View style={[styles.recentBadge, { backgroundColor: `${config.color}30` }]}>
          <Ionicons name={config.icon} size={18} color={config.color} />
        </View>
        <View style={styles.recentInfo}>
          <Text style={styles.recentTitle} numberOfLines={1}>
            {item.game_title || item.title}
          </Text>
          <View style={styles.recentMeta}>
            <Text style={[styles.recentCollection, { color: config.color }]}>
              {config.name}
            </Text>
            <Text style={styles.recentSeparator}>·</Text>
            <Text style={styles.recentDate}>
              {new Date(item.added_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#505060" />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="library-outline" size={48} color="#606080" />
      </View>
      <Text style={styles.emptyTitle}>No Games Yet</Text>
      <Text style={styles.emptySubtitle}>
        Save games from recommendations to build your library.
        {'\n'}Tap the bookmark icon on any game card to save it.
      </Text>
    </View>
  );

  const totalGames = buckets.reduce((sum, b) => sum + (b.game_count || 0), 0);

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#808080"
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>My Games</Text>
            <Text style={styles.headerSubtitle}>
              {totalGames} game{totalGames !== 1 ? 's' : ''} saved
            </Text>
          </View>

          {/* Sync prompt for local storage */}
          {isUsingLocalStorage && totalGames > 0 && (
            <TouchableOpacity style={styles.syncPrompt} onPress={handleSignIn}>
              <Ionicons name="cloud-upload-outline" size={20} color="#f59e0b" />
              <Text style={styles.syncText}>Sign in to sync across devices</Text>
              <Ionicons name="chevron-forward" size={16} color="#f59e0b" />
            </TouchableOpacity>
          )}

          {/* Collection Cards Grid */}
          <View style={styles.collectionsSection}>
            <Text style={styles.sectionTitle}>Collections</Text>
            <View style={styles.bucketGrid}>
              {Object.values(BUCKET_TYPES).map(renderBucketCard)}
            </View>
          </View>

          {/* Smart History (Premium) */}
          {(() => {
            const smartState = smartHistoryState({
              isPremium,
              isAnonymous,
              hasSignedInUser: !!user,
              positiveSignalsCount: positiveSignals.length,
            });
            const rowAction = smartHistoryRowAction(smartState);
            const handleRowTap = () => {
              if (rowAction?.type === 'navigate') {
                navigation.navigate(rowAction.screen, rowAction.params);
              }
            };
            return (
          <View style={styles.smartHistorySection}>
            <Text style={styles.sectionTitle}>What's worked for you</Text>
            {smartState === 'teaser' ? (
              <TouchableOpacity
                style={styles.smartHistoryTeaser}
                onPress={handleRowTap}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.smartHistoryTitle}>Premium · See what's worked</Text>
                  <Text style={styles.smartHistoryBody}>
                    Reuse what fit you. Recommendations learn from your history.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#a78bfa" />
              </TouchableOpacity>
            ) : smartState === 'anonymous' ? (
              <TouchableOpacity
                style={styles.smartHistoryTeaser}
                onPress={handleRowTap}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.smartHistoryTitle}>Sign in to unlock</Text>
                  <Text style={styles.smartHistoryBody}>
                    Your history syncs across devices once you sign in.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#a78bfa" />
              </TouchableOpacity>
            ) : smartState === 'empty' ? (
              <Text style={styles.smartHistoryEmpty}>
                Mark a recommendation "This worked for me" and it'll show up here.
              </Text>
            ) : (
              positiveSignals.map((sig) => {
                const ctx = sig?.context || {};
                const contextLine =
                  ctx.time_selected && ctx.mood_selected
                    ? `Worked for a ${ctx.time_selected}-min ${String(ctx.mood_selected).replace('_', ' ')} session`
                    : 'Worked for you';
                return (
                  <View key={sig.signal_id} style={styles.signalRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.signalTitle}>{sig.game_title || sig.game_id}</Text>
                      <Text style={styles.signalContext}>{contextLine}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.findSimilarBtn}
                      onPress={() => handleFindSimilar(sig)}
                    >
                      <Text style={styles.findSimilarText}>Find similar</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
            );
          })()}

          {/* Recent Activity */}
          {recentGames.length > 0 && (
            <View style={styles.recentSection}>
              <Text style={styles.sectionTitle}>Recently Added</Text>
              {recentGames.map((game, index) => (
                <View key={`${game.game_id}-${index}`}>
                  {renderRecentGame({ item: game })}
                </View>
              ))}
            </View>
          )}

          {/* Empty state */}
          {!loading && totalGames === 0 && renderEmptyState()}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#808080',
  },
  syncPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    marginHorizontal: HORIZONTAL_PADDING,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: 10,
  },
  syncText: {
    flex: 1,
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '500',
  },
  collectionsSection: {
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#909090',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  bucketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: GRID_GAP,
  },
  bucketCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  bucketCardGradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    height: 140,
    justifyContent: 'flex-start',
  },
  bucketIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bucketName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  bucketCount: {
    fontSize: 13,
    color: '#808090',
  },
  recentSection: {
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  smartHistorySection: {
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: 20,
  },
  smartHistoryTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  smartHistoryTitle: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 4,
  },
  smartHistoryBody: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  smartHistoryEmpty: {
    color: '#9ca3af',
    fontSize: 13,
    paddingVertical: 12,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  signalTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500',
  },
  signalContext: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
  findSimilarBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
  },
  findSimilarText: {
    color: '#a78bfa',
    fontSize: 13,
    fontWeight: '500',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  recentBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recentInfo: {
    flex: 1,
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  recentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentCollection: {
    fontSize: 12,
    fontWeight: '500',
  },
  recentSeparator: {
    color: '#505060',
    marginHorizontal: 6,
    fontSize: 12,
  },
  recentDate: {
    fontSize: 12,
    color: '#606070',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 48,
    paddingTop: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#808080',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default HistoryScreen;
