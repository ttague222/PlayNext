import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Shown when the user taps a follow-up push notification.
 * Props:
 *   visible: bool
 *   gameTitle: string
 *   onWorked: () => void   — user taps 👍
 *   onDidntWork: () => void — user taps 👎
 *   onDismiss: () => void
 *   isSubmitting: bool
 */
const FollowUpModal = ({ visible, gameTitle, onWorked, onDidntWork, onDismiss, isSubmitting }) => {
  const title = gameTitle || 'the game';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🎮</Text>
          <Text style={styles.title}>How did it go?</Text>
          <Text style={styles.body}>
            Did <Text style={styles.gameTitle}>{title}</Text> work out for you?
          </Text>

          {isSubmitting ? (
            <ActivityIndicator color="#f857a6" style={{ marginVertical: 24 }} />
          ) : (
            <View style={styles.buttons}>
              <Pressable
                style={({ pressed }) => [styles.thumbButton, pressed && styles.buttonPressed]}
                onPress={onWorked}
              >
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.thumbGradient}
                >
                  <Text style={styles.thumbEmoji}>👍</Text>
                  <Text style={styles.thumbText}>It worked!</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.thumbButton, pressed && styles.buttonPressed]}
                onPress={onDidntWork}
              >
                <LinearGradient
                  colors={['#6b7280', '#4b5563']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.thumbGradient}
                >
                  <Text style={styles.thumbEmoji}>👎</Text>
                  <Text style={styles.thumbText}>Not really</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}

          <Pressable style={styles.skipButton} onPress={onDismiss}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 32,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(248, 87, 166, 0.2)',
  },
  emoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: '#a0a0b0',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  gameTitle: {
    color: '#f857a6',
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  thumbButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  thumbGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  thumbEmoji: {
    fontSize: 24,
  },
  thumbText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 14,
    color: '#505060',
  },
});

export default FollowUpModal;
