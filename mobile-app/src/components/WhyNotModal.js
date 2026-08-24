/**
 * PlayNxt "Why Not?" Modal
 *
 * Shown when a user taps "Not for me" on a recommendation. Recaps why the
 * game was picked, then collects the reason it misses so the engine can
 * learn — free tier included. "Already played it" routes to the existing
 * AlreadyPlayedModal flow instead of recording a rejection.
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
import { Ionicons } from '@expo/vector-icons';

const REASON_OPTIONS = [
  {
    id: 'not_my_genre',
    emoji: '🎮',
    label: 'Not my kind of game',
    description: "We'll steer away from games like this",
    color: '#f87171',
  },
  {
    id: 'too_long',
    emoji: '⏳',
    label: 'Too big a commitment',
    description: 'Looks like more time than I want to give',
    color: '#f59e0b',
  },
  {
    id: 'not_interesting',
    emoji: '😴',
    label: "Doesn't look fun to me",
    description: 'Just not feeling this one',
    color: '#60a5fa',
  },
];

const WhyNotModal = ({ visible, game, onReason, onAlreadyPlayed, onSkip }) => {
  if (!game) return null;

  const explanationText =
    game.explanation?.mood_fit || game.explanation?.style_fit || null;

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
              <Ionicons name="thumbs-down-outline" size={28} color="#f87171" />
              <Text style={styles.title}>Not this one?</Text>
              <Text style={styles.gameTitle}>{game.title}</Text>
            </View>

            {/* Why we picked it */}
            {explanationText && (
              <View style={styles.pickedBox}>
                <Text style={styles.pickedLabel}>We suggested it because:</Text>
                <Text style={styles.pickedText}>{explanationText}</Text>
              </View>
            )}

            {/* Question */}
            <Text style={styles.question}>What missed the mark?</Text>
            <Text style={styles.subtitle}>
              Your answer teaches us what to show you next
            </Text>

            {/* Reason Options */}
            <View style={styles.options}>
              {REASON_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.optionButton}
                  onPress={() => onReason(option.id)}
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

              {/* Already played routes to the played-feedback flow */}
              <TouchableOpacity
                style={styles.optionButton}
                onPress={onAlreadyPlayed}
                activeOpacity={0.8}
              >
                <View style={[styles.optionContent, { borderColor: '#4ade8040' }]}>
                  <Text style={styles.optionEmoji}>✅</Text>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: '#4ade80' }]}>
                      I've already played it
                    </Text>
                    <Text style={styles.optionDescription}>
                      Tell us how it was instead
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Skip */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={onSkip}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>Just show me something else</Text>
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
    maxWidth: 400,
  },
  content: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 8,
  },
  gameTitle: {
    fontSize: 16,
    color: '#f857a6',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  pickedBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  pickedLabel: {
    fontSize: 12,
    color: '#a0a0a0',
    marginBottom: 4,
  },
  pickedText: {
    fontSize: 14,
    color: '#e0e0e0',
  },
  question: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#a0a0a0',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  options: {
    gap: 10,
  },
  optionButton: {
    borderRadius: 14,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    gap: 12,
  },
  optionEmoji: {
    fontSize: 24,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 13,
    color: '#a0a0a0',
    marginTop: 2,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  skipText: {
    fontSize: 14,
    color: '#a0a0a0',
  },
});

export default WhyNotModal;
