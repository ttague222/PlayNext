/**
 * PlayNext Time Selection Screen
 *
 * Required input: How much time do you have?
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRecommendation } from '../context/RecommendationContext';
import { usePremium } from '../context/PremiumContext';
import api from '../services/api';
import { logEvent } from '../services/analyticsService';

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
  const { isPremium } = usePremium();
  const [isNavigating, setIsNavigating] = useState(false);

  // Backlog Mode (premium): whether a Steam library is synced.
  // null = unknown (not fetched yet or fetch failed).
  const [librarySynced, setLibrarySynced] = useState(null);

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

  // Reset navigation state when screen comes back into focus, and refresh
  // library status so returning from Connect Steam unlocks the toggle.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setIsNavigating(false);
      if (isPremium) {
        api
          .getSteamLibraryStatus()
          .then((status) => setLibrarySynced(!!status?.connected))
          .catch(() => {});
      }
    });
    return unsubscribe;
  }, [navigation, isPremium]);

  const handleSelect = (value) => {
    if (isNavigating) return; // Prevent double-tap navigation
    setIsNavigating(true);
    updatePreference('timeAvailable', value);
    navigation.navigate('MoodSelect');
  };

  const handleModeSelect = (libraryOnly) => {
    if (!libraryOnly) {
      updatePreference('libraryOnly', false);
      return;
    }
    if (!isPremium) {
      // Locked: open the premium sheet, never interrupt the default path
      logEvent('backlog_mode_locked_tap', {});
      navigation.navigate('Premium');
      return;
    }
    if (librarySynced === false || librarySynced === null) {
      // No synced library (or status unknown): route to Connect Steam —
      // it shows current state and the way to fix it either way
      logEvent('backlog_mode_needs_sync', {});
      navigation.navigate('ConnectSteam');
      return;
    }
    logEvent('backlog_mode_selected', {});
    updatePreference('libraryOnly', true);
  };

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

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
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

          {/* Backlog Mode toggle (premium) */}
          <View style={styles.modeToggle}>
            <Pressable
              style={[styles.modePill, !preferences.libraryOnly && styles.modePillActive]}
              onPress={() => handleModeSelect(false)}
              accessibilityLabel="Recommend from all games"
            >
              <Text
                style={[
                  styles.modePillText,
                  !preferences.libraryOnly && styles.modePillTextActive,
                ]}
              >
                Anything
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modePill, preferences.libraryOnly && styles.modePillActive]}
              onPress={() => handleModeSelect(true)}
              accessibilityLabel="Recommend from my Steam backlog"
            >
              {!isPremium && (
                <Ionicons
                  name="lock-closed"
                  size={13}
                  color={preferences.libraryOnly ? '#ffffff' : '#a0a0a0'}
                  style={styles.modePillIcon}
                />
              )}
              <Text
                style={[
                  styles.modePillText,
                  preferences.libraryOnly && styles.modePillTextActive,
                ]}
              >
                My backlog
              </Text>
            </Pressable>
          </View>
          {preferences.libraryOnly && (
            <Text style={styles.modeHint}>
              Picking from your unplayed Steam games
            </Text>
          )}

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
                  <Pressable
                    style={({ pressed }) => [
                      styles.optionButton,
                      isSelected && styles.optionSelected,
                      pressed && styles.optionPressed,
                      isNavigating && styles.optionDisabled,
                    ]}
                    onPress={() => handleSelect(option.value)}
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
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
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
    flexGrow: 1,
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
    marginBottom: 24,
  },
  modeToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  modePillActive: {
    backgroundColor: '#f857a6',
  },
  modePillIcon: {
    marginRight: 5,
  },
  modePillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a0a0a0',
  },
  modePillTextActive: {
    color: '#ffffff',
  },
  modeHint: {
    fontSize: 13,
    color: '#4ade80',
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 16,
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
  optionPressed: {
    opacity: 0.8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionDisabled: {
    opacity: 0.5,
  },
});

export default TimeSelectScreen;
