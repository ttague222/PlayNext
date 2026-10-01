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
import { useSavedGames, BUCKET_TYPES } from '../context/SavedGamesContext';
import GameCard from '../components/GameCard';
import useReducedMotion from '../hooks/useReducedMotion';
import CelebrationModal from '../components/CelebrationModal';
import AlreadyPlayedModal from '../components/AlreadyPlayedModal';
import WhyNotModal, { WHY_NOT_REASON_LABELS } from '../components/WhyNotModal';
import UndoToast from '../components/UndoToast';
import { logEvent } from '../services/analyticsService';
import { hapticLight, hapticSuccess, hapticSelect } from '../utils/haptics';
import SaveToBucketModal from '../components/SaveToBucketModal';
import AdOrPremiumModal from '../components/AdOrPremiumModal';
import DailyCapUpsellModal from '../components/DailyCapUpsellModal';
import FeatureCallout from '../components/FeatureCallout';
import FeedbackModal from '../components/FeedbackModal';
import { maybePromptForPush } from '../utils/pushPrompt';
import { maybeShowWorkedUpsell } from '../utils/upsellPrompt';
import { maybeRequestReview } from '../utils/reviewPrompt';

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
    rejectAndSwap,
    undoRejection,
    submitFeedback,
    preferences,
  } = useRecommendation();
  const { addGameToBucket, removeGameFromBucket } = useSavedGames();
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
    isDailyCapHit,
    getPackageByType,
    formatPrice,
  } = usePremium();

  // Compute premium price from RevenueCat
  const lifetimePackage = getPackageByType?.('LIFETIME');
  const premiumPriceString = lifetimePackage ? formatPrice(lifetimePackage.product) : '$1.99';

  // Honest reroll countdown: how many free rerolls are left before the NEXT
  // reroll shows an ad (the actual gate), not how many rerolls are left
  // before the 10/day hard cap (which is a different, much larger number and
  // never matches when ads fire). null when ads aren't gating rerolls at all
  // (premium, or rewarded ads disabled) -- getRerollsUntilAd() returns
  // Infinity in that case, which isn't renderable copy.
  const rerollsUntilAd = getRerollsUntilAd();
  const rerollsUntilAdText = Number.isFinite(rerollsUntilAd)
    ? rerollsUntilAd === 0
      ? 'Next reroll plays a short ad'
      : `${rerollsUntilAd} free reroll${rerollsUntilAd !== 1 ? 's' : ''} left, then a short ad`
    : null;

  const [selectedGame, setSelectedGame] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isRerolling, setIsRerolling] = useState(false);
  const [swappingGameId, setSwappingGameId] = useState(null);
  const [acceptingGameId, setAcceptingGameId] = useState(null);
  const [alreadyPlayedGame, setAlreadyPlayedGame] = useState(null);
  const [showAlreadyPlayedModal, setShowAlreadyPlayedModal] = useState(false);
  const [whyNotGame, setWhyNotGame] = useState(null);
  const [showWhyNotModal, setShowWhyNotModal] = useState(false);
  // {game, signalId, replacementId} for the post-rejection undo window
  const [undoState, setUndoState] = useState(null);
  const [saveGame, setSaveGame] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  // game_ids confirmed saved this session — drives GameCard's filled
  // bookmark + "Saved" label and its confirmation pop animation.
  const [savedGameIds, setSavedGameIds] = useState(() => new Set());
  // I4/M3: a BACKLOG/PLAYING save waiting to be committed into
  // savedGameIds once the SaveToBucketModal actually closes (see
  // handleGameSaved + the modal's onClose below).
  const pendingSavedIdRef = useRef(null);
  const [showAdOrPremiumModal, setShowAdOrPremiumModal] = useState(false);
  const [pendingRerollAction, setPendingRerollAction] = useState(null);
  const [showRerollCallout, setShowRerollCallout] = useState(false);
  const [showDailyCapModal, setShowDailyCapModal] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  // Crossfade opacity for the results list — dipped and restored around a
  // reroll (see performReroll). Starts at 1 so the first render is unaffected.
  const resultsOpacityAnim = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();

  // First-set entrance stagger: only the FIRST non-empty recommendations
  // render gets the FadeSlideIn stagger + match count-up. Rerolls and swaps
  // land here too (recommendations changes), but the ref is already true by
  // then so they never re-arm the entrance animation.
  const hasAnimatedInRef = useRef(false);
  // Computed once per render, before hasAnimatedInRef flips in the effect
  // below, so every card in this render's map() agrees on whether it's the
  // first-set entrance.
  const animateEntrance = !hasAnimatedInRef.current;

  // I1/I2: per-card entrance mode. A card keeps its 'stagger' entrance only
  // on the very first non-empty set; after that, a card whose game_id
  // wasn't in the previous settled set (i.e. it replaced one that didn't
  // survive a swap/reroll) gets a one-off 'settle' mount-in, and every
  // other still-present card renders at rest ('none').
  const prevIdsRef = useRef(new Set());
  const prevIds = prevIdsRef.current;
  const someSurvived = recommendations.some((g) => prevIds.has(g.game_id));
  const entranceFor = (id) =>
    animateEntrance ? 'stagger' : someSurvived && !prevIds.has(id) ? 'settle' : 'none';

  // M4: gate on loading too — recommendations can be set while a fetch is
  // still resolving (see C1), and flipping this ref early would skip the
  // 'stagger' entrance for the actual first settled set.
  useEffect(() => {
    if (!loading && recommendations?.length) {
      hasAnimatedInRef.current = true;
    }
  }, [recommendations, loading]);

  useEffect(() => {
    if (!loading) prevIdsRef.current = new Set(recommendations.map((g) => g.game_id));
  }, [recommendations, loading]);

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
    // Prevent double-tap, and accepting a card that is mid-replacement
    if (acceptingGameId || isRerolling) return;

    hapticSuccess();
    setAcceptingGameId(game.game_id);
    try {
      await acceptRecommendation(game.game_id, game.title);
      setSelectedGame(game);
      setShowCelebration(true);
      // Fire-and-forget: ask about push notifications on the first accept.
      maybePromptForPush();
    } finally {
      setAcceptingGameId(null);
    }
  };

  const handleAlreadyPlayed = (game) => {
    // Concurrency guard: another swap or reroll is already in flight.
    if (swappingGameId || isRerolling) return;
    // Show modal to collect feedback before swapping
    setAlreadyPlayedGame(game);
    setShowAlreadyPlayedModal(true);
  };

  const handleNotForMe = (game) => {
    // Concurrency guard: another swap or reroll is already in flight.
    if (swappingGameId || isRerolling) return;
    // Open the "Why not?" sheet to collect a rejection reason
    logEvent('why_not_opened', { game_id: game.game_id });
    setWhyNotGame(game);
    setShowWhyNotModal(true);
  };

  const handleWhyNotReason = async (reason) => {
    if (!whyNotGame) return;
    const game = whyNotGame;

    hapticSelect();
    setShowWhyNotModal(false);
    setSwappingGameId(game.game_id);

    try {
      // Record the rejection (server excludes it permanently and learns from
      // its tags) and keep the local Not For Me bucket in sync so anonymous
      // users get the same exclusion client-side. The reason label rides in
      // the bucket note so the History screen can show why.
      const { newGame, signalId } = await rejectAndSwap(game.game_id, reason, game.title);
      addGameToBucket(
        BUCKET_TYPES.NOT_FOR_ME, game.game_id, game.title,
        WHY_NOT_REASON_LABELS[reason] || null, game
      ).catch(() => {});

      // Offer a short undo window — rejection is permanent otherwise
      setUndoState({
        game,
        signalId,
        replacementId: newGame?.game_id || null,
      });

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
      setWhyNotGame(null);
    }
  };

  const handleUndoRejection = async () => {
    if (!undoState) return;
    hapticLight();
    const { game, signalId, replacementId } = undoState;
    setUndoState(null);

    await undoRejection(game, signalId, replacementId);
    removeGameFromBucket(BUCKET_TYPES.NOT_FOR_ME, game.game_id).catch(() => {});
  };

  const handleWhyNotAlreadyPlayed = () => {
    // Route to the existing played-feedback flow instead of a rejection
    if (!whyNotGame) return;
    logEvent('why_not_already_played', {});
    setShowWhyNotModal(false);
    setAlreadyPlayedGame(whyNotGame);
    setWhyNotGame(null);
    setShowAlreadyPlayedModal(true);
  };

  const handleWhyNotSkip = async () => {
    if (!whyNotGame) return;
    const game = whyNotGame;

    logEvent('why_not_skipped', {});
    setShowWhyNotModal(false);
    setSwappingGameId(game.game_id);

    try {
      // A soft skip: no rejection recorded, just swap with a skipped signal
      const newGame = await markAsPlayedAndSwap(game.game_id, 'skipped', game.title);
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
      setWhyNotGame(null);
    }
  };

  const handleSave = (game) => {
    setSaveGame(game);
    setShowSaveModal(true);
  };

  // SaveToBucketModal's bucket-selected handler (handleSelectBucket) calls
  // addGameToBucket and, only once it resolves, fires onSaved(bucketType)
  // before its own timeout closes the modal — so this only fires on an
  // actual confirmed save, not just the modal opening.
  //
  // I4/M3: only BACKLOG and PLAYING read as "saved" — filing a game as
  // PLAYED or NOT_FOR_ME from this modal must not fill the bookmark. The id
  // is held as pending rather than committed here, so the GameCard save pop
  // (isSaved flipping false -> true) fires once the modal has actually
  // closed, not while it's still fading out on top of the card.
  const handleGameSaved = (bucketType) => {
    if (!saveGame) return;
    if (bucketType !== BUCKET_TYPES.BACKLOG && bucketType !== BUCKET_TYPES.PLAYING) {
      return;
    }
    pendingSavedIdRef.current = saveGame.game_id;
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
      // After a positive "loved" signal: premium upsell first; if it didn't
      // show (cooldown/premium), fall through to the store review ask.
      if (signalType === 'played_loved') {
        maybeShowWorkedUpsell({ isPremium, navigation }).then((upsellShown) => {
          maybeRequestReview({ otherPromptShown: upsellShown, trigger: 'played_loved' });
        });
      }
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
    // Concurrency guard: another swap or reroll is already in flight.
    if (swappingGameId || isRerolling) return;

    hapticLight();
    // Hard daily cap check — shown before the ad gate
    if (!isPremium && isDailyCapHit) {
      setShowDailyCapModal(true);
      return;
    }

    // Existing ad gate check
    if (shouldShowAdBeforeReroll()) {
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
    navigation.navigate('Premium', { source: 'results' });
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

      // Subtle crossfade on the new results — skip under reduced motion,
      // and only once the first set has already had its full entrance
      // (it always will have by the time a reroll can happen).
      if (!reducedMotion && hasAnimatedInRef.current) {
        resultsOpacityAnim.setValue(0.4);
        Animated.timing(resultsOpacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to get new recommendations');
    } finally {
      setIsRerolling(false);
      spinAnim.setValue(0);
    }
  };

  const handleCelebrationDismiss = () => {
    setShowCelebration(false);
    setShowFeedback(true);
  };

  const handleFeedbackSubmit = async (signalType) => {
    if (selectedGame) {
      try {
        await submitFeedback(selectedGame.game_id, signalType);
      } catch (err) {
        // Non-blocking: feedback failure should not interrupt the user
      }
    }
    setShowFeedback(false);
    navigation.navigate('PlayHome');
  };

  const handleFeedbackClose = () => {
    setShowFeedback(false);
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

  // C1: a reroll or an in-place card swap re-arms the context's `loading`
  // flag, but the cards behind the loader/spinner must stay mounted — only
  // a genuine first load (or a load with nothing to show yet) should replace
  // the whole screen with the loader.
  const isInPlaceBusy = isRerolling || swappingGameId !== null;

  if (loading && (recommendations.length === 0 || !isInPlaceBusy)) {
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

  // A failed swap/reroll keeps the cards on screen — the existing Alert
  // paths in performReroll/handleWhyNotReason/etc. already inform the user.
  if (error && recommendations.length === 0) {
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
            <Animated.View style={[styles.recommendations, { opacity: resultsOpacityAnim }]}>
              {recommendations.map((game, index) => (
                <GameCard
                  key={game.game_id}
                  game={game}
                  rank={index + 1}
                  onAccept={() => handleAccept(game)}
                  onAlreadyPlayed={() => handleAlreadyPlayed(game)}
                  onNotForMe={() => handleNotForMe(game)}
                  onSave={() => handleSave(game)}
                  isSwapping={swappingGameId === game.game_id}
                  isAccepting={acceptingGameId === game.game_id}
                  userPlatforms={preferences.platforms}
                  entrance={entranceFor(game.game_id)}
                  entranceIndex={index}
                  isSaved={savedGameIds.has(game.game_id)}
                />
              ))}
            </Animated.View>
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
              disabled={isRerolling || isAdLoading || swappingGameId !== null}
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
                {!isPremium && !isRerolling && !isAdLoading && (isDailyCapHit || rerollsUntilAdText) && (
                  <Text style={styles.rerollsRemaining}>
                    {isDailyCapHit ? 'No rerolls left today' : rerollsUntilAdText}
                  </Text>
                )}
                {isPremium && !isRerolling && (
                  <Text style={styles.rerollsRemaining}>Unlimited rerolls</Text>
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
          timeAvailable={preferences.timeAvailable}
          energyMood={preferences.energyMood}
        />

        {/* Post-acceptance Feedback Modal */}
        <FeedbackModal
          visible={showFeedback}
          game={selectedGame}
          onSubmit={handleFeedbackSubmit}
          onClose={handleFeedbackClose}
        />

        {/* Already Played Feedback Modal */}
        <WhyNotModal
          visible={showWhyNotModal}
          game={whyNotGame}
          onReason={handleWhyNotReason}
          onAlreadyPlayed={handleWhyNotAlreadyPlayed}
          onSkip={handleWhyNotSkip}
        />

        <UndoToast
          visible={!!undoState}
          message={undoState ? `"${undoState.game.title}" marked not for you` : ''}
          onUndo={handleUndoRejection}
          onDismiss={() => setUndoState(null)}
        />

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
            // Commit any pending BACKLOG/PLAYING save now that the modal is
            // actually closing — the GameCard save pop fires off this, not
            // off onSaved, so it never plays underneath the modal.
            if (pendingSavedIdRef.current) {
              const id = pendingSavedIdRef.current;
              pendingSavedIdRef.current = null;
              setSavedGameIds((prev) => new Set(prev).add(id));
            }
          }}
          onSaved={handleGameSaved}
        />

        {/* Ad or Premium Choice Modal */}
        <AdOrPremiumModal
          visible={showAdOrPremiumModal}
          onWatchAd={handleWatchAd}
          onGoPremium={handleGoPremium}
          onCancel={handleCancelAdChoice}
          isAdLoading={isAdLoading}
        />

        {/* Daily reroll cap upsell */}
        <DailyCapUpsellModal
          visible={showDailyCapModal}
          priceString={premiumPriceString}
          onGoPremium={() => {
            setShowDailyCapModal(false);
            navigation.navigate('Premium', { source: 'results' });
          }}
          onDismiss={() => setShowDailyCapModal(false)}
        />

        {/* First-time Reroll Explanation Callout */}
        <FeatureCallout
          id="results_reroll_explanation"
          emoji="🔄"
          title="Reroll Your Picks"
          description={`Not feeling these games? Tap "Show different games" to get new recommendations.${
  rerollsUntilAdText ? ` ${rerollsUntilAdText}.` : ''
} Premium users get unlimited rerolls!`}
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
