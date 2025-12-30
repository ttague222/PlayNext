/**
 * PlayNext Mood Selection Screen
 *
 * Required input: What's your energy level?
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRecommendation } from '../context/RecommendationContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 24;
const GRID_GAP = 16;
const ITEM_WIDTH = (SCREEN_WIDTH - (GRID_PADDING * 2) - GRID_GAP) / 2;

const MOOD_OPTIONS = [
  {
    value: 'wind_down',
    label: 'Wind Down',
    description: 'Relaxing, peaceful vibes',
    emoji: '😌',
    color: '#7c3aed',
  },
  {
    value: 'casual',
    label: 'Casual',
    description: 'Light & easygoing',
    emoji: '🙂',
    color: '#06b6d4',
  },
  {
    value: 'focused',
    label: 'Focused',
    description: 'Ready to get immersed',
    emoji: '🎯',
    color: '#f59e0b',
  },
  {
    value: 'intense',
    label: 'Intense',
    description: 'Bring the challenge!',
    emoji: '🔥',
    color: '#ef4444',
  },
];

const MoodSelectScreen = () => {
  const navigation = useNavigation();
  const { preferences, updatePreference } = useRecommendation();

  // Staggered animation for options
  const animValues = useRef(MOOD_OPTIONS.map(() => new Animated.Value(0))).current;
  const scaleValues = useRef(MOOD_OPTIONS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    const animations = animValues.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      })
    );
    Animated.stagger(100, animations).start();
  }, []);

  const handlePressIn = (index) => {
    Animated.spring(scaleValues[index], {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (index) => {
    Animated.spring(scaleValues[index], {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const handleSelect = (value) => {
    updatePreference('energyMood', value);
    navigation.navigate('OptionalFilters');
  };

  return (
    <LinearGradient
      colors={['#0f0c29', '#302b63', '#24243e']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Progress indicator */}
          <View style={styles.progress}>
            <View style={[styles.progressDot, styles.progressComplete]} />
            <View style={[styles.progressLine, styles.progressLineComplete]} />
            <View style={[styles.progressDot, styles.progressActive]} />
            <View style={styles.progressLine} />
            <View style={styles.progressDot} />
          </View>

          {/* Question */}
          <Text style={styles.stepLabel}>STEP 2 OF 3</Text>
          <Text style={styles.question}>What's your energy?</Text>
          <Text style={styles.hint}>We'll match games to your mood</Text>

          {/* Options - 2x2 Grid */}
          <View style={styles.optionsGrid}>
            {/* Row 1 */}
            <View style={styles.gridRow}>
              {MOOD_OPTIONS.slice(0, 2).map((option, index) => {
                const isSelected = preferences.energyMood === option.value;

                return (
                  <Animated.View
                    key={option.value}
                    style={[
                      styles.optionWrapper,
                      {
                        opacity: animValues[index],
                        transform: [
                          { scale: scaleValues[index] },
                          {
                            translateY: animValues[index].interpolate({
                              inputRange: [0, 1],
                              outputRange: [30, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        isSelected && styles.optionSelected,
                        isSelected && { borderColor: option.color },
                      ]}
                      onPress={() => handleSelect(option.value)}
                      onPressIn={() => handlePressIn(index)}
                      onPressOut={() => handlePressOut(index)}
                      activeOpacity={1}
                    >
                      {isSelected && (
                        <LinearGradient
                          colors={[`${option.color}30`, `${option.color}10`]}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <Text style={styles.emoji}>{option.emoji}</Text>
                      <Text style={[styles.optionLabel, isSelected && { color: option.color }]}>
                        {option.label}
                      </Text>
                      <Text style={styles.optionDescription}>{option.description}</Text>
                      {isSelected && (
                        <View style={[styles.checkmark, { backgroundColor: option.color }]}>
                          <Text style={styles.checkmarkText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
            {/* Row 2 */}
            <View style={styles.gridRow}>
              {MOOD_OPTIONS.slice(2, 4).map((option, index) => {
                const actualIndex = index + 2;
                const isSelected = preferences.energyMood === option.value;

                return (
                  <Animated.View
                    key={option.value}
                    style={[
                      styles.optionWrapper,
                      {
                        opacity: animValues[actualIndex],
                        transform: [
                          { scale: scaleValues[actualIndex] },
                          {
                            translateY: animValues[actualIndex].interpolate({
                              inputRange: [0, 1],
                              outputRange: [30, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        isSelected && styles.optionSelected,
                        isSelected && { borderColor: option.color },
                      ]}
                      onPress={() => handleSelect(option.value)}
                      onPressIn={() => handlePressIn(actualIndex)}
                      onPressOut={() => handlePressOut(actualIndex)}
                      activeOpacity={1}
                    >
                      {isSelected && (
                        <LinearGradient
                          colors={[`${option.color}30`, `${option.color}10`]}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <Text style={styles.emoji}>{option.emoji}</Text>
                      <Text style={[styles.optionLabel, isSelected && { color: option.color }]}>
                        {option.label}
                      </Text>
                      <Text style={styles.optionDescription}>{option.description}</Text>
                      {isSelected && (
                        <View style={[styles.checkmark, { backgroundColor: option.color }]}>
                          <Text style={styles.checkmarkText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
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
  content: {
    flex: 1,
    paddingHorizontal: GRID_PADDING - (GRID_GAP / 2),
    paddingTop: 20,
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
    marginBottom: 40,
  },
  optionsGrid: {
    flexDirection: 'column',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: GRID_GAP,
  },
  optionWrapper: {
    flex: 1,
    marginHorizontal: GRID_GAP / 2,
  },
  optionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 160,
  },
  optionSelected: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  optionDescription: {
    fontSize: 12,
    color: '#a0a0a0',
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '700',
  },
});

export default MoodSelectScreen;
