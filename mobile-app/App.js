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
import FollowUpModal from './src/components/FollowUpModal';
import api from './src/services/api';

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [followUpData, setFollowUpData] = useState(null); // { signalId, gameTitle }
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);

  const handleFollowUp = async (worked) => {
    if (!followUpData?.signalId) return;
    setIsSubmittingFollowUp(true);
    try {
      await api.updateSignalWorked(followUpData.signalId, worked);
    } catch {
      // Signal update failed — non-fatal, user already gave feedback
    } finally {
      setIsSubmittingFollowUp(false);
      setFollowUpData(null);
    }
  };

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
    const subscription = addNotificationResponseListener((data) => {
      if (!navigationRef.isReady()) return;
      if (data.deep_link === 'followup' && data.signal_id) {
        setFollowUpData({ signalId: data.signal_id, gameTitle: data.game_title });
      } else if (data.deep_link === 'whats_new') {
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
      <FollowUpModal
        visible={!!followUpData}
        gameTitle={followUpData?.gameTitle}
        isSubmitting={isSubmittingFollowUp}
        onWorked={() => handleFollowUp(true)}
        onDidntWork={() => handleFollowUp(false)}
        onDismiss={() => setFollowUpData(null)}
      />
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
