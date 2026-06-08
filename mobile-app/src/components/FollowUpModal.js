import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator, PanResponder, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Shown when the user taps a follow-up push notification.
 * Props:
 *   visible: bool
 *   gameTitle: string
 *   onWorked: () => void   — user taps 👍
 *   onDidntWork: () => void — user taps 👎
 *   onDismiss: () => void
 *   isSubmitting: bool
 *   showThanks: bool
 */
const FollowUpModal = ({ visible, gameTitle, onWorked, onDidntWork, onDismiss, isSubmitting, showThanks }) => {
  const insets = useSafeAreaInsets();
  const title = gameTitle || 'the game';

  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80) {
          onDismiss();
          translateY.setValue(0);
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.card, { paddingBottom: Math.max(32, 32 + insets.bottom), transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          <Text style={styles.emoji}>🎮</Text>
          <Text style={styles.title}>How did it go?</Text>
          <Text style={styles.body}>
            Did <Text style={styles.gameTitle}>{title}</Text> work out for you?
          </Text>

          {showThanks ? (
            <View style={styles.thanksContainer}>
              <Text style={styles.thanksEmoji}>✅</Text>
              <Text style={styles.thanksText}>Thanks for the feedback!</Text>
            </View>
          ) : isSubmitting ? (
            <ActivityIndicator color="#f857a6" style={{ marginVertical: 24 }} />
          ) : (
            <View style={styles.buttons}>
              <Pressable
                style={({ pressed }) => [styles.thumbButton, pressed && styles.buttonPressed]}
                onPress={onWorked}
                accessibilityRole="button"
                accessibilityLabel="Yes, it worked for me"
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
                accessibilityRole="button"
                accessibilityLabel="No, it didn't work for me"
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

          <Pressable style={styles.skipButton} onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Skip feedback">
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </Animated.View>
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
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
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
  thanksContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  thanksEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  thanksText: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },
});

export default FollowUpModal;
