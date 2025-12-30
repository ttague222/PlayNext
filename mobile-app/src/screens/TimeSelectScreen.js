/**
 * PlayNext Time Selection Screen
 *
 * Required input: How much time do you have?
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRecommendation } from '../context/RecommendationContext';

const TIME_OPTIONS = [
  { value: 15, label: '15 min', description: 'Quick break', icon: '⚡' },
  { value: 30, label: '30 min', description: 'Short session', icon: '🎯' },
  { value: 60, label: '1 hour', description: 'Good session', icon: '🎮' },
  { value: 90, label: '90 min', description: 'Extended play', icon: '🔥' },
  { value: 120, label: '2+ hours', description: 'Deep dive', icon: '🚀' },
];

const TimeSelectScreen = () => {
  const navigation = useNavigation();
  const { preferences, updatePreference } = useRecommendation();

  // Staggered animation for options
  const animValues = useRef(TIME_OPTIONS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = animValues.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        useNativeDriver: true,
      })
    );
    Animated.stagger(80, animations).start();
  }, []);

  const handleSelect = (value) => {
    updatePreference('timeAvailable', value);
    navigation.navigate('MoodSelect');
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
            <View style={[styles.progressDot, styles.progressActive]} />
            <View style={styles.progressLine} />
            <View style={styles.progressDot} />
            <View style={styles.progressLine} />
            <View style={styles.progressDot} />
          </View>

          {/* Question */}
          <Text style={styles.stepLabel}>STEP 1 OF 3</Text>
          <Text style={styles.question}>How much time do you have?</Text>
          <Text style={styles.hint}>We'll find games that fit your schedule</Text>

          {/* Options */}
          <View style={styles.options}>
            {TIME_OPTIONS.map((option, index) => {
              const isSelected = preferences.timeAvailable === option.value;

              return (
                <Animated.View
                  key={option.value}
                  style={{
                    opacity: animValues[index],
                    transform: [{
                      translateX: animValues[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0],
                      }),
                    }],
                  }}
                >
                  <TouchableOpacity
                    style={[styles.optionButton, isSelected && styles.optionSelected]}
                    onPress={() => handleSelect(option.value)}
                    activeOpacity={0.7}
                  >
                    {isSelected && (
                      <LinearGradient
                        colors={['rgba(248, 87, 166, 0.2)', 'rgba(255, 88, 88, 0.1)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      />
                    )}
                    <Text style={styles.optionIcon}>{option.icon}</Text>
                    <View style={styles.optionTextContainer}>
                      <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                        {option.label}
                      </Text>
                      <Text style={styles.optionDescription}>{option.description}</Text>
                    </View>
                    {isSelected && (
                      <View style={styles.checkmark}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
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
    paddingHorizontal: 24,
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
    width: 12,
    height: 12,
    shadowColor: '#f857a6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#404060',
    marginHorizontal: 4,
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
  options: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  optionSelected: {
    borderColor: '#f857a6',
    shadowColor: '#f857a6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  optionIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: '#f857a6',
  },
  optionDescription: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f857a6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '700',
  },
});

export default TimeSelectScreen;
