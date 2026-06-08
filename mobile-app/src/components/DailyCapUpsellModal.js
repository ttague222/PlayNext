import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Shown when a free user hits their daily reroll cap (10/day).
 * Props:
 *   visible: bool
 *   onGoPremium: () => void  — navigate to PremiumScreen
 *   onDismiss: () => void    — close modal, no reroll
 */
const DailyCapUpsellModal = ({ visible, onGoPremium, onDismiss }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🎮</Text>
          <Text style={styles.title}>You're on a roll!</Text>
          <Text style={styles.body}>
            You've used all 10 of today's rerolls. Rerolls reset at midnight — or unlock unlimited rerolls forever for a one-time $2.99.
          </Text>

          <Pressable
            style={styles.premiumButton}
            onPress={onGoPremium}
            accessibilityRole="button"
            accessibilityLabel="Unlock unlimited rerolls for $2.99"
          >
            <LinearGradient
              colors={['#f857a6', '#ff5858']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.premiumGradient}
            >
              <Text style={styles.premiumText}>Unlock Unlimited — $2.99</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={styles.dismissButton}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Check back tomorrow"
          >
            <Text style={styles.dismissText}>Check back tomorrow</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(248, 87, 166, 0.3)',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: '#a0a0b0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  premiumButton: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#f857a6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  premiumGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  premiumText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  dismissButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
    color: '#606070',
  },
});

export default DailyCapUpsellModal;
