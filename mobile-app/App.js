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
import Constants from 'expo-constants';

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
import ChangelogModal from './src/components/ChangelogModal';
import { shouldShowChangelog, markChangelogSeen } from './src/services/changelogService';
import { CHANGELOG } from './src/config/changelog';
import api from './src/services/api';
import { logEvent } from './src/services/analyticsService';
import { maybeRequestReview } from './src/utils/reviewPrompt';

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [followUpData, setFollowUpData] = useState(null); // { signalId, gameTitle }
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);
  const [followUpSuccess, setFollowUpSuccess] = useState(false);
  const [changelogEntry, setChangelogEntry] = useState(null);

  const handleFollowUp = async (worked) => {
    if (!followUpData?.signalId) return;
    setIsSubmittingFollowUp(true);
    try {
      await api.updateSignalWorked(followUpData.signalId, worked);
      logEvent('followup_answered', { worked });
      setFollowUpSuccess(true);
      setTimeout(() => {
        setFollowUpSuccess(false);
        setFollowUpData(null);
        // "This worked for me" is the happiest moment in the app — ask for a
        // store review after the modal closes, never after an ad or an error.
        if (worked) {
          maybeRequestReview({ trigger: 'followup_worked' });
        }
      }, 1500);
    } catch {
      // non-fatal — still dismiss
      setFollowUpData(null);
    } finally {
      setIsSubmittingFollowUp(false);
    }
  };

  const dismissChangelog = async () => {
    if (changelogEntry) {
      logEvent('changelog_dismissed', { version: changelogEntry.version });
      await markChangelogSeen(changelogEntry.version);
    }
    setChangelogEntry(null);
  };

  const handleChangelogCta = async (cta) => {
    if (changelogEntry) {
      logEvent('changelog_cta_tapped', { version: changelogEntry.version, screen: cta.screen });
      await markChangelogSeen(changelogEntry.version);
    }
    setChangelogEntry(null);
    if (navigationRef.isReady()) {
      navigationRef.navigate(cta.screen, cta.params);
    }
  };

  useEffect(() => {
    const checkFirstLaunch = async () => {
      const seen = await hasSeenWelcome();
      setShowWelcome(!seen);
      if (seen) {
        const version = Constants.expoConfig?.version;
        if (await shouldShowChangelog(version)) {
          setChangelogEntry({ version, ...CHANGELOG[version] });
          logEvent('changelog_shown', { version });
        }
      }
      setIsLoading(false);
    };
    checkFirstLaunch();
  }, []);

  // Route notification taps via the navigation ref.
  useEffect(() => {
    const subscription = addNotificationResponseListener((data) => {
      if (!navigationRef.isReady()) return;
      if (data.deep_link === 'followup' && data.signal_id) {
        if (!isSubmittingFollowUp) {   // don't clobber an in-flight submission
          setFollowUpData({ signalId: data.signal_id, gameTitle: data.game_title });
        }
      } else if (data.deep_link === 'whats_new') {
        navigationRef.navigate('WhatsNew');
      } else {
        // Default: surface the play tab.
        navigationRef.navigate('Main', { screen: 'Play' });
      }
    });
    return () => subscription?.remove?.();
  }, [isSubmittingFollowUp]);

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
        <WelcomeScreen
          onComplete={() => {
            // Genuine fresh install: stamp the version now so this launch's
            // welcome flow itself counts as "seen" — otherwise the next
            // launch's empty-key check would misread this user as a
            // pre-tracking upgrader. Fire-and-forget; storage failures are
            // swallowed by markChangelogSeen.
            markChangelogSeen(Constants.expoConfig?.version);
            setShowWelcome(false);
          }}
        />
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
        {/* Follow-up push modal — inside SafeAreaProvider so useSafeAreaInsets works */}
        <FollowUpModal
          visible={!!followUpData}
          gameTitle={followUpData?.gameTitle}
          isSubmitting={isSubmittingFollowUp}
          showThanks={followUpSuccess}
          onWorked={() => handleFollowUp(true)}
          onDidntWork={() => handleFollowUp(false)}
          onDismiss={() => setFollowUpData(null)}
        />
        {/* Defer to the follow-up modal so two RN Modals never present at
            once at cold start; the changelog isn't marked seen until it's
            interacted with, so it resurfaces cleanly once follow-up closes. */}
        <ChangelogModal
          visible={!!changelogEntry && !followUpData}
          entry={changelogEntry}
          onFeaturePress={handleChangelogCta}
          onDismiss={dismissChangelog}
        />
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
