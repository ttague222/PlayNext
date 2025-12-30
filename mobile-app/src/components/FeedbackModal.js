/**
 * PlayNext Feedback Modal Component
 *
 * Shown after user accepts a recommendation to collect feedback.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';

const FeedbackModal = ({ visible, game, onSubmit, onClose }) => {
  if (!game) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <Text style={styles.title}>Enjoy your game!</Text>
          <Text style={styles.subtitle}>
            After you play, let us know how it went
          </Text>

          {/* Game info */}
          <View style={styles.gameInfo}>
            <Text style={styles.gameTitle}>{game.title}</Text>
          </View>

          {/* Feedback options */}
          <Text style={styles.questionLabel}>
            Did this recommendation work for you?
          </Text>

          <View style={styles.feedbackOptions}>
            <TouchableOpacity
              style={styles.feedbackButton}
              onPress={() => onSubmit('worked')}
            >
              <Text style={styles.feedbackEmoji}>👍</Text>
              <Text style={styles.feedbackText}>This worked for me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.feedbackButton}
              onPress={() => onSubmit('not_good_fit')}
            >
              <Text style={styles.feedbackEmoji}>👎</Text>
              <Text style={styles.feedbackText}>Not a good fit</Text>
            </TouchableOpacity>
          </View>

          {/* Skip option */}
          <TouchableOpacity style={styles.skipButton} onPress={onClose}>
            <Text style={styles.skipText}>I'll give feedback later</Text>
          </TouchableOpacity>

          {/* Privacy note */}
          <Text style={styles.privacyNote}>
            Your feedback helps improve recommendations.{'\n'}
            We don't track your playtime.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#808080',
    textAlign: 'center',
    marginBottom: 20,
  },
  gameInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  questionLabel: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
    marginBottom: 16,
  },
  feedbackOptions: {
    gap: 12,
    marginBottom: 16,
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  feedbackEmoji: {
    fontSize: 24,
  },
  feedbackText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
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
    color: '#606060',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
});

export default FeedbackModal;
