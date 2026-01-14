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

// Providers
import { AuthProvider } from './src/context/AuthContext';
import { RecommendationProvider } from './src/context/RecommendationContext';
import { PremiumProvider } from './src/context/PremiumContext';
import { SavedGamesProvider } from './src/context/SavedGamesContext';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';

const App = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PremiumProvider>
            <SavedGamesProvider>
              <RecommendationProvider>
                <StatusBar style="light" />
                <AppNavigator />
              </RecommendationProvider>
            </SavedGamesProvider>
          </PremiumProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

registerRootComponent(App);

export default App;
