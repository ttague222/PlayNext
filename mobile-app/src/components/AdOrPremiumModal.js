/**
 * AdOrPremiumModal
 *
 * Modal that gives users a choice between watching an ad or going premium
 * before performing an action that would require an ad.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const AdOrPremiumModal = ({
  visible,
  onWatchAd,
  onGoPremium,
  onCancel,
  isAdLoading = false,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <BlurView intensity={30} tint="dark" style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modal}>
            {/* Header */}
            <Text style={styles.title}>Keep Exploring?</Text>
            <Text style={styles.subtitle}>
              Choose how you'd like to continue
            </Text>

            {/* Options */}
            <View style={styles.options}>
              {/* Watch Ad Option */}
              <TouchableOpacity
                style={styles.optionCard}
                onPress={onWatchAd}
                disabled={isAdLoading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['rgba(99, 102, 241, 0.15)', 'rgba(99, 102, 241, 0.05)']}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.optionIcon}>📺</Text>
                <Text style={styles.optionTitle}>Watch a Short Ad</Text>
                <Text style={styles.optionDescription}>
                  ~15 seconds, then continue free
                </Text>
                {isAdLoading ? (
                  <ActivityIndicator color="#6366f1" style={styles.optionButton} />
                ) : (
                  <View style={[styles.optionButton, styles.adButton]}>
                    <Text style={styles.adButtonText}>Watch Ad</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Premium Option */}
              <TouchableOpacity
                style={styles.optionCard}
                onPress={onGoPremium}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['rgba(248, 87, 166, 0.15)', 'rgba(255, 88, 88, 0.05)']}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.optionIcon}>⭐</Text>
                <Text style={styles.optionTitle}>Go Premium</Text>
                <Text style={styles.optionDescription}>
                  No ads, ever. One-time purchase.
                </Text>
                <LinearGradient
                  colors={['#f857a6', '#ff5858']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.optionButton, styles.premiumButton]}
                >
                  <Text style={styles.premiumButtonText}>Get Premium</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Cancel */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={isAdLoading}
            >
              <Text style={styles.cancelText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 360,
  },
  modal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#808090',
    textAlign: 'center',
    marginBottom: 24,
  },
  options: {
    gap: 12,
    marginBottom: 16,
  },
  optionCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    overflow: 'hidden',
  },
  optionIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: '#909090',
    textAlign: 'center',
    marginBottom: 16,
  },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  adButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  adButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366f1',
  },
  premiumButton: {
    // gradient applied via LinearGradient
  },
  premiumButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    color: '#606070',
  },
});

export default AdOrPremiumModal;
