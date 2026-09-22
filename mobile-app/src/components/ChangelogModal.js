/**
 * ChangelogModal
 *
 * One-time "what's new in this update" modal, shown on first launch after an
 * app update when a changelog entry exists (spec 2026-09-22). Feature rows
 * with optional CTA deep links; dismiss records the version as seen.
 */
import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const ChangelogModal = ({ visible, entry, onFeaturePress, onDismiss }) => {
  if (!entry) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.card}>
          <Text style={styles.title}>{entry.title}</Text>
          <ScrollView style={styles.features} showsVerticalScrollIndicator={false}>
            {entry.features.map((f) => (
              <View key={f.headline} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Ionicons name={f.icon} size={22} color="#f857a6" />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureHeadline}>{f.headline}</Text>
                  <Text style={styles.featureBody}>{f.body}</Text>
                  {f.cta ? (
                    <TouchableOpacity
                      onPress={() => onFeaturePress(f.cta)}
                      accessibilityRole="button"
                      accessibilityLabel={f.cta.label}
                    >
                      <Text style={styles.ctaText}>{f.cta.label} →</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss what's new">
            <Text style={styles.dismissText}>Got it</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(248, 87, 166, 0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 20,
  },
  features: {
    flexGrow: 0,
    flexShrink: 1,
  },
  featureRow: {
    flexDirection: 'row',
    marginBottom: 18,
    gap: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(248, 87, 166, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureHeadline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 3,
  },
  featureBody: {
    fontSize: 14,
    color: '#b0b0b0',
    lineHeight: 20,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f857a6',
    marginTop: 6,
  },
  dismissButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default ChangelogModal;
