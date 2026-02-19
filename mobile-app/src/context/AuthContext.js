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
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  linkWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { auth } from '../config/firebase';

// Complete auth session for web browser
WebBrowser.maybeCompleteAuthSession();

// For standalone builds, we need to use the Expo proxy for OAuth redirects
// The makeRedirectUri with useProxy doesn't work correctly for standalone builds,
// so we hardcode the Expo auth proxy URL for production builds
const isStandalone = Constants.appOwnership !== 'expo';
const redirectUri = isStandalone
  ? 'https://auth.expo.io/@ttague/playnxt'
  : AuthSession.makeRedirectUri({ useProxy: false });

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

// For production standalone builds, we use platform-native OAuth
// No custom redirect URI needed - the native SDKs handle this automatically

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState(null);
  const [appleSignInAvailable, setAppleSignInAvailable] = useState(false);

  // Check Apple Sign-In availability on mount
  useEffect(() => {
    const checkAppleSignIn = async () => {
      if (Platform.OS === 'ios') {
        try {
          const isAvailable = await AppleAuthentication.isAvailableAsync();
          console.log('[AuthContext] Apple Sign-In available:', isAvailable);
          setAppleSignInAvailable(isAvailable);
        } catch (err) {
          console.error('[AuthContext] Error checking Apple Sign-In availability:', err);
          setAppleSignInAvailable(false);
        }
      }
    };
    checkAppleSignIn();
  }, []);

  // Google Auth configuration
  // For standalone builds using Expo proxy, we need to use the web client ID
  // The Expo proxy handles the OAuth flow and redirects back to the app
  const webClientId = Constants.expoConfig?.extra?.googleWebClientId;
  const [request, response, promptAsync] = Google.useAuthRequest({
    // For standalone builds, use web client ID for all platforms (Expo proxy requires it)
    // For Expo Go, use platform-specific client IDs
    clientId: isStandalone ? webClientId : undefined,
    iosClientId: isStandalone ? undefined : Constants.expoConfig?.extra?.googleIosClientId,
    androidClientId: isStandalone ? undefined : Constants.expoConfig?.extra?.googleAndroidClientId,
    webClientId: webClientId,
    redirectUri,
    scopes: ['profile', 'email'],
  });

  // Debug: Log OAuth configuration
  useEffect(() => {
    console.log('[AuthContext] App ownership:', Constants.appOwnership);
    console.log('[AuthContext] Platform:', Platform.OS);
    console.log('[AuthContext] Is standalone build:', isStandalone);
    console.log('[AuthContext] Redirect URI:', redirectUri);
    if (request) {
      console.log('[AuthContext] Google OAuth ready:', !!request);
      console.log('[AuthContext] iOS Client ID:', Constants.expoConfig?.extra?.googleIosClientId ? 'configured' : 'missing');
      console.log('[AuthContext] Android Client ID:', Constants.expoConfig?.extra?.googleAndroidClientId ? 'configured' : 'missing');
      console.log('[AuthContext] Web Client ID:', Constants.expoConfig?.extra?.googleWebClientId ? 'configured' : 'missing');
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
   * Requires proper nonce generation for Firebase authentication
   */
  const signInWithApple = async () => {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS');
    }

    // Check if Apple Sign-In is available
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      console.error('[AuthContext] Apple Sign-In not available on this device');
      throw new Error('Apple Sign-In is not available on this device. Please ensure you are signed into iCloud with an Apple ID.');
    }

    try {
      setAuthLoading(true);
      setError(null);

      console.log('[AuthContext] Starting Apple Sign-In flow...');

      // Generate a secure random nonce (at least 32 characters for Firebase)
      // Using crypto for better randomness
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      const rawNonce = Array.from(new Uint8Array(randomBytes))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      console.log('[AuthContext] Generated nonce length:', rawNonce.length);

      // Create SHA256 hash of the nonce to send to Apple
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      console.log('[AuthContext] Requesting Apple credential with hashed nonce...');

      // Request Apple authentication with the hashed nonce
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      console.log('[AuthContext] Apple credential received, user:', appleCredential.user?.substring(0, 10) + '...');

      // Create Firebase credential from Apple credential
      const { identityToken } = appleCredential;
      if (!identityToken) {
        console.error('[AuthContext] No identity token in Apple credential');
        throw new Error('No identity token returned from Apple');
      }

      console.log('[AuthContext] Creating Firebase credential with Apple token...');
      console.log('[AuthContext] Identity token length:', identityToken.length);

      // Create the Apple OAuth credential for Firebase
      // Firebase only needs idToken and rawNonce for native iOS Apple Sign-In
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: identityToken,
        rawNonce: rawNonce,
      });

      console.log('[AuthContext] Signing in to Firebase with Apple credential...');
      const result = await signInWithCredential(auth, credential);
      console.log('[AuthContext] Firebase sign-in successful, uid:', result.user.uid);
      return result.user;
    } catch (err) {
      if (err.code === 'ERR_CANCELED' || err.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled, not an error
        console.log('[AuthContext] Apple Sign-In cancelled by user');
        return null;
      }
      console.error('[AuthContext] Apple Sign-In error:', err.code, err.message);
      console.error('[AuthContext] Full error:', JSON.stringify(err, null, 2));
      setError(err.message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  /**
   * Sign up with email and password
   */
  const signUpWithEmail = async (email, password) => {
    try {
      setAuthLoading(true);
      setError(null);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  /**
   * Sign in with email and password
   */
  const signInWithEmail = async (email, password) => {
    try {
      setAuthLoading(true);
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  /**
   * Send password reset email
   */
  const resetPassword = async (email) => {
    try {
      setAuthLoading(true);
      setError(null);
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  /**
   * Link anonymous account to email/password
   * This preserves all existing data while upgrading to a full account
   */
  const linkEmailToAnonymous = async (email, password) => {
    if (!auth.currentUser) {
      throw new Error('No user signed in');
    }
    if (!auth.currentUser.isAnonymous) {
      throw new Error('Account is already linked');
    }

    try {
      setAuthLoading(true);
      setError(null);
      const credential = EmailAuthProvider.credential(email, password);
      const result = await linkWithCredential(auth.currentUser, credential);
      // Update local user state
      setUser({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        isAnonymous: result.user.isAnonymous,
        photoURL: result.user.photoURL,
      });
      return result.user;
    } catch (err) {
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
   * Uses the state from isAvailableAsync() check on mount
   */
  const isAppleSignInAvailable = appleSignInAvailable;

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
    signUpWithEmail,
    signInWithEmail,
    resetPassword,
    linkEmailToAnonymous,
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
