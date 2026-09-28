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
  Easing,
  Image,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import ShimmerBlock from './ShimmerBlock';
import FadeSlideIn from './FadeSlideIn';
import MatchPill from './MatchPill';
import useReducedMotion from '../hooks/useReducedMotion';
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

// Save confirmation motion (M3)
const SAVE_LABEL_CROSSFADE_DURATION = 150;
const SAVE_ICON_SPRING_FRICTION = 4;
const SAVE_ICON_SPRING_TENSION = 160;
// I4: hold off the pop until the SaveToBucketModal has actually finished
// closing (its own fade-out), so the confirmation never plays underneath it.
const SAVE_POP_DELAY = 150;

// Swap motion (M3)
const SWAP_OUT_DURATION = 180;
const SWAP_REVERT_DURATION = 150;
const SWAP_SETTLE_DURATION = 240;
const SWAP_SETTLE_EASING = Easing.bezier(0.23, 1, 0.32, 1);
const REDUCED_MOTION_SWAP_DURATION = 150;

// Entrance motion (I1/I2) — 'stagger' is the first result set's shell fade +
// per-segment FadeSlideIn cascade; 'settle' is a single mount-driven
// translate/fade used for a card that replaces one that didn't survive a
// swap/reroll; 'none' renders at rest with no animation.
const STAGGER_SHELL_FADE_DURATION = 150;
const STAGGER_INDEX_DELAY_STEP = 120;
const STAGGER_LOWER_BLOCK_DELAY_OFFSET = 150;

