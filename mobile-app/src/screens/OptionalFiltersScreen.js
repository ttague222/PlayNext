/**
 * PlayNext Optional Filters Screen
 *
 * Optional inputs: Platform, Play Style, Session Type, Discovery Mode
 * Supports multi-select for platforms and play styles
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRecommendation } from '../context/RecommendationContext';
import { usePremium } from '../context/PremiumContext';

const PLATFORM_OPTIONS = [
  { value: 'pc', label: 'PC' },
  { value: 'playstation', label: 'PlayStation' },
  { value: 'xbox', label: 'Xbox' },
  { value: 'switch', label: 'Switch' },
  { value: 'mobile', label: 'Mobile' },
];

// All genre options - combines play styles and game categories
// Maps to both play_style and genre_tags in the backend
const ALL_GENRE_OPTIONS = [
  // Experience-based (from play styles)
  { value: 'narrative', label: 'Story-Driven', icon: '📖' },
  { value: 'action', label: 'Action', icon: '⚔️' },
  { value: 'puzzle', label: 'Puzzle', icon: '🧩' },
  { value: 'strategy', label: 'Strategy', icon: '♟️' },
  { value: 'sandbox_creative', label: 'Sandbox', icon: '🏗️' },
  // Genre-based (from categories)
  { value: 'rpg', label: 'RPG', icon: '🗡️' },
  { value: 'fps', label: 'Shooter', icon: '🎯' },
  { value: 'simulation', label: 'Simulation', icon: '🏙️' },
  { value: 'sports', label: 'Sports', icon: '⚽' },
  { value: 'horror', label: 'Horror', icon: '👻' },
  { value: 'platformer', label: 'Platformer', icon: '🏃' },
  { value: 'racing', label: 'Racing', icon: '🏎️' },
  { value: 'roguelike', label: 'Roguelike', icon: '💀' },
  { value: 'survival', label: 'Survival', icon: '🏕️' },
  { value: 'indie', label: 'Indie', icon: '🎨' },
];

// Map moods to appropriate genres
// This prevents users from selecting laid-back genres when in "intense" mood
const MOOD_TO_GENRES = {
  // Intense: High-energy, challenging, competitive games
  intense: [
    'action',
    'fps',
    'horror',
    'roguelike',
    'survival',
    'racing',
    'sports',
  ],
  // Focused: Immersive, engaging games that require attention
  focused: [
    'narrative',
    'action',
    'strategy',
    'rpg',
    'fps',
    'horror',
    'platformer',
    'roguelike',
    'survival',
  ],
  // Casual: Lighter games, good variety
  casual: [
    'narrative',
    'action',
    'puzzle',
    'strategy',
    'sandbox_creative',
    'rpg',
    'simulation',
    'sports',
    'platformer',
    'racing',
    'indie',
  ],
  // Wind down: Relaxing, low-stress games
  wind_down: [
    'narrative',
    'puzzle',
    'sandbox_creative',
    'simulation',
    'indie',
  ],
};

// Get filtered genre options based on selected mood
const getGenreOptionsForMood = (energyMood) => {
  if (!energyMood || !MOOD_TO_GENRES[energyMood]) {
    return ALL_GENRE_OPTIONS; // Show all if no mood selected
  }
  const allowedGenres = MOOD_TO_GENRES[energyMood];
  return ALL_GENRE_OPTIONS.filter(genre => allowedGenres.includes(genre.value));
};

const OptionalFiltersScreen = () => {
  const navigation = useNavigation();
  const { preferences, updatePreference, getRecommendations } = useRecommendation();
  const {
    recordRecommendationFetch,
    dailyRerollCount,
    shouldShowAdBeforeReroll,
    showRewardedAd,
    isPremium,
    isAdLoading,
  } = usePremium();

  const [showingAd, setShowingAd] = useState(false);

  // Get filtered genre options based on the user's mood selection
  const filteredGenreOptions = getGenreOptionsForMood(preferences.energyMood);
  const allowedGenreValues = filteredGenreOptions.map(g => g.value);

  // Clear any selected genres that are no longer valid for the current mood
  useEffect(() => {
    if (preferences.genres && preferences.genres.length > 0) {
      const validGenres = preferences.genres.filter(g => allowedGenreValues.includes(g));
      if (validGenres.length !== preferences.genres.length) {
        updatePreference('genres', validGenres);
      }
    }
  }, [preferences.energyMood]); // Re-run when mood changes

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulsing CTA button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleGetRecommendations = async () => {
    // Check if user needs to watch an ad before getting recommendations
    // This prevents the exploit where users navigate back to get unlimited free recommendations
    // shouldShowAdBeforeReroll checks if dailyRerollCount >= adInterval
    if (shouldShowAdBeforeReroll()) {
      setShowingAd(true);
      const adCompleted = await showRewardedAd();
      setShowingAd(false);

      if (!adCompleted) {
        // User didn't complete ad - don't proceed
        return;
      }
    }

    // Track the recommendation fetch - every fetch counts toward the daily limit
    recordRecommendationFetch();

    // Navigate immediately - Results screen will show loading state
    navigation.navigate('Results');
    // Start fetching in background
    getRecommendations().catch((error) => {
      console.error('Failed to get recommendations:', error);
    });
  };

  // Toggle a value in an array (multi-select)
  const toggleMultiSelect = (key, value) => {
    const currentValues = preferences[key] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    updatePreference(key, newValues);
  };

  // Multi-select filter section
  const MultiSelectSection = ({ title, subtitle, options, selectedValues, prefKey }) => (
    <View style={styles.filterSection}>
      <Text style={styles.filterTitle}>{title}</Text>
      {subtitle && <Text style={styles.filterSubtitle}>{subtitle}</Text>}
      <View style={styles.filterOptions}>
        {options.map((option) => {
          const isSelected = selectedValues.includes(option.value);
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              onPress={() => toggleMultiSelect(prefKey, option.value)}
            >
              {isSelected && (
                <LinearGradient
                  colors={['rgba(248, 87, 166, 0.3)', 'rgba(255, 88, 88, 0.2)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              )}
              {option.icon && <Text style={styles.filterChipIcon}>{option.icon}</Text>}
              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                {option.label}
              </Text>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={['#0f0c29', '#302b63', '#24243e']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Back button - iOS only */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color="#ffffff" />
          </TouchableOpacity>
        )}

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Progress indicator */}
          <View style={styles.progress}>
            <View style={[styles.progressDot, styles.progressComplete]} />
            <View style={[styles.progressLine, styles.progressLineComplete]} />
            <View style={[styles.progressDot, styles.progressComplete]} />
            <View style={[styles.progressLine, styles.progressLineComplete]} />
            <View style={[styles.progressDot, styles.progressActive]} />
          </View>

          {/* Header */}
          <Text style={styles.stepLabel}>STEP 3 OF 3</Text>
          <Text style={styles.question}>Fine-tune your picks</Text>
          <Text style={styles.hint}>Select multiple options or leave empty for any</Text>

          {/* Filters */}
          <View style={styles.filtersContainer}>
            <MultiSelectSection
              title="Platform"
              subtitle="Select all that apply"
              options={PLATFORM_OPTIONS}
              selectedValues={preferences.platforms || []}
              prefKey="platforms"
            />

            <MultiSelectSection
              title="Genres"
              subtitle={`Filtered for your ${preferences.energyMood?.replace('_', ' ') || ''} mood`}
              options={filteredGenreOptions}
              selectedValues={preferences.genres || []}
              prefKey="genres"
            />

            {/* Play Mode toggle */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Play Mode</Text>
              <View style={styles.playModeToggle}>
                <TouchableOpacity
                  style={[
                    styles.playModeOption,
                    preferences.sessionType === 'solo' && styles.playModeSelected,
                  ]}
                  onPress={() => updatePreference('sessionType', 'solo')}
                >
                  {preferences.sessionType === 'solo' && (
                    <LinearGradient
                      colors={['rgba(6, 182, 212, 0.2)', 'rgba(6, 182, 212, 0.1)']}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Text style={styles.playModeEmoji}>🎮</Text>
                  <Text style={[
                    styles.playModeLabel,
                    preferences.sessionType === 'solo' && styles.playModeLabelSelected
                  ]}>Solo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.playModeOption,
                    preferences.sessionType === 'multiplayer' && styles.playModeSelected,
                    preferences.sessionType === 'multiplayer' && { borderColor: '#a855f7' },
                  ]}
                  onPress={() => updatePreference('sessionType', 'multiplayer')}
                >
                  {preferences.sessionType === 'multiplayer' && (
                    <LinearGradient
                      colors={['rgba(168, 85, 247, 0.2)', 'rgba(168, 85, 247, 0.1)']}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Text style={styles.playModeEmoji}>👥</Text>
                  <Text style={[
                    styles.playModeLabel,
                    preferences.sessionType === 'multiplayer' && { color: '#a855f7' }
                  ]}>With Friends</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.playModeOption,
                    preferences.sessionType === 'any' && styles.playModeSelected,
                    preferences.sessionType === 'any' && { borderColor: '#4ade80' },
                  ]}
                  onPress={() => updatePreference('sessionType', 'any')}
                >
                  {preferences.sessionType === 'any' && (
                    <LinearGradient
                      colors={['rgba(74, 222, 128, 0.2)', 'rgba(74, 222, 128, 0.1)']}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Text style={styles.playModeEmoji}>🎲</Text>
                  <Text style={[
                    styles.playModeLabel,
                    preferences.sessionType === 'any' && { color: '#4ade80' }
                  ]}>Any</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Discovery toggle */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Discovery Mode</Text>
              <View style={styles.discoveryToggle}>
                <TouchableOpacity
                  style={[
                    styles.discoveryOption,
                    preferences.discoveryMode === 'familiar' && styles.discoverySelected,
                  ]}
                  onPress={() => updatePreference('discoveryMode', 'familiar')}
                >
                  {preferences.discoveryMode === 'familiar' && (
                    <LinearGradient
                      colors={['rgba(6, 182, 212, 0.2)', 'rgba(6, 182, 212, 0.1)']}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Text style={styles.discoveryEmoji}>🏆</Text>
                  <Text style={[
                    styles.discoveryLabel,
                    preferences.discoveryMode === 'familiar' && styles.discoveryLabelSelected
                  ]}>Familiar</Text>
                  <Text style={styles.discoveryHint}>Popular titles</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.discoveryOption,
                    preferences.discoveryMode === 'surprise' && styles.discoverySelected,
                    preferences.discoveryMode === 'surprise' && { borderColor: '#f59e0b' },
                  ]}
                  onPress={() => updatePreference('discoveryMode', 'surprise')}
                >
                  {preferences.discoveryMode === 'surprise' && (
                    <LinearGradient
                      colors={['rgba(245, 158, 11, 0.2)', 'rgba(245, 158, 11, 0.1)']}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Text style={styles.discoveryEmoji}>💎</Text>
                  <Text style={[
                    styles.discoveryLabel,
                    preferences.discoveryMode === 'surprise' && { color: '#f59e0b' }
                  ]}>Surprise me</Text>
                  <Text style={styles.discoveryHint}>Hidden gems</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Selected count indicator */}
          {(preferences.platforms?.length > 0 || preferences.genres?.length > 0) && (
            <View style={styles.selectionSummary}>
              <Text style={styles.selectionText}>
                {preferences.platforms?.length > 0 && `${preferences.platforms.length} platform${preferences.platforms.length > 1 ? 's' : ''}`}
                {preferences.platforms?.length > 0 && preferences.genres?.length > 0 && ' · '}
                {preferences.genres?.length > 0 && `${preferences.genres.length} genre${preferences.genres.length > 1 ? 's' : ''}`}
              </Text>
            </View>
          )}

          {/* Get recommendations button */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.ctaButton, (showingAd || isAdLoading) && styles.ctaButtonDisabled]}
              onPress={handleGetRecommendations}
              activeOpacity={0.9}
              disabled={showingAd || isAdLoading}
            >
              <LinearGradient
                colors={(showingAd || isAdLoading) ? ['#666', '#555'] : ['#f857a6', '#ff5858']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                <Text style={styles.ctaIcon}>{showingAd ? '📺' : '🎯'}</Text>
                <Text style={styles.ctaText}>
                  {showingAd ? 'Loading Ad...' : 'Show My Games'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.skipText}>
            All filters are optional
          </Text>
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
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 16,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#404060',
  },
  progressActive: {
    backgroundColor: '#f857a6',
    shadowColor: '#f857a6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  progressComplete: {
    backgroundColor: '#4ade80',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#404060',
    marginHorizontal: 4,
  },
  progressLineComplete: {
    backgroundColor: '#4ade80',
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f857a6',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 2,
  },
  question: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    fontSize: 16,
    color: '#808090',
    textAlign: 'center',
    marginBottom: 32,
  },
  filtersContainer: {
    marginBottom: 24,
  },
  filterSection: {
    marginBottom: 28,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#a0a0b0',
    marginBottom: 6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  filterSubtitle: {
    fontSize: 13,
    color: '#707080',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  filterChipSelected: {
    borderColor: '#f857a6',
  },
  filterChipIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#a0a0a0',
  },
  filterChipTextSelected: {
    color: '#ffffff',
  },
  checkmark: {
    fontSize: 14,
    color: '#4ade80',
    marginLeft: 8,
    fontWeight: '700',
  },
  selectionSummary: {
    alignItems: 'center',
    marginBottom: 16,
  },
  selectionText: {
    fontSize: 14,
    color: '#f857a6',
    fontWeight: '600',
  },
  discoveryToggle: {
    flexDirection: 'row',
    gap: 12,
  },
  discoveryOption: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    overflow: 'hidden',
  },
  discoverySelected: {
    borderColor: '#06b6d4',
  },
  discoveryEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  discoveryLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  discoveryLabelSelected: {
    color: '#06b6d4',
  },
  discoveryHint: {
    fontSize: 12,
    color: '#808090',
  },
  playModeToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  playModeOption: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    overflow: 'hidden',
  },
  playModeSelected: {
    borderColor: '#06b6d4',
  },
  playModeEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  playModeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  playModeLabelSelected: {
    color: '#06b6d4',
  },
  ctaButton: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#f857a6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  ctaButtonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaGradient: {
    paddingVertical: 20,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  ctaIcon: {
    fontSize: 24,
  },
  ctaText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  skipText: {
    fontSize: 14,
    color: '#606080',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default OptionalFiltersScreen;
