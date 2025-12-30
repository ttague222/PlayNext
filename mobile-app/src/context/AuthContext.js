/**
 * PlayNext Auth Context
 *
 * Provides authentication state and methods throughout the app.
 * Supports anonymous usage, Google Sign-In, and Apple Sign-In.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { auth } from '../config/firebase';

// Complete auth session for web browser
WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

// Determine the correct redirect URI based on environment
const getRedirectUri = () => {
  // For Expo Go (development), use the Expo auth proxy
  // For standalone builds, use the native scheme
  const isExpoGo = Constants.appOwnership === 'expo';

  if (isExpoGo) {
    // Expo Go uses the auth.expo.io proxy
    return 'https://auth.expo.io/@ttague/playnxt';
  }

  // Standalone/development builds use native redirect
  return makeRedirectUri({
    scheme: 'playnxt',
    path: 'oauth',
  });
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState(null);

  const redirectUri = getRedirectUri();

  // Determine if we're in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';

  // Google Auth configuration
  // In Expo Go, we must use the Web Client ID with the auth.expo.io redirect
  // In standalone builds, use platform-specific client IDs
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: isExpoGo
      ? Constants.expoConfig?.extra?.googleWebClientId
      : undefined,
    iosClientId: isExpoGo
      ? undefined
      : Constants.expoConfig?.extra?.googleIosClientId,
    androidClientId: isExpoGo
      ? undefined
      : Constants.expoConfig?.extra?.googleAndroidClientId,
    webClientId: Constants.expoConfig?.extra?.googleWebClientId,
    redirectUri,
    scopes: ['profile', 'email'],
  });

  // Debug: Log the redirect URI being used
  useEffect(() => {
    if (request) {
      console.log('[AuthContext] App ownership:', Constants.appOwnership);
      console.log('[AuthContext] Google OAuth redirect URI:', request.redirectUri);
      console.log('[AuthContext] Google OAuth client ID:', request.clientId);
    }
  }, [request]);

  // Listen for auth state changes and auto-sign in anonymously if no user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log('[AuthContext] User signed in:', firebaseUser.uid, 'anonymous:', firebaseUser.isAnonymous);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          isAnonymous: firebaseUser.isAnonymous,
          photoURL: firebaseUser.photoURL,
        });
        setLoading(false);
      } else {
        // No user - auto sign in anonymously so signals can be tracked
        console.log('[AuthContext] No user, auto-signing in anonymously...');
        try {
          await signInAnonymously(auth);
          // onAuthStateChanged will fire again with the new user
        } catch (err) {
          console.error('[AuthContext] Failed to auto sign in anonymously:', err);
          setUser(null);
          setLoading(false);
        }
      }
    });

    return unsubscribe;
  }, []);

  // Handle Google auth response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleCredential(id_token);
    }
  }, [response]);

  /**
   * Handle Google credential after successful OAuth
   */
  const handleGoogleCredential = async (idToken) => {
    try {
      setAuthLoading(true);
      setError(null);
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  /**
   * Sign in anonymously (no account required)
   */
  const signInAnonymousUser = async () => {
    try {
      setAuthLoading(true);
      setError(null);
      const result = await signInAnonymously(auth);
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  /**
   * Sign in with Google - triggers OAuth flow
   */
  const signInWithGoogle = useCallback(async () => {
    try {
      setError(null);
      await promptAsync();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [promptAsync]);

  /**
   * Sign in with Apple (iOS only)
   */
  const signInWithApple = async () => {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS');
    }

    try {
      setAuthLoading(true);
      setError(null);

      // Request Apple authentication
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Create Firebase credential from Apple credential
      const { identityToken, nonce } = appleCredential;
      if (!identityToken) {
        throw new Error('No identity token returned from Apple');
      }

      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: identityToken,
        rawNonce: nonce,
      });

      const result = await signInWithCredential(auth, credential);
      return result.user;
    } catch (err) {
      if (err.code === 'ERR_CANCELED') {
        // User cancelled, not an error
        return null;
      }
      setError(err.message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  /**
   * Generic sign in - opens sign in options
   * This is called by ProfileScreen
   */
  const signIn = useCallback(async (provider = 'google') => {
    if (provider === 'apple') {
      return signInWithApple();
    }
    return signInWithGoogle();
  }, [signInWithGoogle]);

  /**
   * Sign out
   */
  const signOut = async () => {
    try {
      setAuthLoading(true);
      await firebaseSignOut(auth);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  /**
   * Get current ID token for API calls
   */
  const getIdToken = async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  /**
   * Check if Apple Sign-In is available
   */
  const isAppleSignInAvailable = Platform.OS === 'ios';

  const value = {
    user,
    loading,
    authLoading,
    error,
    isAuthenticated: !!user,
    isAnonymous: user?.isAnonymous ?? true,
    signInAnonymousUser,
    signInWithGoogle,
    signInWithApple,
    signIn,
    signOut,
    getIdToken,
    isAppleSignInAvailable,
    googleAuthReady: !!request,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
