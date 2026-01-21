/**
 * FeatureCallout Component
 *
 * A tooltip-style callout that appears once to explain a feature.
 * Uses AsyncStorage to track which callouts have been dismissed.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CALLOUTS_KEY = '@playnxt_callouts_seen';

/**
 * Check if a specific callout has been seen
 */
export const hasSeenCallout = async (calloutId) => {
  try {
    const seen = await AsyncStorage.getItem(CALLOUTS_KEY);
    const seenCallouts = seen ? JSON.parse(seen) : [];
    return seenCallouts.includes(calloutId);
  } catch (error) {
    return false;
  }
};

/**
 * Mark a callout as seen
 */
export const markCalloutSeen = async (calloutId) => {
  try {
    const seen = await AsyncStorage.getItem(CALLOUTS_KEY);
    const seenCallouts = seen ? JSON.parse(seen) : [];
    if (!seenCallouts.includes(calloutId)) {
      seenCallouts.push(calloutId);
      await AsyncStorage.setItem(CALLOUTS_KEY, JSON.stringify(seenCallouts));
    }
  } catch (error) {
    console.warn('Failed to save callout state:', error);
  }
};

/**
 * Reset all callouts (for testing)
 */
export const resetAllCallouts = async () => {
  try {
    await AsyncStorage.removeItem(CALLOUTS_KEY);
  } catch (error) {
    console.warn('Failed to reset callouts:', error);
  }
};

const FeatureCallout = ({
  id,
  title,
  description,
  emoji,
  visible,
  onDismiss,
  position = 'center', // 'top', 'center', 'bottom'
}) => {
  const [show, setShow] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const checkAndShow = async () => {
      if (visible) {
        const seen = await hasSeenCallout(id);
        if (!seen) {
          setShow(true);
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
              toValue: 1,
              friction: 8,
              tension: 40,
              useNativeDriver: true,
            }),
          ]).start();
        }
      }
    };

    checkAndShow();
  }, [visible, id]);

  const handleDismiss = async () => {
    await markCalloutSeen(id);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShow(false);
      onDismiss?.();
    });
  };

  if (!show) return null;

  const positionStyle = {
    top: styles.positionTop,
    center: styles.positionCenter,
    bottom: styles.positionBottom,
  }[position];

  return (
    <Modal transparent visible={show} animationType="none">
      <BlurView intensity={20} tint="dark" style={styles.overlay}>
        <TouchableOpacity
          style={[styles.container, positionStyle]}
          activeOpacity={1}
          onPress={handleDismiss}
        >
          <Animated.View
            style={[
              styles.calloutCard,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {emoji && <Text style={styles.emoji}>{emoji}</Text>}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
            <TouchableOpacity style={styles.gotItButton} onPress={handleDismiss}>
              <Text style={styles.gotItText}>Got it!</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    flex: 1,
    paddingHorizontal: 32,
  },
  positionTop: {
    justifyContent: 'flex-start',
    paddingTop: 120,
  },
  positionCenter: {
    justifyContent: 'center',
  },
  positionBottom: {
    justifyContent: 'flex-end',
    paddingBottom: 120,
  },
  calloutCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248, 87, 166, 0.3)',
    shadowColor: '#f857a6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#a0a0b0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  gotItButton: {
    backgroundColor: 'rgba(248, 87, 166, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f857a6',
  },
  gotItText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f857a6',
  },
});

export default FeatureCallout;
