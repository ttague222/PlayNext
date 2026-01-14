/**
 * PlayNxt History Screen (Secondary Tab)
 *
 * Supports memory, trust, and repetition avoidance.
 *
 * Responsibilities:
 * - Display previously accepted recommendations
 * - Display games marked as "already played"
 * - Allow users to provide feedback on recommendations
 * - Show which recommendations worked
 *
 * Constraints:
 * - No stats dashboards, streaks, or achievements
 * - No social features or progress tracking
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useRecommendation } from '../context/RecommendationContext';
import { useSavedGames, BUCKET_CONFIG } from '../context/SavedGamesContext';
import api from '../services/api';
import HistoryFeedbackModal from '../components/HistoryFeedbackModal';

// Signal types to include in history
const HISTORY_SIGNAL_TYPES = [
  'accepted',
  'played_loved',
  'played_neutral',
  'played_didnt_stick',
  'already_played',
];

// Display info for each signal type
const SIGNAL_TYPE_CONFIG = {
  accepted: {
    label: 'Accepted',
    icon: 'game-controller-outline',
    color: '#4ade80',
    section: 'recent',
  },
  played_loved: {
    label: 'Loved it',
    icon: 'heart',
    color: '#f472b6',
    section: 'played',
  },
  played_neutral: {
    label: 'It was okay',
    icon: 'thumbs-up-outline',
    color: '#fbbf24',
    section: 'played',
  },
  played_didnt_stick: {
    label: "Didn't stick",
    icon: 'thumbs-down-outline',
    color: '#94a3b8',
    section: 'played',
  },
  already_played: {
    label: 'Already played',
    icon: 'checkmark-done-outline',
    color: '#60a5fa',
    section: 'played',
  },
};

const HistoryScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { historyVersion } = useRecommendation();
  const { buckets, fetchBuckets, bucketsVersion, canSaveGames } = useSavedGames();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Fetch history and buckets when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchHistory();
        if (canSaveGames) {
          fetchBuckets();
        }
      } else {
        setHistory([]);
        setLoading(false);
      }
    }, [user, historyVersion, bucketsVersion, canSaveGames])
  );

  const fetchHistory = async () => {
    if (!user) {
      setHistory([]);
      setLoading(false);
      return;
    }

    try {
      const signals = await api.getSignalHistory(50);

      // Handle empty or missing response gracefully
      if (!signals || !Array.isArray(signals)) {
        setHistory([]);
        return;
      }

      // Transform API response to match our UI format
      // Include all history-relevant signal types
      const historyItems = signals
        .filter((signal) => HISTORY_SIGNAL_TYPES.includes(signal.signal_type))
        .map((signal) => ({
          id: signal.signal_id,
          gameId: signal.game_id,
          title: signal.game_title || signal.game_id,
          acceptedAt: signal.timestamp,
          signalType: signal.signal_type,
          worked: signal.worked || false,
        }));

      // Remove duplicates - keep only the most recent signal per game
      const uniqueItems = [];
      const seenGames = new Set();
      for (const item of historyItems) {
        if (!seenGames.has(item.gameId)) {
          seenGames.add(item.gameId);
          uniqueItems.push(item);
        }
      }

      setHistory(uniqueItems);
    } catch (error) {
      // Don't show error for 404 (no history yet) - just show empty state
      if (error.response?.status === 404) {
        setHistory([]);
      } else {
        // Only show error alert for actual errors (network issues, server errors, etc.)
        Alert.alert('Error', 'Failed to load history. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const handleItemPress = (item) => {
    setSelectedItem(item);
    setShowFeedbackModal(true);
  };

  const handleRemove = async (itemId) => {
    Alert.alert(
      'Remove from History',
      'Are you sure you want to remove this from your history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteSignal(itemId);
              setHistory((prev) => prev.filter((item) => item.id !== itemId));
            } catch (error) {
              // Error removing from history
              Alert.alert('Error', 'Failed to remove item. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleFeedback = async (itemId, feedbackType) => {
    const item = history.find((h) => h.id === itemId);
    if (!item) return;

    // Handle worked toggle specially
    if (feedbackType === 'mark_worked' || feedbackType === 'unmark_worked') {
      const newWorkedStatus = feedbackType === 'mark_worked';

      // Optimistic update
      setHistory((prev) =>
        prev.map((h) =>
          h.id === itemId ? { ...h, worked: newWorkedStatus } : h
        )
      );

      try {
        await api.updateSignalWorked(itemId, newWorkedStatus);
      } catch (error) {
        // Error updating worked status
        // Revert on error
        setHistory((prev) =>
          prev.map((h) =>
            h.id === itemId ? { ...h, worked: !newWorkedStatus } : h
          )
        );
        Alert.alert('Error', 'Failed to update status. Please try again.');
      }
      return;
    }

    // For feedback types (loved, neutral, didn't stick)
    // Create a new signal with the feedback
    try {
      // Submit feedback signal
      await api.submitFeedback(item.gameId, feedbackType, 'history-feedback', {});

      // Update local state to reflect the new signal type
      setHistory((prev) =>
        prev.map((h) =>
          h.id === itemId ? { ...h, signalType: feedbackType } : h
        )
      );
    } catch (error) {
      // Error submitting feedback
      Alert.alert('Error', 'Failed to save feedback. Please try again.');
    }
  };

  const handleQuickWorkedToggle = async (itemId, currentWorked) => {
    const newWorkedStatus = !currentWorked;

    // Optimistic update
    setHistory((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, worked: newWorkedStatus } : item
      )
    );

    try {
      await api.updateSignalWorked(itemId, newWorkedStatus);
    } catch (error) {
      // Error updating worked status
      // Revert on error
      setHistory((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, worked: currentWorked } : item
        )
      );
      Alert.alert('Error', 'Failed to update status. Please try again.');
    }
  };

  const renderHistoryItem = ({ item }) => {
    const config = SIGNAL_TYPE_CONFIG[item.signalType] || SIGNAL_TYPE_CONFIG.accepted;
    const isAccepted = item.signalType === 'accepted';

    return (
      <TouchableOpacity
        style={styles.historyItem}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.gameInfo}>
          <View style={styles.titleRow}>
            <Ionicons
              name={config.icon}
              size={18}
              color={config.color}
              style={styles.typeIcon}
            />
            <Text style={styles.gameTitle} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.statusBadge, { color: config.color }]}>
              {config.label}
            </Text>
            <Text style={styles.separator}>·</Text>
            <Text style={styles.gameDate}>
              {new Date(item.acceptedAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          {/* Worked indicator/toggle - only show for accepted items */}
          {isAccepted && (
            <TouchableOpacity
              style={[styles.workedButton, item.worked && styles.workedActive]}
              onPress={() => handleQuickWorkedToggle(item.id, item.worked)}
            >
              <Ionicons
                name={item.worked ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={24}
                color={item.worked ? '#4ade80' : '#606060'}
              />
            </TouchableOpacity>
          )}

          {/* Chevron to indicate tappable */}
          <Ionicons name="chevron-forward" size={20} color="#606060" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="time-outline" size={64} color="#404060" />
      <Text style={styles.emptyTitle}>No History Yet</Text>
      <Text style={styles.emptySubtitle}>
        Games you accept or mark as played will appear here.{'\n'}
        Tap on any game to leave feedback.
      </Text>
    </View>
  );

  // Count accepted items for section header
  const acceptedItems = history.filter((item) => item.signalType === 'accepted');

  const renderSectionHeader = (title, count) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );

  const handleBucketPress = (bucket) => {
    navigation.navigate('BucketDetail', {
      bucketType: bucket.bucket_type,
      bucketName: bucket.name,
      bucketEmoji: bucket.emoji,
      bucketColor: bucket.color,
    });
  };

  const renderBucketCard = (bucket) => {
    const config = BUCKET_CONFIG[bucket.bucket_type] || {};
    return (
      <TouchableOpacity
        key={bucket.bucket_type}
        style={styles.bucketCard}
        onPress={() => handleBucketPress(bucket)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[`${bucket.color}20`, `${bucket.color}10`]}
          style={styles.bucketCardGradient}
        >
          <Text style={styles.bucketEmoji}>{bucket.emoji}</Text>
          <Text style={styles.bucketName} numberOfLines={1}>{bucket.name}</Text>
          <View style={[styles.bucketCount, { backgroundColor: bucket.color }]}>
            <Text style={styles.bucketCountText}>{bucket.game_count}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Games</Text>
          <Text style={styles.headerSubtitle}>
            Your collections and history
          </Text>
        </View>

        {/* Bucket Cards - horizontal scroll */}
        {canSaveGames && buckets.length > 0 && (
          <View style={styles.bucketsSection}>
            <Text style={styles.bucketsSectionTitle}>Collections</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bucketsScroll}
            >
              {buckets.map(renderBucketCard)}
            </ScrollView>
          </View>
        )}

        {/* Premium prompt for non-premium users */}
        {!canSaveGames && (
          <TouchableOpacity
            style={styles.premiumPrompt}
            onPress={() => navigation.navigate('Premium')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['rgba(248, 87, 166, 0.15)', 'rgba(255, 88, 88, 0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.premiumPromptGradient}
            >
              <View style={styles.premiumPromptLeft}>
                <Ionicons name="star" size={22} color="#f857a6" />
                <View style={styles.premiumPromptTextContainer}>
                  <Text style={styles.premiumPromptTitle}>Game Library</Text>
                  <Text style={styles.premiumPromptSubtitle}>Premium feature</Text>
                </View>
              </View>
              <View style={styles.premiumPromptButton}>
                <Text style={styles.premiumPromptButtonText}>Upgrade</Text>
                <Ionicons name="chevron-forward" size={16} color="#ffffff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* History List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <FlatList
            data={history}
            renderItem={renderHistoryItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              history.length === 0 && styles.emptyListContent,
            ]}
            ListEmptyComponent={renderEmptyState}
            ListHeaderComponent={
              history.length > 0 ? (
                <View>
                  {acceptedItems.length > 0 && renderSectionHeader('Recommendations', acceptedItems.length)}
                </View>
              ) : null
            }
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

        {/* Legend */}
        {history.length > 0 && (
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <Ionicons name="checkmark-circle" size={14} color="#4ade80" />
              <Text style={styles.legendText}>Worked for me</Text>
            </View>
            <View style={styles.legendItem}>
              <Ionicons name="heart" size={14} color="#f472b6" />
              <Text style={styles.legendText}>Loved</Text>
            </View>
            <View style={styles.legendItem}>
              <Ionicons name="thumbs-down-outline" size={14} color="#94a3b8" />
              <Text style={styles.legendText}>Didn't stick</Text>
            </View>
          </View>
        )}

        {/* Feedback Modal */}
        <HistoryFeedbackModal
          visible={showFeedbackModal}
          item={selectedItem}
          onClose={() => {
            setShowFeedbackModal(false);
            setSelectedItem(null);
          }}
          onFeedback={handleFeedback}
          onRemove={handleRemove}
        />
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
    paddingHorizontal: 24,
    paddingTop: 16,
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
  bucketsSection: {
    paddingBottom: 16,
  },
  bucketsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#909090',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  bucketsScroll: {
    paddingHorizontal: 24,
    gap: 12,
  },
  bucketCard: {
    width: 120,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bucketCardGradient: {
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
  },
  bucketEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  bucketName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  bucketCount: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bucketCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  premiumPrompt: {
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  premiumPromptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(248, 87, 166, 0.3)',
    borderRadius: 14,
  },
  premiumPromptLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  premiumPromptTextContainer: {
    gap: 2,
  },
  premiumPromptTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  premiumPromptSubtitle: {
    fontSize: 12,
    color: '#f857a6',
  },
  premiumPromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f857a6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  premiumPromptButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#808080',
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#909090',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 14,
    color: '#606060',
  },
  historyItem: {
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeIcon: {
    marginRight: 8,
  },
  gameTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 26,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '500',
  },
  separator: {
    color: '#606060',
    marginHorizontal: 6,
  },
  gameDate: {
    fontSize: 12,
    color: '#606060',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workedButton: {
    padding: 4,
  },
  workedActive: {
    opacity: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#808080',
    textAlign: 'center',
    lineHeight: 22,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#707070',
  },
});

export default HistoryScreen;
