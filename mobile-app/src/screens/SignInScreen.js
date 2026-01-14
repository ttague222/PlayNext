/**
 * PlayNxt Sign In Screen
 *
 * Optional sign-in for users who want to sync data across devices.
 * Authentication types:
 * - Anonymous (default) - data stays on device
 * - Email/Password - sync across devices
 * - Username/Password - sync across devices (alternative)
 * - Google/Apple Sign-In (coming soon)
 *
 * Sign-in is completely optional - users can skip and use anonymously.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

const SignInScreen = () => {
  const navigation = useNavigation();
  const {
    signInAnonymousUser,
    authLoading,
  } = useAuth();
  const [error, setError] = useState(null);

  const handleSkip = async () => {
    try {
      await signInAnonymousUser();
      navigation.goBack();
    } catch (err) {
      // If anonymous sign-in fails, just go back anyway
      navigation.goBack();
    }
  };

  return (
    <LinearGradient
      colors={['#0f0c29', '#302b63', '#24243e']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>Play<Text style={styles.logoAccent}>Nxt</Text></Text>
            <Text style={styles.title}>Sync across devices</Text>
            <Text style={styles.subtitle}>
              Create an account to access your data on any device
            </Text>
          </View>

          {/* Benefits */}
          <View style={styles.benefits}>
            <View style={styles.benefitItem}>
              <Ionicons name="sync-circle" size={20} color="#4ade80" />
              <Text style={styles.benefitText}>Access your data on phone, tablet, or new device</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="cloud-done" size={20} color="#4ade80" />
              <Text style={styles.benefitText}>Your history and preferences are backed up</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="shield-checkmark" size={20} color="#4ade80" />
              <Text style={styles.benefitText}>Guest mode works great for single device use</Text>
            </View>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={18} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Sign In Buttons */}
          <View style={styles.buttonsContainer}>
            {/* Email Sign In - Primary option for sync */}
            <TouchableOpacity
              style={[styles.signInButton, styles.emailButton]}
              onPress={() => navigation.navigate('EmailSignIn')}
              disabled={authLoading}
            >
              <Ionicons name="mail-outline" size={22} color="#ffffff" />
              <Text style={styles.emailButtonText}>Continue with Email</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Guest Account - Single device use */}
            <TouchableOpacity
              style={[styles.signInButton, styles.guestButton]}
              onPress={handleSkip}
              disabled={authLoading}
            >
              {authLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="phone-portrait-outline" size={22} color="#ffffff" />
                  <Text style={styles.guestButtonText}>Use on this device only</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Privacy Note for Guest */}
          <View style={styles.guestNote}>
            <Ionicons name="information-circle-outline" size={16} color="#a0a0a0" />
            <Text style={styles.guestNoteText}>
              Guest data stays on this device. Create an account anytime to enable sync.
            </Text>
          </View>

          {/* Privacy Note */}
          <Text style={styles.privacyNote}>
            By signing in, you agree to our Terms of Service and Privacy Policy.
            We never share your data with third parties.
          </Text>
        </View>
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
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 20,
    letterSpacing: -1,
  },
  logoAccent: {
    color: '#f857a6',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    textAlign: 'center',
    lineHeight: 24,
  },
  benefits: {
    marginBottom: 32,
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: 15,
    color: '#d0d0d0',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    flex: 1,
  },
  buttonsContainer: {
    gap: 14,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 12,
  },
  emailButton: {
    backgroundColor: '#7c3aed',
  },
  emailButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dividerText: {
    fontSize: 14,
    color: '#606080',
  },
  guestButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  guestButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  guestNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
    paddingHorizontal: 8,
    gap: 8,
  },
  guestNoteText: {
    fontSize: 13,
    color: '#a0a0a0',
    flex: 1,
    lineHeight: 18,
  },
  privacyNote: {
    fontSize: 12,
    color: '#606080',
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 18,
  },
});

export default SignInScreen;
