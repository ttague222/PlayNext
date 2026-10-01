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
import { getLastContext, getCachedPicks, fetchTonightsPicks, recordTonightView, localDateString } from '../services/tonightService';
import { maybeOfferTonightReminder } from '../utils/tonightReminderPrompt';
import { logEvent } from '../services/analyticsService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PlayScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    startSession,
    resetPreferences,
    startTonightSession,
  } = useRecommendation();
  const { notForMeGameIds } = useSavedGames();

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

  const loadTonight = useCallback(async () => {
    try {
      const context = await getLastContext();
      if (!context) {
        setTonightStatus('hidden');
        return null;
      }
      setTonightContext(context);
      const cached = await getCachedPicks();
      if (cached) {
        setTonightCache(cached);
        setTonightStatus('ready');
        return cached;
      }
      setTonightStatus('loading');
      const fresh = await fetchTonightsPicks({ excludedGameIds: notForMeRef.current || [] });
      if (fresh) {
        setTonightCache(fresh);
        setTonightStatus('ready');
        return fresh;
      }
      setTonightStatus('hidden');
      return null;
    } catch {
      setTonightStatus('error');
      return null;
    }
  }, []);

  // Refresh on every focus: catches date rollover and post-session cache rewrites.
  useFocusEffect(
    useCallback(() => {
      loadTonight();
    }, [loadTonight])
  );

  const openTonight = useCallback(
    async (cache, via) => {
      if (!startTonightSession(cache)) return;
      await recordTonightView();
      logEvent('tonight_picks_viewed', { via });
      navigation.navigate('Results');
      maybeOfferTonightReminder();
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
      // The date guard covers an app parked on this tab across midnight with
      // no refocus: a stale-day cache falls through to a fresh load instead.
      if (tonightStatus === 'ready' && tonightCache && tonightCache.date === localDateString()) {
        await openTonight(tonightCache, 'card');
        return;
      }
      // loading/error: (re)try, then open if it lands
      const cache = await loadTonight();
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

  // Notification deep link: open tonight's picks as soon as they're available.
  // The notification sender passes `openTonight` as a nonce (e.g. Date.now())
  // so a re-tap of the same notification re-fires; clear the param once
  // consumed so remounts/re-renders don't replay it.
  useEffect(() => {
    if (!route?.params?.openTonight) return;
    (async () => {
      try {
        const cache = tonightStatus === 'ready' && tonightCache ? tonightCache : await loadTonight();
        if (cache) await openTonight(cache, 'notification');
      } finally {
        navigation.setParams({ openTonight: undefined });
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
      colors={['#0a0a1a', '#1a1a2e', '#16213e']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Background decoration */}
        <View style={styles.bgDecoration}>
          <View style={[styles.bgCircle, styles.bgCircle1]} />
          <View style={[styles.bgCircle, styles.bgCircle2]} />
        </View>

        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Center Icon */}
          <Animated.View style={[styles.iconContainer, { transform: [{ translateY: floatAnim }] }]}>
            <LinearGradient
              colors={['rgba(248, 87, 166, 0.15)', 'rgba(255, 88, 88, 0.1)']}
              style={styles.iconBg}
            >
              <Ionicons name="game-controller" size={56} color="#f857a6" />
            </LinearGradient>
          </Animated.View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>
              Play<Text style={styles.logoAccent}>Nxt</Text>
            </Text>
            <Text style={styles.tagline}>Find your perfect game</Text>
          </View>

          {/* Main CTA */}
          <View style={styles.ctaContainer}>
            <Animated.View style={[styles.ctaGlow, { opacity: glowOpacity }]} />
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={handleStart}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#f857a6', '#ff5858']}
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

          {/* Feature Pills */}
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
