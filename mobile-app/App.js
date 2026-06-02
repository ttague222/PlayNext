/**
 * PlayNxt Mobile App
 *
 * Main entry point - wraps app with providers and error handling.
 */

import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerRootComponent } from 'expo';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Providers
import { AuthProvider } from './src/context/AuthContext';
import { AdProvider } from './src/context/AdContext';
import { RecommendationProvider } from './src/context/RecommendationContext';
import { PremiumProvider } from './src/context/PremiumContext';
import { SavedGamesProvider } from './src/context/SavedGamesContext';

// Navigation
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';

// Onboarding
import WelcomeScreen, { hasSeenWelcome } from './src/screens/WelcomeScreen';

// Push notification tap handling
import { addNotificationResponseListener } from './src/services/notificationService';

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const checkFirstLaunch = async () => {
      const seen = await hasSeenWelcome();
      setShowWelcome(!seen);
      setIsLoading(false);
    };
    checkFirstLaunch();
  }, []);

  // Route notification taps via the navigation ref.
  useEffect(() => {
    const subscription = addNotificationResponseListener((deepLink) => {
      if (!navigationRef.isReady()) return;
      if (deepLink === 'whats_new') {
        navigationRef.navigate('WhatsNew');
      } else {
        // Default: surface the play tab.
        navigationRef.navigate('Main', { screen: 'Play' });
      }
    });
    return () => subscription?.remove?.();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f857a6" />
      </View>
    );
  }

  if (showWelcome) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <WelcomeScreen onComplete={() => setShowWelcome(false)} />
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AdProvider>
            <PremiumProvider>
              <SavedGamesProvider>
                <RecommendationProvider>
                  <StatusBar style="light" />
                  <AppNavigator />
                </RecommendationProvider>
              </SavedGamesProvider>
            </PremiumProvider>
          </AdProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0c29',
  },
});

registerRootComponent(App);

export default App;
