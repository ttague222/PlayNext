/**
 * PlayNext Results Screen
 *
 * Display 1-3 game recommendations with actions
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRecommendation } from '../context/RecommendationContext';
import { usePremium } from '../context/PremiumContext';
import GameCard from '../components/GameCard';
import CelebrationModal from '../components/CelebrationModal';
import AlreadyPlayedModal from '../components/AlreadyPlayedModal';
import SaveToBucketModal from '../components/SaveToBucketModal';
import AdOrPremiumModal from '../components/AdOrPremiumModal';
import FeatureCallout from '../components/FeatureCallout';

const ResultsScreen = () => {
  const navigation = useNavigation();
  const {
    recommendations,
    loading,
    error,
    fallbackApplied,
    fallbackMessage,
    reroll,
    acceptRecommendation,
    markAsPlayedAndSwap,
    preferences,
  } = useRecommendation();
  const {
    recordReroll,
    isPremium,
    isAdLoading,
    isRewardedAdsEnabled,
    shouldShowAdBeforeReroll,
    showRewardedAd,
    getRerollsUntilAd,
    shouldShowPremiumPrompt,
    AD_INTERVAL,
  } = usePremium();

  const [selectedGame, setSelectedGame] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isRerolling, setIsRerolling] = useState(false);
  const [swappingGameId, setSwappingGameId] = useState(null);
  const [acceptingGameId, setAcceptingGameId] = useState(null);
  const [alreadyPlayedGame, setAlreadyPlayedGame] = useState(null);
  const [showAlreadyPlayedModal, setShowAlreadyPlayedModal] = useState(false);
  const [saveGame, setSaveGame] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showAdOrPremiumModal, setShowAdOrPremiumModal] = useState(false);
  const [pendingRerollAction, setPendingRerollAction] = useState(null);
  const [showRerollCallout, setShowRerollCallout] = useState(false);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Show reroll callout after a short delay on first view
    const timer = setTimeout(() => {
      setShowRerollCallout(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleAccept = async (game) => {
    // Prevent double-tap
    if (acceptingGameId) return;

    setAcceptingGameId(game.game_id);
    try {
      await acceptRecommendation(game.game_id, game.title);
      setSelectedGame(game);
      setShowCelebration(true);
    } finally {
      setAcceptingGameId(null);
    }
  };

  const handleAlreadyPlayed = (game) => {
    // Show modal to collect feedback before swapping
    setAlreadyPlayedGame(game);
    setShowAlreadyPlayedModal(true);
  };

  const handleSave = (game) => {
    setSaveGame(game);
    setShowSaveModal(true);
  };

  const handleAlreadyPlayedFeedback = async (signalType) => {
    if (!alreadyPlayedGame) return;

    setShowAlreadyPlayedModal(false);
    setSwappingGameId(alreadyPlayedGame.game_id);

    try {
      // Submit the feedback with the specific signal type (loved, neutral, didn't stick)
      const newGame = await markAsPlayedAndSwap(
        alreadyPlayedGame.game_id,
        signalType,
        alreadyPlayedGame.title
      );
      if (!newGame) {
        Alert.alert(
          'No more games',
          'We\'ve shown you all the games matching your criteria. Try adjusting your filters for more options.'
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to get a replacement game. Please try again.');
    } finally {
      setSwappingGameId(null);
      setAlreadyPlayedGame(null);
    }
  };

  const handleAlreadyPlayedSkip = async () => {
    if (!alreadyPlayedGame) return;

    setShowAlreadyPlayedModal(false);
    setSwappingGameId(alreadyPlayedGame.game_id);

    try {
      // Skip feedback, just swap with default already_played signal
      const newGame = await markAsPlayedAndSwap(
        alreadyPlayedGame.game_id,
        'already_played',
        alreadyPlayedGame.title
      );
      if (!newGame) {
        Alert.alert(
          'No more games',
          'We\'ve shown you all the games matching your criteria. Try adjusting your filters for more options.'
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to get a replacement game. Please try again.');
    } finally {
      setSwappingGameId(null);
      setAlreadyPlayedGame(null);
    }
  };

  const handleReroll = async () => {
    // Check if we need to show an ad before this reroll
    if (shouldShowAdBeforeReroll()) {
      // Show the choice modal instead of going straight to ad
      setShowAdOrPremiumModal(true);
      setPendingRerollAction(() => performReroll);
      return;
    }

    await performReroll();
  };

  /**
   * Handle user choosing to watch an ad from the modal
   */
  const handleWatchAd = async () => {
    setShowAdOrPremiumModal(false);

    const adCompleted = await showRewardedAd();
    if (!adCompleted) {
      // User didn't complete ad - don't allow reroll
      setPendingRerollAction(null);
      return;
    }

    // Perform the pending reroll action
    if (pendingRerollAction) {
      await pendingRerollAction();
      setPendingRerollAction(null);
    }
  };

  /**
   * Handle user choosing to go premium from the modal
   */
  const handleGoPremium = () => {
    setShowAdOrPremiumModal(false);
    setPendingRerollAction(null);
    navigation.navigate('Premium');
  };

  /**
   * Handle user canceling the ad/premium choice
   */
  const handleCancelAdChoice = () => {
    setShowAdOrPremiumModal(false);
    setPendingRerollAction(null);
  };

  /**
   * Perform the actual reroll action
   */
  const performReroll = async () => {
    setIsRerolling(true);

    // Spin animation
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();

    try {
      await reroll();
      // Record the reroll for free tier tracking
      recordReroll();
    } catch (err) {
      Alert.alert('Error', 'Failed to get new recommendations');
    } finally {
      setIsRerolling(false);
      spinAnim.setValue(0);
    }
  };

  const handleCelebrationDismiss = () => {
    setShowCelebration(false);
    navigation.navigate('PlayHome');
  };

  const handleKeepBrowsing = async () => {
    setShowCelebration(false);
    // Trigger a reroll to show fresh recommendations
    await handleReroll();
  };

  const handleStartOver = () => {
    navigation.navigate('PlayHome');
  };

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (loading) {
    return (
      <LinearGradient
        colors={['#0f0c29', '#302b63', '#24243e']}
        style={styles.container}
      >
        <SafeAreaView style={styles.centered} edges={['top', 'left', 'right', 'bottom']}>
          <Animated.Text style={styles.loadingEmoji}>🎮</Animated.Text>
          <Text style={styles.loadingText}>Finding your perfect game...</Text>
          <ActivityIndicator color="#f857a6" size="large" style={{ marginTop: 20 }} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient
        colors={['#0f0c29', '#302b63', '#24243e']}
        style={styles.container}
      >
        <SafeAreaView style={styles.centered} edges={['top', 'left', 'right', 'bottom']}>
          <Text style={styles.errorEmoji}>😕</Text>
          <Text style={styles.errorText}>Something went wrong</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleReroll}>
            <LinearGradient
              colors={['#f857a6', '#ff5858']}
              style={styles.retryGradient}
            >
              <Text style={styles.retryText}>Try Again</Text>
            </LinearGradient>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#0f0c29', '#302b63', '#24243e']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View
            style={[
              styles.header,
              {
                opacity: headerAnim,
                transform: [{
                  translateY: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                }],
              },
            ]}
          >
            <Text style={styles.headerEmoji}>🎯</Text>
            <Text style={styles.title}>Your perfect picks</Text>
            <Text style={styles.subtitle}>
              Based on your time & mood
            </Text>
            {fallbackApplied && fallbackMessage && (
              <View style={styles.fallbackBadge}>
                <Text style={styles.fallbackMessage}>{fallbackMessage}</Text>
              </View>
            )}
          </Animated.View>

          {/* Recommendations */}
          {recommendations.length > 0 ? (
            <View style={styles.recommendations}>
              {recommendations.map((game, index) => (
                <GameCard
                  key={game.game_id}
                  game={game}
                  rank={index + 1}
                  onAccept={() => handleAccept(game)}
                  onAlreadyPlayed={() => handleAlreadyPlayed(game)}
                  onSave={() => handleSave(game)}
                  isSwapping={swappingGameId === game.game_id}
                  isAccepting={acceptingGameId === game.game_id}
                  userPlatforms={preferences.platforms}
                />
              ))}
            </View>
          ) : (
            <View style={styles.noResults}>
              <Text style={styles.noResultsEmoji}>🔍</Text>
              <Text style={styles.noResultsText}>
                No games found matching your criteria
              </Text>
              <Text style={styles.noResultsHint}>
                Try adjusting your filters
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.rerollButton}
              onPress={handleReroll}
              disabled={isRerolling || isAdLoading}
              activeOpacity={0.8}
            >
              <Animated.Text
                style={[
                  styles.rerollIcon,
                  isRerolling && { transform: [{ rotate: spin }] },
                ]}
              >
                🔄
              </Animated.Text>
              <View style={styles.rerollTextContainer}>
                <Text style={styles.rerollText}>
                  {isRerolling ? 'Finding more...' : isAdLoading ? 'Loading...' : 'Show different games'}
                </Text>
                {!isPremium && !isRerolling && !isAdLoading && isRewardedAdsEnabled && (
                  <Text style={styles.rerollsRemaining}>
                    {getRerollsUntilAd() === AD_INTERVAL
                      ? `${AD_INTERVAL} free rerolls`
                      : getRerollsUntilAd() > 0
                      ? `${getRerollsUntilAd()} free reroll${getRerollsUntilAd() > 1 ? 's' : ''} left`
                      : 'Watch ad to reroll'}
                  </Text>
                )}
                {isPremium && !isRerolling && (
                  <Text style={styles.rerollsRemaining}>
                    Unlimited rerolls
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.startOverButton}
              onPress={handleStartOver}
            >
              <Text style={styles.startOverText}>← Start over</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Celebration Modal */}
        <CelebrationModal
          visible={showCelebration}
          game={selectedGame}
          onDismiss={handleCelebrationDismiss}
          onKeepBrowsing={handleKeepBrowsing}
        />

        {/* Already Played Feedback Modal */}
        <AlreadyPlayedModal
          visible={showAlreadyPlayedModal}
          game={alreadyPlayedGame}
          onFeedback={handleAlreadyPlayedFeedback}
          onSkip={handleAlreadyPlayedSkip}
        />

        {/* Save to Bucket Modal */}
        <SaveToBucketModal
          visible={showSaveModal}
          game={saveGame}
          onClose={() => {
            setShowSaveModal(false);
            setSaveGame(null);
          }}
        />

        {/* Ad or Premium Choice Modal */}
        <AdOrPremiumModal
          visible={showAdOrPremiumModal}
          onWatchAd={handleWatchAd}
          onGoPremium={handleGoPremium}
          onCancel={handleCancelAdChoice}
          isAdLoading={isAdLoading}
        />

        {/* First-time Reroll Explanation Callout */}
        <FeatureCallout
          id="results_reroll_explanation"
          emoji="🔄"
          title="Reroll Your Picks"
          description={`Not feeling these games? Tap "Show different games" to get new recommendations. You get ${AD_INTERVAL} free rerolls each day, then watch a quick ad to keep going. Premium users get unlimited ad-free rerolls!`}
          visible={showRerollCallout && !loading && recommendations.length > 0}
          onDismiss={() => setShowRerollCallout(false)}
          position="bottom"
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#909090',
    textAlign: 'center',
  },
  fallbackBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  fallbackMessage: {
    fontSize: 14,
    color: '#f59e0b',
    textAlign: 'center',
  },
  recommendations: {
    gap: 16,
    marginBottom: 28,
  },
  noResults: {
    padding: 40,
    alignItems: 'center',
  },
  noResultsEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  noResultsHint: {
    fontSize: 14,
    color: '#808080',
    textAlign: 'center',
  },
  actions: {
    gap: 16,
  },
  rerollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingVertical: 18,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 10,
  },
  rerollIcon: {
    fontSize: 20,
  },
  rerollTextContainer: {
    alignItems: 'center',
  },
  rerollText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  rerollsRemaining: {
    fontSize: 12,
    color: '#909090',
    marginTop: 4,
  },
  startOverButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  startOverText: {
    fontSize: 15,
    color: '#808090',
    fontWeight: '500',
  },
  loadingEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 15,
    color: '#808080',
    marginBottom: 28,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  retryGradient: {
    paddingVertical: 16,
    paddingHorizontal: 40,
  },
  retryText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default ResultsScreen;
