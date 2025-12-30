/**
 * PlayNxt Play Screen (Primary Tab)
 *
 * Core functionality - helps user decide what to play right now.
 * Entry point for the recommendation flow.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Easing,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRecommendation } from '../context/RecommendationContext';
import ReturnFeedbackPrompt from '../components/ReturnFeedbackPrompt';

const PlayScreen = () => {
  const navigation = useNavigation();
  const {
    startSession,
    resetPreferences,
    pendingFeedback,
    submitDelayedFeedback,
    dismissPendingFeedback,
  } = useRecommendation();

  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [hasShownFeedbackThisSession, setHasShownFeedbackThisSession] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Check for pending feedback when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Only show once per app session and if there's pending feedback
      if (pendingFeedback && !hasShownFeedbackThisSession) {
        // Small delay to let the screen fully appear
        const timer = setTimeout(() => {
          setShowFeedbackPrompt(true);
          setHasShownFeedbackThisSession(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    }, [pendingFeedback, hasShownFeedbackThisSession])
  );

  const handleFeedbackSubmit = async (signalType) => {
    await submitDelayedFeedback(signalType);
    setShowFeedbackPrompt(false);
  };

  const handleFeedbackDismiss = async () => {
    await dismissPendingFeedback();
    setShowFeedbackPrompt(false);
  };

  useEffect(() => {
    // Pulsing CTA button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
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
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Floating icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleStart = () => {
    resetPreferences();
    // Start session in background - don't wait for it
    // Session will be ready by the time we need it for recommendations
    startSession();
    navigation.navigate('TimeSelect');
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <LinearGradient
      colors={['#0f0c29', '#302b63', '#24243e']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Floating Icon */}
          <Animated.View style={[styles.iconContainer, { transform: [{ translateY: floatAnim }] }]}>
            <Text style={styles.heroIcon}>🎮</Text>
          </Animated.View>

          {/* Logo / Title */}
          <View style={styles.header}>
            <Text style={styles.logo}>Play<Text style={styles.logoAccent}>Nxt</Text></Text>
            <Text style={styles.tagline}>What should I play right now?</Text>
          </View>

          {/* Main CTA with glow */}
          <View style={styles.ctaContainer}>
            {/* Glow effect behind button */}
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
                  <Text style={styles.ctaIcon}>✨</Text>
                  <Text style={styles.ctaText}>Find My Game</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Get personalized recommendations in seconds
          </Text>

          {/* Features */}
          <View style={styles.features}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>⚡</Text>
              <Text style={styles.featureText}>Instant picks</Text>
            </View>
            <View style={styles.featureDivider} />
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🎯</Text>
              <Text style={styles.featureText}>Mood matched</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            All platforms · Personalized for you
          </Text>
        </View>

        {/* Return Feedback Prompt */}
        <ReturnFeedbackPrompt
          visible={showFeedbackPrompt}
          game={pendingFeedback}
          onFeedback={handleFeedbackSubmit}
          onDismiss={handleFeedbackDismiss}
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 20,
  },
  iconContainer: {
    marginBottom: 16,
  },
  heroIcon: {
    fontSize: 64,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 10,
    letterSpacing: -1,
  },
  logoAccent: {
    color: '#f857a6',
  },
  tagline: {
    fontSize: 18,
    color: '#b0b0b0',
    textAlign: 'center',
    fontWeight: '500',
  },
  ctaContainer: {
    width: '100%',
    maxWidth: 300,
    marginBottom: 20,
    position: 'relative',
  },
  ctaGlow: {
    position: 'absolute',
    top: -15,
    left: -15,
    right: -15,
    bottom: -15,
    backgroundColor: '#f857a6',
    borderRadius: 35,
    opacity: 0.3,
  },
  ctaButton: {
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#f857a6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  ctaGradient: {
    paddingVertical: 18,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaIcon: {
    fontSize: 22,
  },
  ctaText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#909090',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  features: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  featureIcon: {
    fontSize: 14,
  },
  featureText: {
    fontSize: 13,
    color: '#808080',
    fontWeight: '500',
  },
  featureDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#404060',
    marginHorizontal: 10,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#606080',
    fontWeight: '500',
  },
});

export default PlayScreen;
