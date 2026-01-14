/**
 * PlayNxt Celebration Modal Component
 *
 * Shown immediately after user accepts a recommendation.
 * Celebrates their choice, shows a fun fact, and offers options to
 * continue browsing or go back home.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const CelebrationModal = ({ visible, game, onDismiss, onKeepBrowsing }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const funFactAnim = useRef(new Animated.Value(0)).current;
  const buttonsAnim = useRef(new Animated.Value(0)).current;
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (visible) {
      // Reset animations and state
      setIsAnimatingOut(false);
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
      funFactAnim.setValue(0);
      buttonsAnim.setValue(0);

      // Animate in with a celebratory bounce
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Animate fun fact in after a short delay
      const funFactTimer = setTimeout(() => {
        Animated.timing(funFactAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, 400);

      // Animate buttons in after fun fact
      const buttonsTimer = setTimeout(() => {
        Animated.timing(buttonsAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 700);

      return () => {
        clearTimeout(funFactTimer);
        clearTimeout(buttonsTimer);
      };
    }
  }, [visible]);

  const animateOut = (callback) => {
    if (isAnimatingOut) return; // Prevent double-tap
    setIsAnimatingOut(true);

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
    });
  };

  const handleGoHome = () => {
    if (isAnimatingOut) return;
    animateOut(onDismiss);
  };

  const handleKeepBrowsing = () => {
    if (isAnimatingOut) return;
    animateOut(onKeepBrowsing);
  };

  if (!game) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleGoHome}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Decorative sparkles */}
          <View style={styles.sparkleContainer}>
            <Text style={[styles.sparkle, styles.sparkle1]}>✨</Text>
            <Text style={[styles.sparkle, styles.sparkle2]}>🎉</Text>
            <Text style={[styles.sparkle, styles.sparkle3]}>✨</Text>
          </View>

          {/* Celebration emoji */}
          <Text style={styles.emoji}>🎮</Text>

          {/* Main message */}
          <Text style={styles.title}>Great choice!</Text>

          {/* Game name */}
          <View style={styles.gameContainer}>
            <Text style={styles.gameTitle}>{game.title}</Text>
          </View>

          {/* Fun Fact */}
          {game.fun_fact && (
            <Animated.View
              style={[
                styles.funFactContainer,
                {
                  opacity: funFactAnim,
                  transform: [{
                    translateY: funFactAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  }],
                },
              ]}
            >
              <View style={styles.funFactHeader}>
                <Text style={styles.funFactIcon}>💡</Text>
                <Text style={styles.funFactLabel}>Did you know?</Text>
              </View>
              <Text style={styles.funFactText}>{game.fun_fact}</Text>
            </Animated.View>
          )}

          {/* Encouragement */}
          <Text style={styles.subtitle}>Have fun playing!</Text>

          {/* Action Buttons */}
          <Animated.View
            style={[
              styles.buttonsContainer,
              {
                opacity: buttonsAnim,
                transform: [{
                  translateY: buttonsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                }],
              },
            ]}
            pointerEvents={isAnimatingOut ? 'none' : 'auto'}
          >
            {/* Primary: Keep Browsing */}
            <Pressable
              style={({ pressed }) => [
                styles.keepBrowsingButton,
                isAnimatingOut && styles.buttonDisabled,
                pressed && !isAnimatingOut && styles.buttonPressed,
              ]}
              onPress={handleKeepBrowsing}
            >
              <LinearGradient
                colors={isAnimatingOut ? ['#888', '#666'] : ['#f857a6', '#ff5858']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.keepBrowsingGradient}
              >
                <Text style={styles.keepBrowsingIcon}>🔍</Text>
                <Text style={styles.keepBrowsingText}>Keep Browsing</Text>
              </LinearGradient>
            </Pressable>

            {/* Secondary: I'm Done */}
            <Pressable
              style={({ pressed }) => [
                styles.doneButton,
                isAnimatingOut && styles.buttonDisabled,
                pressed && !isAnimatingOut && styles.buttonPressed,
              ]}
              onPress={handleGoHome}
            >
              <Text style={styles.doneText}>I'm all set</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    padding: 28,
    maxWidth: 340,
    width: '100%',
  },
  sparkleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  sparkle: {
    fontSize: 24,
  },
  sparkle1: {
    transform: [{ rotate: '-15deg' }],
  },
  sparkle2: {
    marginTop: -10,
  },
  sparkle3: {
    transform: [{ rotate: '15deg' }],
  },
  emoji: {
    fontSize: 72,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  gameContainer: {
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.4)',
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e94560',
    textAlign: 'center',
  },
  funFactContainer: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    width: '100%',
  },
  funFactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    gap: 6,
  },
  funFactIcon: {
    fontSize: 16,
  },
  funFactLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#a5b4fc',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  funFactText: {
    fontSize: 15,
    color: '#e0e0e0',
    lineHeight: 23,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#a0a0a0',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  keepBrowsingButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#f857a6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  keepBrowsingGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  keepBrowsingIcon: {
    fontSize: 18,
  },
  keepBrowsingText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  doneButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneText: {
    fontSize: 16,
    color: '#808090',
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});

export default CelebrationModal;
