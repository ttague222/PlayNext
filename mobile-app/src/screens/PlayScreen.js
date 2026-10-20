/**
 * PlayNxt Play Screen (Primary Tab)
 *
 * Core functionality - helps user decide what to play right now.
 * Entry point for the recommendation flow.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRecommendation } from '../context/RecommendationContext';
import { useSavedGames } from '../context/SavedGamesContext';
import TonightCard from '../components/TonightCard';
import SeasonalCard from '../components/SeasonalCard';
import { getLastContext, getCachedPicks, fetchTonightsPicks, recordTonightView, localDateString } from '../services/tonightService';
import {
  loadSeasonalContent,
  getCachedSeasonalContentSync,
  activeSeason,
  visibleCollections,
  fetchCollectionPicks,
  platformFilterKey,
} from '../services/seasonalService';
import { maybeOfferTonightReminder } from '../utils/tonightReminderPrompt';
import { logSeasonalViewedOnce } from '../utils/seasonalViewed';
import { logEvent } from '../services/analyticsService';
import { useTheme } from '../theme/ThemeContext';
import { alpha } from '../theme/palette';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// An app parked on the Play tab across midnight keeps yesterday's picks in
// state with no refocus; every path that reuses the in-memory card checks this.
const isTodaysCache = (cache) => Boolean(cache) && cache.date === localDateString();

// Taps on a seasonal card closer together than this count as one.
const DOUBLE_TAP_MS = 1000;

// A promise, stable for the component's life, that resolves the first time
// `ready` is true.
const useReadyPromise = (ready) => {
  const ref = useRef(null);
  if (!ref.current) {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    ref.current = { promise, resolve };
  }
  useEffect(() => {
    if (ready) ref.current.resolve();
  }, [ready]);
  return ref.current.promise;
};

// One seasonal collection: prefetches today's picks on focus (the service
// caches per collection per local date and shares one in-flight request),
// logs its daily view, and opens the picks on tap. Mirrors the Tonight card's
// state and tap flow, kept per collection so two cards load independently.
const SeasonalCollection = ({ collection, season, showHeaderImage, dateKey }) => {
  const navigation = useNavigation();
  const { startCollectionSession, savedPlatforms, savedPreferencesLoaded } = useRecommendation();
  const [status, setStatus] = useState('loading'); // hidden | loading | ready | error
  const [picks, setPicks] = useState(null);

  // Read via refs so a new savedPlatforms array, or a re-parsed copy of the
  // same collection after a content refresh, can't give load a new identity
  // and re-trigger the focus effect.
  const platformsRef = useRef(savedPlatforms);
  platformsRef.current = savedPlatforms || [];
  const collectionRef = useRef(collection);
  collectionRef.current = collection;
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);
  // The provider hydrates savedPlatforms from storage after this mounts; until
  // it has, platformsRef holds a placeholder [] and a fetch would go out
  // unfiltered and be cached for the day. Every load waits for it.
  const savedPlatformsReady = useReadyPromise(savedPreferencesLoaded);

  // Resolves to today's picks, or null when there are none to show or the
  // load failed (the card then shows an empty-hidden or error state).
  const load = useCallback(async () => {
    if (mountedRef.current) setStatus((s) => (s === 'ready' ? s : 'loading'));
    await savedPlatformsReady;
    try {
      const fresh = await fetchCollectionPicks(collectionRef.current, { platforms: platformsRef.current });
      if (!mountedRef.current) return fresh.games.length > 0 ? fresh : null;
      if (fresh.games.length === 0) {
        setStatus('hidden');
        return null;
      }
      setPicks(fresh);
      setStatus('ready');
      return fresh;
    } catch {
      if (mountedRef.current) setStatus('error');
      return null;
    }
  }, [savedPlatformsReady]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visible = status !== 'hidden';
  useEffect(() => {
    if (visible) logSeasonalViewedOnce(collection.id, season.id);
  }, [visible, collection.id, season.id, dateKey]);

  // A ready card opens without awaiting anything, so the in-flight flag alone
  // would release before a second tap lands; the timestamp covers that window.
  const openingRef = useRef(false);
  const lastOpenedRef = useRef(0);
  const handlePress = useCallback(async () => {
    if (openingRef.current || Date.now() - lastOpenedRef.current < DOUBLE_TAP_MS) return;
    openingRef.current = true;
    try {
      logEvent('seasonal_collection_tapped', { collection_id: collection.id, season_id: season.id });
      // fetchCollectionPicks answers from the day's cache, so re-asking is
      // cheap and also covers a card left open across midnight or a change
      // of saved platforms since the card loaded.
      const current =
        status === 'ready' &&
        picks?.date === localDateString() &&
        picks?.platformFilter === platformFilterKey(platformsRef.current);
      const ready = current ? picks : await load();
      if (ready && startCollectionSession(collection, ready)) {
        lastOpenedRef.current = Date.now();
        navigation.navigate('Results');
      }
    } finally {
      openingRef.current = false;
    }
  }, [status, picks, load, collection, season.id, startCollectionSession, navigation]);

  if (!visible) return null;
  return (
    <SeasonalCard
      collection={collection}
      picks={picks}
      status={status}
      seasonName={season.name}
      headerImage={showHeaderImage ? season.header_image : null}
      onPress={handlePress}
      onRetry={load}
    />
  );
};

const PlayScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    startSession,
    resetPreferences,
    startTonightSession,
  } = useRecommendation();
  const { notForMeGameIds } = useSavedGames();
  const theme = useTheme();

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Tonight's Picks card state
  const [tonightStatus, setTonightStatus] = useState('hidden'); // hidden | loading | ready | error
  const [tonightCache, setTonightCache] = useState(null);
  const [tonightContext, setTonightContext] = useState(null);

  // Read via ref inside loadTonight so an identity change of notForMeGameIds
  // (a new array from context on every render) can't give loadTonight a new
  // identity mid-focus and re-trigger the focus effect, clobbering a ready
  // card back to loading.
  const notForMeRef = useRef(notForMeGameIds);
  notForMeRef.current = notForMeGameIds;

  // Resolves to { cache, failed }: cache is today's picks or null; failed is
  // true only when loading threw (offline, API down), so callers can tell
  // "no picks yet" apart from "couldn't load them".
  const loadTonight = useCallback(async () => {
    try {
      const context = await getLastContext();
      if (!context) {
        setTonightStatus('hidden');
        return { cache: null, failed: false };
      }
      setTonightContext(context);
      const cached = await getCachedPicks();
      if (cached) {
        setTonightCache(cached);
        setTonightStatus('ready');
        return { cache: cached, failed: false };
      }
      setTonightStatus('loading');
      const fresh = await fetchTonightsPicks({ excludedGameIds: notForMeRef.current || [] });
      if (fresh) {
        setTonightCache(fresh);
        setTonightStatus('ready');
        return { cache: fresh, failed: false };
      }
      setTonightStatus('hidden');
      return { cache: null, failed: false };
    } catch {
      setTonightStatus('error');
      return { cache: null, failed: true };
    }
  }, []);

  // Refresh on every focus: catches date rollover and post-session cache rewrites.
  useFocusEffect(
    useCallback(() => {
      loadTonight();
    }, [loadTonight])
  );

  // Seasonal calendar: bundled/last-loaded copy for the first render, then a
  // (cached, 6h-throttled) refresh on focus. Which season is live is always
  // decided here from the device date, never by the payload.
  const [seasonalContent, setSeasonalContent] = useState(getCachedSeasonalContentSync);
  const [today, setToday] = useState(localDateString);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      setToday(localDateString());
      loadSeasonalContent().then((content) => {
        if (live) setSeasonalContent(content);
      });
      return () => {
        live = false;
      };
    }, [])
  );
  const season = activeSeason(seasonalContent, today);
  const collections = visibleCollections(season, today);

  // Resolves to whether the picks actually opened: startTonightSession
  // rejects a cache with no games or no context.
  const openTonight = useCallback(
    async (cache, via) => {
      if (!startTonightSession(cache)) return false;
      await recordTonightView();
      logEvent('tonight_picks_viewed', { via });
      navigation.navigate('Results');
      maybeOfferTonightReminder();
      return true;
    },
    [startTonightSession, navigation]
  );

  // Guards against a double tap starting two sessions / recording two views
  // / stacking two reminder alerts while the first tap is still in flight.
  const openingRef = useRef(false);

  const handleTonightPress = useCallback(async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    try {
      // A stale-day cache falls through to a fresh load (see isTodaysCache).
      if (tonightStatus === 'ready' && isTodaysCache(tonightCache)) {
        await openTonight(tonightCache, 'card');
        return;
      }
      // loading/error: (re)try, then open if it lands
      const { cache } = await loadTonight();
      if (cache) await openTonight(cache, 'card');
    } finally {
      openingRef.current = false;
    }
  }, [tonightStatus, tonightCache, openTonight, loadTonight]);

  useEffect(() => {
    // Subtle pulse for CTA
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Icon float
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleStart = () => {
    resetPreferences();
    startSession();
    navigation.navigate('TimeSelect');
  };

  const handleTonightChange = () => {
    handleStart(); // same entry as the hero CTA: completing the flow rewrites context + cache
  };

  // Deep link (nightly reminder, What's New): open tonight's picks as soon as
  // they're available. The sender passes `openTonight` as a nonce (e.g.
  // Date.now()) so a re-tap of the same link re-fires, plus an optional
  // `openTonightVia` for analytics; both are cleared once consumed so
  // remounts/re-renders don't replay it. With no usable picks (no finished
  // session yet, or a cache that can't open), start the quiz instead of
  // landing on nothing. A load error is different: stay on Play, where the
  // card's error state offers a retry, rather than reset into the quiz.
  useEffect(() => {
    if (!route?.params?.openTonight) return;
    const via = route.params.openTonightVia || 'notification';
    (async () => {
      try {
        let cache = tonightStatus === 'ready' && isTodaysCache(tonightCache) ? tonightCache : null;
        let failed = false;
        if (!cache) ({ cache, failed } = await loadTonight());
        if (failed) return;
        const opened = cache ? await openTonight(cache, via) : false;
        if (!opened) handleStart();
      } finally {
        navigation.setParams({ openTonight: undefined, openTonightVia: undefined });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.openTonight]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.5],
  });

  return (
    <LinearGradient
      colors={theme.bg.home}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Background decoration */}
        <View style={styles.bgDecoration}>
          <View style={[styles.bgCircle, styles.bgCircle1, { backgroundColor: theme.bg.decor ?? '#f857a6' }]} />
          <View style={[styles.bgCircle, styles.bgCircle2, { backgroundColor: theme.bg.decor ?? '#667eea' }]} />
        </View>

        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Center Icon */}
          <Animated.View style={[styles.iconContainer, { transform: [{ translateY: floatAnim }] }]}>
            <LinearGradient
              colors={[alpha(theme.accent.brand, 0.15), alpha(theme.accent.brandEnd, 0.1)]}
              style={[styles.iconBg, { borderColor: alpha(theme.accent.brand, 0.3) }]}
            >
              <Ionicons name="game-controller" size={56} color={theme.accent.brand} />
            </LinearGradient>
          </Animated.View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>
              Play<Text style={[styles.logoAccent, { color: theme.accent.brand }]}>Nxt</Text>
            </Text>
            <Text style={styles.tagline}>Find your perfect game</Text>
          </View>

          {/* Main CTA */}
          <View style={styles.ctaContainer}>
            <Animated.View style={[styles.ctaGlow, { backgroundColor: theme.glow.brand, opacity: glowOpacity }]} />
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[styles.ctaButton, { shadowColor: theme.glow.brand }]}
                onPress={handleStart}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[theme.accent.brand, theme.accent.brandEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGradient}
                >
                  <Ionicons name="play" size={24} color="#ffffff" />
                  <Text style={styles.ctaText}>Start Playing</Text>
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {tonightStatus !== 'hidden' && (
            <TonightCard
              status={tonightStatus}
              context={tonightContext}
              games={tonightCache?.games || []}
              onPress={handleTonightPress}
              onChangePress={handleTonightChange}
            />
          )}

          {collections.map((collection, index) => (
            <SeasonalCollection
              key={collection.id}
              collection={collection}
              season={season}
              showHeaderImage={index === 0}
              dateKey={today}
            />
          ))}

          {/* Feature Pills: the Tonight or a seasonal card replaces them once
              one shows (the screen would overflow into the stats bar) */}
          {tonightStatus === 'hidden' && collections.length === 0 && (
            <View style={styles.features}>
              <View style={styles.featurePill}>
                <Ionicons name="time-outline" size={16} color="#a78bfa" />
                <Text style={styles.featureText}>Time-matched</Text>
              </View>
              <View style={styles.featurePill}>
                <Ionicons name="heart-outline" size={16} color="#f472b6" />
                <Text style={styles.featureText}>Mood-based</Text>
              </View>
              <View style={styles.featurePill}>
                <Ionicons name="flash-outline" size={16} color="#fbbf24" />
                <Text style={styles.featureText}>Instant</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Stats */}
        <View style={styles.bottomSection}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>AI</Text>
              <Text style={styles.statLabel}>Powered</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>5</Text>
              <Text style={styles.statLabel}>Platforms</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>30s</Text>
              <Text style={styles.statLabel}>To Decide</Text>
            </View>
          </View>
        </View>
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
  bgDecoration: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.08,
  },
  bgCircle1: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    backgroundColor: '#f857a6',
    top: -SCREEN_WIDTH * 0.3,
    right: -SCREEN_WIDTH * 0.2,
  },
  bgCircle2: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.6,
    backgroundColor: '#667eea',
    bottom: -SCREEN_WIDTH * 0.2,
    left: -SCREEN_WIDTH * 0.2,
  },
  contentScroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(248, 87, 166, 0.3)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 44,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -1,
  },
  logoAccent: {
    color: '#f857a6',
  },
  tagline: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  ctaContainer: {
    width: '100%',
    maxWidth: 280,
    marginBottom: 32,
    position: 'relative',
  },
  ctaGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    backgroundColor: '#f857a6',
    borderRadius: 40,
  },
  ctaButton: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#f857a6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  ctaGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  ctaText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  featureText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default PlayScreen;
