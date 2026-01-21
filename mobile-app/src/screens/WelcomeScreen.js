/**
 * PlayNext Welcome Screen
 *
 * First-time user onboarding that explains the app concept.
 * Only shown once, then user proceeds to the main app.
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const WELCOME_SEEN_KEY = '@playnxt_welcome_seen';

const SLIDES = [
  {
    icon: 'game-controller',
    iconType: 'ionicons',
    title: 'Find Your Next Game',
    description: 'Tell us your time and mood, and we\'ll recommend the perfect game for right now.',
  },
  {
    icon: 'time-outline',
    iconType: 'ionicons',
    title: 'Fits Your Schedule',
    description: 'Whether you have 15 minutes or 2 hours, we\'ll match games to your available time.',
  },
  {
    icon: 'flash',
    iconType: 'ionicons',
    title: 'Mood Matched',
    description: 'Feeling chill or intense? We\'ll find games that match your energy level.',
  },
  {
    icon: 'refresh-circle',
    iconType: 'ionicons',
    title: '3 Free Rerolls Daily',
    description: 'Not feeling the picks? Reroll up to 3 times free each day. After that, watch a quick ad or go premium.',
  },
];

// Icon component with glow effect
const SlideIcon = ({ icon, iconType }) => {
  const IconComponent = iconType === 'ionicons' ? Ionicons : MaterialCommunityIcons;

  return (
    <View style={styles.iconContainer}>
      <View style={styles.iconGlow} />
      <LinearGradient
        colors={['rgba(99, 102, 241, 0.2)', 'rgba(139, 92, 246, 0.2)']}
        style={styles.iconBackground}
      >
        <IconComponent name={icon} size={64} color="#a78bfa" />
      </LinearGradient>
    </View>
  );
};

const WelcomeScreen = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const handleNext = async () => {
    if (currentSlide < SLIDES.length - 1) {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -30,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentSlide(currentSlide + 1);
        slideAnim.setValue(30);
        // Animate in
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      await markWelcomeSeen();
      onComplete();
    }
  };

  const handleSkip = async () => {
    await markWelcomeSeen();
    onComplete();
  };

  const markWelcomeSeen = async () => {
    try {
      await AsyncStorage.setItem(WELCOME_SEEN_KEY, 'true');
    } catch (error) {
      console.warn('Failed to save welcome state:', error);
    }
  };

  const slide = SLIDES[currentSlide];
  const isLastSlide = currentSlide === SLIDES.length - 1;

  return (
    <LinearGradient
      colors={['#0f0c29', '#302b63', '#24243e']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Skip button */}
        {!isLastSlide && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}

        {/* Content */}
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.slideContent,
              {
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <SlideIcon icon={slide.icon} iconType={slide.iconType} />
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.description}>{slide.description}</Text>
          </Animated.View>
        </View>

        {/* Progress dots */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentSlide && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Action button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleNext}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={isLastSlide ? ['#f857a6', '#ff5858'] : ['#6366f1', '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionGradient}
          >
            <Text style={styles.actionText}>
              {isLastSlide ? 'Get Started' : 'Next'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
};

/**
 * Check if welcome has been seen
 */
export const hasSeenWelcome = async () => {
  try {
    const seen = await AsyncStorage.getItem(WELCOME_SEEN_KEY);
    return seen === 'true';
  } catch (error) {
    return false;
  }
};

/**
 * Reset welcome state (for testing)
 */
export const resetWelcome = async () => {
  try {
    await AsyncStorage.removeItem(WELCOME_SEEN_KEY);
  } catch (error) {
    console.warn('Failed to reset welcome state:', error);
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 16,
    color: '#808090',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#8b5cf6',
    opacity: 0.15,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
  },
  iconBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    color: '#a0a0b0',
    textAlign: 'center',
    lineHeight: 26,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#404060',
  },
  dotActive: {
    backgroundColor: '#f857a6',
    width: 24,
  },
  actionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  actionGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default WelcomeScreen;
