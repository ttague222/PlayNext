/**
 * PlayNxt Profile Screen (Utility Tab)
 *
 * Settings and account management only.
 *
 * Responsibilities:
 * - Optional preference defaults (platform, session length)
 * - Login / logout
 * - Premium upgrade access
 * - Data reset / privacy controls
 *
 * Constraints:
 * - No avatars, levels, badges, or public identity
 * - No gameplay statistics
 * - Functions as a settings panel, not a social profile
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { usePremium } from '../context/PremiumContext';
import api from '../services/api';

const PRIVACY_POLICY_URL = 'https://watchlightinteractive.com/playnxt-privacy-policy';
const TERMS_OF_SERVICE_URL = 'https://watchlightinteractive.com/playnxt-terms-of-service';

const PLATFORMS = [
  { id: 'pc', label: 'PC', icon: 'desktop-outline' },
  { id: 'console', label: 'Console', icon: 'game-controller-outline' },
  { id: 'handheld', label: 'Handheld', icon: 'phone-portrait-outline' },
];

const SESSION_LENGTHS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '90 min' },
];

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, signOut, isAnonymous } = useAuth();
  const { isPremium, restorePurchases, getRemainingRerolls } = usePremium();

  // Default preferences (stored locally or in user profile)
  const [defaultPlatform, setDefaultPlatform] = useState(null);
  const [defaultSessionLength, setDefaultSessionLength] = useState(null);

  const handleSignIn = () => {
    navigation.navigate('SignIn');
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your history will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleUpgrade = () => {
    navigation.navigate('Premium');
  };

  const handleRestore = async () => {
    try {
      const restored = await restorePurchases();
      if (restored) {
        Alert.alert('Success', 'Your purchases have been restored.');
      } else {
        Alert.alert('No Purchases', 'No previous purchases found.');
      }
    } catch (error) {
      Alert.alert('Restore Failed', error.message);
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'This will remove all your recommendation history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await api.clearSignalHistory();
              Alert.alert('Done', `Your history has been cleared (${result.deleted_count} items removed).`);
            } catch (error) {
              Alert.alert('Error', 'Failed to clear history. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all your data including history, sessions, and preferences. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await api.deleteUserData();
              Alert.alert(
                'Done',
                `All your data has been deleted:\n• ${result.deleted.signals_deleted} signals\n• ${result.deleted.sessions_deleted} sessions\n• User profile removed`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Optionally sign out after deleting all data
                      signOut();
                    },
                  },
                ]
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to delete data. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderSection = (title, children) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Settings</Text>
          </View>

          {/* Account Section */}
          {renderSection(
            'Account',
            <>
              {isAnonymous ? (
                <TouchableOpacity style={styles.syncPrompt} onPress={handleSignIn}>
                  <LinearGradient
                    colors={['rgba(124, 58, 237, 0.15)', 'rgba(124, 58, 237, 0.05)']}
                    style={styles.syncPromptGradient}
                  >
                    <View style={styles.syncPromptContent}>
                      <View style={styles.syncIconContainer}>
                        <Ionicons name="cloud-upload-outline" size={24} color="#7c3aed" />
                      </View>
                      <View style={styles.syncPromptText}>
                        <Text style={styles.syncPromptTitle}>Enable cross-device sync</Text>
                        <Text style={styles.syncPromptSubtitle}>
                          Create an account to access your data anywhere
                        </Text>
                      </View>
                    </View>
                    <View style={styles.syncPromptButton}>
                      <Text style={styles.syncPromptButtonText}>Set up</Text>
                      <Ionicons name="chevron-forward" size={16} color="#ffffff" />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.accountInfo}>
                    <View style={styles.accountIcon}>
                      <Ionicons name="checkmark-circle" size={20} color="#4ade80" />
                    </View>
                    <View style={styles.accountDetails}>
                      <Text style={styles.accountEmail}>{user?.email}</Text>
                      <Text style={styles.accountStatus}>Synced across devices</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
                    <Ionicons name="log-out-outline" size={22} color="#808080" />
                    <Text style={styles.menuItemText}>Sign Out</Text>
                    <Ionicons name="chevron-forward" size={20} color="#808080" />
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {/* Premium Section */}
          {renderSection(
            'Premium',
            <>
              {isPremium ? (
                <TouchableOpacity style={styles.premiumActive} onPress={handleUpgrade}>
                  <Ionicons name="star" size={24} color="#fbbf24" />
                  <Text style={styles.premiumActiveText}>Premium Active</Text>
                  <Ionicons name="chevron-forward" size={20} color="#808080" />
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.premiumInfo}>
                    <Text style={styles.premiumInfoTitle}>Free Tier</Text>
                    <Text style={styles.premiumInfoText}>
                      {getRemainingRerolls()} rerolls remaining today
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
                    <LinearGradient
                      colors={['#e94560', '#ff6b6b']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.upgradeGradient}
                    >
                      <Ionicons name="star-outline" size={20} color="#ffffff" />
                      <Text style={styles.upgradeText}>Upgrade to Premium</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
                    <Text style={styles.restoreText}>Restore Purchases</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {/* Default Preferences Section */}
          {renderSection(
            'Default Preferences',
            <>
              <Text style={styles.preferenceLabel}>Preferred Platform</Text>
              <View style={styles.optionRow}>
                {PLATFORMS.map((platform) => (
                  <TouchableOpacity
                    key={platform.id}
                    style={[
                      styles.optionButton,
                      defaultPlatform === platform.id && styles.optionSelected,
                    ]}
                    onPress={() =>
                      setDefaultPlatform(
                        defaultPlatform === platform.id ? null : platform.id
                      )
                    }
                  >
                    <Ionicons
                      name={platform.icon}
                      size={20}
                      color={defaultPlatform === platform.id ? '#ffffff' : '#808080'}
                    />
                    <Text
                      style={[
                        styles.optionText,
                        defaultPlatform === platform.id && styles.optionTextSelected,
                      ]}
                    >
                      {platform.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.preferenceLabel, { marginTop: 16 }]}>
                Typical Session Length
              </Text>
              <View style={styles.optionRow}>
                {SESSION_LENGTHS.map((session) => (
                  <TouchableOpacity
                    key={session.value}
                    style={[
                      styles.optionButton,
                      defaultSessionLength === session.value && styles.optionSelected,
                    ]}
                    onPress={() =>
                      setDefaultSessionLength(
                        defaultSessionLength === session.value ? null : session.value
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        defaultSessionLength === session.value &&
                          styles.optionTextSelected,
                      ]}
                    >
                      {session.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Privacy Section */}
          {renderSection(
            'Privacy & Data',
            <>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              >
                <Ionicons name="document-text-outline" size={22} color="#808080" />
                <Text style={styles.menuItemText}>Privacy Policy</Text>
                <Ionicons name="open-outline" size={20} color="#808080" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
              >
                <Ionicons name="document-outline" size={22} color="#808080" />
                <Text style={styles.menuItemText}>Terms of Service</Text>
                <Ionicons name="open-outline" size={20} color="#808080" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleClearHistory}>
                <Ionicons name="trash-outline" size={22} color="#808080" />
                <Text style={styles.menuItemText}>Clear History</Text>
                <Ionicons name="chevron-forward" size={20} color="#808080" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleDeleteData}>
                <Ionicons name="warning-outline" size={22} color="#ef4444" />
                <Text style={[styles.menuItemText, { color: '#ef4444' }]}>
                  Delete All Data
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#808080" />
              </TouchableOpacity>
            </>
          )}

          {/* App Info */}
          <View style={styles.appInfo}>
            <Text style={styles.appInfoText}>PlayNxt v1.0.0</Text>
            <Text style={styles.appInfoText}>A decision tool, not an engagement platform.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#808080',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    gap: 12,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
  },
  syncPrompt: {
    overflow: 'hidden',
  },
  syncPromptGradient: {
    padding: 16,
    borderRadius: 12,
  },
  syncPromptContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  syncIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncPromptText: {
    flex: 1,
  },
  syncPromptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  syncPromptSubtitle: {
    fontSize: 13,
    color: '#909090',
  },
  syncPromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 4,
  },
  syncPromptButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    gap: 12,
  },
  accountIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountDetails: {
    flex: 1,
  },
  accountEmail: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 2,
  },
  accountStatus: {
    fontSize: 13,
    color: '#4ade80',
  },
  premiumActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  premiumActiveText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fbbf24',
  },
  premiumInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  premiumInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  premiumInfoText: {
    fontSize: 14,
    color: '#808080',
  },
  upgradeButton: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  upgradeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  restoreButton: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  restoreText: {
    fontSize: 14,
    color: '#808080',
  },
  preferenceLabel: {
    fontSize: 14,
    color: '#a0a0a0',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 16,
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    gap: 6,
  },
  optionSelected: {
    backgroundColor: '#e94560',
  },
  optionText: {
    fontSize: 14,
    color: '#808080',
  },
  optionTextSelected: {
    color: '#ffffff',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  appInfoText: {
    fontSize: 12,
    color: '#606060',
    marginBottom: 4,
  },
});

export default ProfileScreen;
