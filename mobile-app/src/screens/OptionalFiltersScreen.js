/**
 * PlayNext Optional Filters Screen
 *
 * Optional inputs: Platform, Play Style, Session Type, Discovery Mode
 * Supports multi-select for platforms and play styles
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRecommendation } from '../context/RecommendationContext';

const PLATFORM_OPTIONS = [
  { value: 'pc', label: 'PC', icon: '🖥️' },
  { value: 'console', label: 'Console', icon: '🎮' },
  { value: 'handheld', label: 'Handheld', icon: '📱' },
];

const PLAY_STYLE_OPTIONS = [
  { value: 'narrative', label: 'Story', icon: '📖' },
  { value: 'action', label: 'Action', icon: '⚔️' },
  { value: 'puzzle_strategy', label: 'Puzzle', icon: '🧩' },
  { value: 'sandbox_creative', label: 'Sandbox', icon: '🏗️' },
];

const OptionalFiltersScreen = () => {
  const navigation = useNavigation();
  const { preferences, updatePreference, getRecommendations } = useRecommendation();

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

  const handleGetRecommendations = () => {
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
              <Text style={styles.filterChipIcon}>{option.icon}</Text>
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
              title="Play Style"
              subtitle="What are you in the mood for?"
              options={PLAY_STYLE_OPTIONS}
              selectedValues={preferences.playStyles || []}
              prefKey="playStyles"
            />

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
          {(preferences.platforms?.length > 0 || preferences.playStyles?.length > 0) && (
            <View style={styles.selectionSummary}>
              <Text style={styles.selectionText}>
                {preferences.platforms?.length > 0 && `${preferences.platforms.length} platform${preferences.platforms.length > 1 ? 's' : ''}`}
                {preferences.platforms?.length > 0 && preferences.playStyles?.length > 0 && ' · '}
                {preferences.playStyles?.length > 0 && `${preferences.playStyles.length} style${preferences.playStyles.length > 1 ? 's' : ''}`}
              </Text>
            </View>
          )}

          {/* Get recommendations button */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleGetRecommendations}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#f857a6', '#ff5858']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                <Text style={styles.ctaIcon}>🎯</Text>
                <Text style={styles.ctaText}>Show My Games</Text>
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
  ctaButton: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#f857a6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
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
