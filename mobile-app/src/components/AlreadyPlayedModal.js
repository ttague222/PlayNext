/**
 * PlayNxt Already Played Modal
 *
 * Quick feedback modal when user says they've already played a game.
 * Collects whether they liked it to improve future recommendations.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const FEEDBACK_OPTIONS = [
  {
    id: 'played_loved',
    emoji: '😍',
    label: 'Loved it!',
    description: 'One of my favorites',
    color: '#4ade80',
  },
  {
    id: 'played_neutral',
    emoji: '😊',
    label: 'It was good',
    description: 'Enjoyed my time with it',
    color: '#60a5fa',
  },
  {
    id: 'played_didnt_stick',
    emoji: '😐',
    label: 'Not for me',
    description: 'Didn\'t click with me',
    color: '#f59e0b',
  },
];

const AlreadyPlayedModal = ({ visible, game, onFeedback, onSkip }) => {
  if (!game) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={styles.container}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e']}
            style={styles.content}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.title}>You've played this one!</Text>
              <Text style={styles.gameTitle}>{game.title}</Text>
            </View>

            {/* Question */}
            <Text style={styles.question}>Quick question - how was it?</Text>
            <Text style={styles.subtitle}>
              This helps us find better matches for you
            </Text>

            {/* Feedback Options */}
            <View style={styles.options}>
              {FEEDBACK_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.optionButton}
                  onPress={() => onFeedback(option.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.optionContent, { borderColor: option.color + '40' }]}>
                    <Text style={styles.optionEmoji}>{option.emoji}</Text>
                    <View style={styles.optionText}>
                      <Text style={[styles.optionLabel, { color: option.color }]}>
                        {option.label}
                      </Text>
                      <Text style={styles.optionDescription}>
                        {option.description}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Skip */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={onSkip}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>Skip & show me something else</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    overflow: 'hidden',
  },
  content: {
    padding: 28,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  checkmark: {
    fontSize: 48,
    color: '#4ade80',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  gameTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f857a6',
    textAlign: 'center',
  },
  question: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#808090',
    textAlign: 'center',
    marginBottom: 24,
  },
  options: {
    gap: 12,
    marginBottom: 20,
  },
  optionButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    gap: 14,
  },
  optionEmoji: {
    fontSize: 32,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 14,
    color: '#909090',
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 15,
    color: '#707080',
    fontWeight: '500',
  },
});

export default AlreadyPlayedModal;