const GameCard = ({
  game,
  rank,
  onAccept,
  onAlreadyPlayed,
  onNotForMe,
  onSave,
  isSwapping,
  isAccepting,
  userPlatforms,
  entrance = 'none',
  entranceIndex = 0,
  isSaved = false,
}) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [fallbackColors, setFallbackColors] = useState(['#667eea', '#764ba2']);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const reducedMotion = useReducedMotion();

  // Existing logic (count-up gate, FadeSlideIn `enabled`) keys off whether
  // this is the first-set stagger entrance specifically.
  const animateEntrance = entrance === 'stagger';

  // 'stagger': the whole card shell fades in (opacity-only, native driver)
  // while its segments cascade in via FadeSlideIn below. 'settle'/'none'
  // render the shell at rest — 'settle' owns its own motion on the swap
  // wrapper instead (see swapTranslateY/swapOpacity below).
  const entranceOpacity = useRef(new Animated.Value(entrance === 'stagger' ? 0 : 1)).current;

  useEffect(() => {
    if (entrance !== 'stagger') {
      return undefined;
    }
    const animation = Animated.timing(entranceOpacity, {
      toValue: 1,
      duration: STAGGER_SHELL_FADE_DURATION,
      delay: entranceIndex * STAGGER_INDEX_DELAY_STEP,
      useNativeDriver: true,
    });
    animation.start();
    // Stop on unmount rather than leaving a delayed/in-flight timing
    // running past the component's lifetime.
    return () => animation.stop();
    // Mount-only, same as the FadeSlideIn segments it accompanies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // --- Save confirmation motion (M3) ---
  // Bookmark spring-pop + label crossfade when isSaved flips false -> true.
  // Skips the initial mount (a card can render already-saved with no pop).
  const saveIconScale = useRef(new Animated.Value(1)).current;
  const saveLabelOpacity = useRef(new Animated.Value(1)).current;
  const isSavedMountRef = useRef(true);

  useEffect(() => {
    if (isSavedMountRef.current) {
      isSavedMountRef.current = false;
      return;
    }
    if (!isSaved) {
      // Only the false -> true transition gets a confirmation animation.
      return;
    }
    if (reducedMotion) {
      // Instant swap — the icon/label already reflect isSaved via render.
      return;
    }

    saveLabelOpacity.setValue(0);
    Animated.sequence([
      Animated.delay(SAVE_POP_DELAY),
      Animated.parallel([
        Animated.timing(saveLabelOpacity, {
          toValue: 1,
          duration: SAVE_LABEL_CROSSFADE_DURATION,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.spring(saveIconScale, {
            toValue: 1.25,
            friction: SAVE_ICON_SPRING_FRICTION,
            tension: SAVE_ICON_SPRING_TENSION,
            useNativeDriver: true,
          }),
          Animated.spring(saveIconScale, {
            toValue: 1,
            friction: SAVE_ICON_SPRING_FRICTION,
            tension: SAVE_ICON_SPRING_TENSION,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaved]);

  // --- Swap + settle-entrance motion (M3, I2) ---
  // Dedicated Animated.Values, kept separate from the entranceOpacity shell
  // fade above so the two never fight over the same style prop.
  //
  // For entrance === 'settle' these ALSO own the mount-in motion: seeded
  // here, in the useRef initializers, so the card never flashes at its
  // resting state before the mount effect below kicks off (translateY 12 ->
  // 0, opacity 0 -> 1, or just opacity under reduced motion).
  const swapTranslateX = useRef(new Animated.Value(0)).current;
  const swapTranslateY = useRef(
    new Animated.Value(entrance === 'settle' && !reducedMotion ? 12 : 0)
  ).current;
  const swapRotate = useRef(new Animated.Value(0)).current; // degrees, 0 <-> -2
  const swapOpacity = useRef(new Animated.Value(entrance === 'settle' ? 0 : 1)).current;
  const swapRotateInterpolated = swapRotate.interpolate({
    inputRange: [-2, 0],
    outputRange: ['-2deg', '0deg'],
  });
  const prevIsSwappingRef = useRef(isSwapping);

  // Settle-in on mount for entrance === 'settle' — a card that replaced one
  // that didn't survive a swap/reroll (see ResultsScreen's entranceFor).
  // Mount-only: with ResultsScreen keying cards by game_id, this card is
  // always a fresh instance, never an existing one whose game_id changed in
  // place, so there's no need to key off game.game_id here.
  useEffect(() => {
    if (entrance !== 'settle') {
      return undefined;
    }

    if (reducedMotion) {
      const animation = Animated.timing(swapOpacity, {
        toValue: 1,
        duration: REDUCED_MOTION_SWAP_DURATION,
        useNativeDriver: true,
      });
      animation.start();
      return () => animation.stop();
    }

    const animation = Animated.parallel([
      Animated.timing(swapTranslateY, {
        toValue: 0,
        duration: SWAP_SETTLE_DURATION,
        easing: SWAP_SETTLE_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(swapOpacity, {
        toValue: 1,
        duration: SWAP_SETTLE_DURATION,
        easing: SWAP_SETTLE_EASING,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    // Stop on unmount rather than leaving an in-flight settle animation
    // running past the component's lifetime.
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap-out while isSwapping is true; reverses back to identity when it
  // clears — the rejectAndSwap/markAsPlayedAndSwap call failed and this
  // same card is still showing (error path). A successful swap unmounts
  // this instance via ResultsScreen's key={game.game_id} before isSwapping
  // ever clears here, so clearing always means the error-path revert.
  useEffect(() => {
    if (prevIsSwappingRef.current === isSwapping) {
      return;
    }
    prevIsSwappingRef.current = isSwapping;

    if (isSwapping) {
      if (reducedMotion) {
        Animated.timing(swapOpacity, {
          toValue: 0.5,
          duration: REDUCED_MOTION_SWAP_DURATION,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(swapTranslateX, {
          toValue: -24,
          duration: SWAP_OUT_DURATION,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
        Animated.timing(swapRotate, {
          toValue: -2,
          duration: SWAP_OUT_DURATION,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
        Animated.timing(swapOpacity, {
          toValue: 0.5,
          duration: SWAP_OUT_DURATION,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      }
      return;
    }

    if (reducedMotion) {
      Animated.timing(swapOpacity, {
        toValue: 1,
        duration: REDUCED_MOTION_SWAP_DURATION,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.parallel([
        Animated.timing(swapTranslateX, {
          toValue: 0,
          duration: SWAP_REVERT_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(swapRotate, {
          toValue: 0,
          duration: SWAP_REVERT_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(swapOpacity, {
          toValue: 1,
          duration: SWAP_REVERT_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSwapping]);

  const matchPercent = Math.round((game.match_score || 0.85) * 100);

  // Match % count-up: only on the first result set's entrance, and only
  // when motion is allowed. Otherwise MatchPill renders the static final
  // number. (I3/M5: the count-up itself and its per-tick setState now live
  // inside MatchPill, isolated from the rest of this card's render tree.)
  const shouldCountUpMatch = animateEntrance && !reducedMotion;

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
    <Animated.View style={[styles.cardWrapper, { opacity: entranceOpacity }]}>
      <Animated.View
        style={{
          opacity: swapOpacity,
          transform: [
            { translateX: swapTranslateX },
            { translateY: swapTranslateY },
            { rotate: swapRotateInterpolated },
          ],
        }}
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
        <FadeSlideIn enabled={animateEntrance} delay={entranceIndex * STAGGER_INDEX_DELAY_STEP}>
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
        </FadeSlideIn>

        {/* Header + description + CTA */}
        <FadeSlideIn enabled={animateEntrance} delay={entranceIndex * STAGGER_INDEX_DELAY_STEP + 50}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>{game.title}</Text>
            <MatchPill
              matchPercent={matchPercent}
              countUp={shouldCountUpMatch}
              entranceIndex={entranceIndex}
            />
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
        </FadeSlideIn>

        {/* Why this fits - Simplified with icons */}
        {game.explanation && (
          <FadeSlideIn enabled={animateEntrance} delay={entranceIndex * STAGGER_INDEX_DELAY_STEP + 100}>
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
          </FadeSlideIn>
        )}

        {/* Meta tags + WHERE TO PLAY + secondary actions — the card's lower
            block, staggered in as its own FadeSlideIn segment (I1/I2) so it
            settles in just after the CTA/explanation above it. */}
        <FadeSlideIn enabled={animateEntrance} delay={entranceIndex * STAGGER_INDEX_DELAY_STEP + STAGGER_LOWER_BLOCK_DELAY_OFFSET}>
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
              accessibilityLabel={isSaved ? 'Saved' : 'Save'}
            >
              <Animated.View style={{ transform: [{ scale: saveIconScale }] }}>
                <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={15} color="#f5b544" />
              </Animated.View>
              <Animated.Text
                style={[styles.saveButtonText, { opacity: saveLabelOpacity }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {isSaved ? 'Saved' : 'Save'}
              </Animated.Text>
            </PressableScale>
          )}
        </View>
        </FadeSlideIn>

      </View>
      </Animated.View>
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
