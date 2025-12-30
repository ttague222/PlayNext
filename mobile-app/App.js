/**
 * PlayNxt Mobile App
 *
 * Main entry point - wraps app with providers and error handling.
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerRootComponent } from 'expo';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Providers
import { AuthProvider } from './src/context/AuthContext';
import { RecommendationProvider } from './src/context/RecommendationContext';
import { PremiumProvider } from './src/context/PremiumContext';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';

// Initialize Sentry
const sentryDsn = Constants.expoConfig?.extra?.sentryDsn;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.1,
  });
}

const App = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PremiumProvider>
            <RecommendationProvider>
              <StatusBar style="light" />
              <AppNavigator />
            </RecommendationProvider>
          </PremiumProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

registerRootComponent(App);

export default Sentry.wrap(App);
