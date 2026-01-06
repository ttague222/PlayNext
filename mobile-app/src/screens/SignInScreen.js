/**
 * PlayNxt Sign In Screen
 *
 * Optional sign-in for users who want to:
 * - Save their played games history across devices
 * - Get improved recommendations based on past preferences
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
    signInWithGoogle,
    signInWithApple,
    signInAnonymousUser,
    authLoading,
    isAppleSignInAvailable,
    googleAuthReady,
  } = useAuth();
  const [error, setError] = useState(null);

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      await signInWithGoogle();
      navigation.goBack();
    } catch (err) {
      setError('Failed to sign in with Google. Please try again.');
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setError(null);
      const user = await signInWithApple();
      if (user) {
        navigation.goBack();
      }
    } catch (err) {
      setError('Failed to sign in with Apple. Please try again.');
    }
  };

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
            <Text style={styles.title}>Keep your data in sync</Text>
            <Text style={styles.subtitle}>
              Sign in to access your history and preferences on any device
            </Text>
          </View>

          {/* Benefits */}
          <View style={styles.benefits}>
            <View style={styles.benefitItem}>
              <Ionicons name="sync-circle" size={20} color="#4ade80" />
              <Text style={styles.benefitText}>Sync your data across all devices</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="time" size={20} color="#4ade80" />
              <Text style={styles.benefitText}>Never lose your recommendation history</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="sparkles" size={20} color="#4ade80" />
              <Text style={styles.benefitText}>Smarter recommendations over time</Text>
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
            {/* Google Sign In */}
            <TouchableOpacity
              style={[styles.signInButton, styles.googleButton]}
              onPress={handleGoogleSignIn}
              disabled={authLoading || !googleAuthReady}
            >
              {authLoading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={22} color="#000000" />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Apple Sign In - iOS only (temporarily disabled) */}
            {/* TODO: Re-enable after configuring Apple Developer Console
            {isAppleSignInAvailable && (
              <TouchableOpacity
                style={[styles.signInButton, styles.appleButton]}
                onPress={handleAppleSignIn}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={22} color="#ffffff" />
                    <Text style={styles.appleButtonText}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            */}
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Skip / Continue without signing in */}
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Continue without signing in</Text>
          </TouchableOpacity>

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
  googleButton: {
    backgroundColor: '#ffffff',
  },
  googleButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  appleButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    color: '#808080',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipButtonText: {
    fontSize: 16,
    color: '#a0a0a0',
    fontWeight: '500',
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
