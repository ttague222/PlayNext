/**
 * BucketDetailScreen
 *
 * Displays games in a specific bucket/collection.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSavedGames, BUCKET_CONFIG, BUCKET_TYPES } from '../context/SavedGamesContext';

const BucketDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { bucketType, bucketName, bucketEmoji, bucketColor } = route.params || {};
  const { getBucketWithGames, removeGameFromBucket, moveGame, bucketsVersion } = useSavedGames();

  const [bucket, setBucket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingGameId, setRemovingGameId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      fetchBucket();
    }, [bucketType, bucketsVersion])
  );

  const fetchBucket = async () => {
    if (!bucketType) return;

    try {
      const data = await getBucketWithGames(bucketType);
      setBucket(data);
    } catch (err) {
      console.error('Error fetching bucket:', err);
      Alert.alert('Error', 'Failed to load collection');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBucket();
  };

  const handleRemoveGame = async (gameId, gameTitle) => {
    Alert.alert(
      'Remove Game',
      `Remove "${gameTitle}" from ${bucketName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingGameId(gameId);
            try {
              await removeGameFromBucket(bucketType, gameId);
              // Update local state
              setBucket((prev) => ({
                ...prev,
                games: prev.games.filter((g) => g.game_id !== gameId),
                game_count: prev.game_count - 1,
              }));
            } catch (err) {
              console.error('Error removing game:', err);
              Alert.alert('Error', 'Failed to remove game');
            } finally {
              setRemovingGameId(null);
            }
          },
        },
      ]
    );
  };

  const handleMoveGame = (game) => {
    // Show options to move to other buckets
    const otherBuckets = Object.values(BUCKET_TYPES).filter((t) => t !== bucketType);
    const options = otherBuckets.map((type) => ({
      text: BUCKET_CONFIG[type].name,
      onPress: async () => {
        try {
          await moveGame(bucketType, type, game.game_id);
          // Update local state
          setBucket((prev) => ({
            ...prev,
            games: prev.games.filter((g) => g.game_id !== game.game_id),
            game_count: prev.game_count - 1,
          }));
        } catch (err) {
          console.error('Error moving game:', err);
          Alert.alert('Error', 'Failed to move game');
        }
      },
    }));

    Alert.alert(
      'Move to Collection',
      `Move "${game.game_title}" to:`,
      [...options, { text: 'Cancel', style: 'cancel' }]
    );
  };

  const renderGameItem = ({ item }) => (
    <View style={styles.gameItem}>
      <View style={styles.gameInfo}>
        <Text style={styles.gameTitle} numberOfLines={1}>
          {item.game_title}
        </Text>
        <Text style={styles.gameDate}>
          Added {new Date(item.added_at).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.gameActions}>
        {/* Move button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleMoveGame(item)}
        >
          <Ionicons name="swap-horizontal" size={20} color="#808080" />
        </TouchableOpacity>

        {/* Remove button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleRemoveGame(item.game_id, item.game_title)}
          disabled={removingGameId === item.game_id}
        >
          {removingGameId === item.game_id ? (
            <ActivityIndicator color="#ef4444" size="small" />
          ) : (
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{bucketEmoji || '📁'}</Text>
      <Text style={styles.emptyTitle}>No games yet</Text>
      <Text style={styles.emptySubtitle}>
        Save games from recommendations to add them here
      </Text>
    </View>
  );

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerEmoji}>{bucketEmoji || '📁'}</Text>
            <Text style={styles.headerTitle}>{bucketName || 'Collection'}</Text>
            {bucket && (
              <Text style={styles.headerCount}>
                {bucket.game_count} game{bucket.game_count !== 1 ? 's' : ''}
              </Text>
            )}
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {/* Games List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={bucketColor || '#f857a6'} size="large" />
          </View>
        ) : (
          <FlatList
            data={bucket?.games || []}
            renderItem={renderGameItem}
            keyExtractor={(item) => item.game_id}
            contentContainerStyle={[
              styles.listContent,
              (!bucket?.games || bucket.games.length === 0) && styles.emptyListContent,
            ]}
            ListEmptyComponent={renderEmptyState}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#808080"
              />
            }
          />
        )}
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerCount: {
    fontSize: 14,
    color: '#808080',
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  gameItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  gameInfo: {
    flex: 1,
  },
  gameTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  gameDate: {
    fontSize: 12,
    color: '#808080',
  },
  gameActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#808080',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default BucketDetailScreen;
