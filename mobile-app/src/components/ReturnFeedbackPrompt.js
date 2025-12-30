/**
 * PlayNxt Return Feedback Prompt Component
 *
 * Shown when user returns to the app after accepting a game.
 * Asks for feedback on how the game went - delayed from initial acceptance.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
} from 'react-native';

const ReturnFeedbackPrompt = ({
  visible,
  game,
  onFeedback,
  onDismiss,
}) => {
  const slideAnim = useRef(new Animated.Value(100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleFeedback = (signalType) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFeedback(signalType);
    });
  };

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!game) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={handleDismiss}
        />

        <Animated.View
          style={[
            styles.promptContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>👋</Text>
            <Text style={styles.title}>Welcome back!</Text>
          </View>

          {/* Game reference */}
          <Text style={styles.question}>
            How was <Text style={styles.gameTitle}>{game.title}</Text>?
          </Text>

          {/* Feedback buttons */}
          <View style={styles.feedbackOptions}>
            <TouchableOpacity
              style={[styles.feedbackButton, styles.positiveButton]}
              onPress={() => handleFeedback('worked')}
            >
              <Text style={styles.feedbackEmoji}>👍</Text>
              <Text style={styles.feedbackText}>Great choice!</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.feedbackButton, styles.negativeButton]}
              onPress={() => handleFeedback('not_good_fit')}
            >
              <Text style={styles.feedbackEmoji}>👎</Text>
              <Text style={styles.feedbackText}>Not for me</Text>
            </TouchableOpacity>
          </View>

          {/* Dismiss option */}
          <TouchableOpacity style={styles.skipButton} onPress={handleDismiss}>
            <Text style={styles.skipText}>Ask me later</Text>
          </TouchableOpacity>

          {/* Privacy note */}
          <Text style={styles.privacyNote}>
            Your feedback helps improve future recommendations
          </Text>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  promptContainer: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  emoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  question: {
    fontSize: 16,
    color: '#a0a0a0',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  gameTitle: {
    color: '#e94560',
    fontWeight: '600',
  },
  feedbackOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  feedbackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  positiveButton: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  negativeButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  feedbackEmoji: {
    fontSize: 20,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 14,
    color: '#808080',
  },
  privacyNote: {
    fontSize: 11,
    color: '#505050',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default ReturnFeedbackPrompt;
