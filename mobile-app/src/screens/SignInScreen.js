/**
 * PlayNxt Sign In Screen
 *
 * Optional sign-in for users who want to sync data across devices.
 * Authentication types:
 * - Anonymous (default) - data stays on device
 * - Email/Password - sync across devices
 * - Google Sign-In - sync across devices
 * - Apple Sign-In (iOS only) - sync across devices
 *
 * Sign-in is completely optional - users can skip and use anonymously.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

const SignInScreen = () => {
  const navigation = useNavigation();
  const {
    signInAnonymousUser,
    signInWithGoogle,
    signInWithApple,
    authLoading,
    isAppleSignInAvailable,
    googleAuthReady,
  } = useAuth();
  const [error, setError] = useState(null);
  const [signingInWith, setSigningInWith] = useState(null); // 'google', 'apple', 'guest', or null

  const handleSkip = async () => {
    try {
      setSigningInWith('guest');
      setError(null);
      await signInAnonymousUser();
      navigation.goBack();
    } catch (err) {
      // If anonymous sign-in fails, just go back anyway
      navigation.goBack();
    } finally {
      setSigningInWith(null);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setSigningInWith('google');
      setError(null);
      await signInWithGoogle();
      // Navigation happens automatically after successful sign-in via auth state change
    } catch (err) {
      console.error('[SignInScreen] Google sign-in error:', err);
      setError('Failed to sign in with Google. Please try again.');
    } finally {
      setSigningInWith(null);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setSigningInWith('apple');
      setError(null);
      const user = await signInWithApple();
      if (user) {
        // Successfully signed in, navigate back
        navigation.goBack();
      }
      // If user is null, they cancelled - do nothing
    } catch (err) {
      console.error('[SignInScreen] Apple sign-in error:', err);
      setError('Failed to sign in with Apple. Please try again.');
    } finally {
      setSigningInWith(null);
    }
  };

  const isLoading = authLoading || signingInWith !== null;

  return (
    <LinearGradient
      colors={['#0f0c29', '#302b63', '#24243e']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
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
            {/* Apple Sign In - iOS only, shown first on iOS */}
            {isAppleSignInAvailable && (
              <TouchableOpacity
                style={[styles.signInButton, styles.appleButton]}
                onPress={handleAppleSignIn}
                disabled={isLoading}
              >
                {signingInWith === 'apple' ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={22} color="#000000" />
                    <Text style={styles.appleButtonText}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Google Sign In */}
            <TouchableOpacity
              style={[styles.signInButton, styles.googleButton]}
              onPress={handleGoogleSignIn}
              disabled={isLoading || !googleAuthReady}
            >
              {signingInWith === 'google' ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <>
                  <Image
                    source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                    style={styles.googleIcon}
                  />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Email Sign In */}
            <TouchableOpacity
              style={[styles.signInButton, styles.emailButton]}
              onPress={() => navigation.navigate('EmailSignIn')}
              disabled={isLoading}
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
              disabled={isLoading}
            >
              {signingInWith === 'guest' ? (
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
    marginBottom: 32,
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
    marginBottom: 24,
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
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    flex: 1,
  },
  buttonsContainer: {
    gap: 12,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  appleButton: {
    backgroundColor: '#ffffff',
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  googleButton: {
    backgroundColor: '#ffffff',
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  emailButton: {
    backgroundColor: '#7c3aed',
  },
  emailButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  guestNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
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
    marginTop: 24,
    lineHeight: 18,
  },
});

export default SignInScreen;
