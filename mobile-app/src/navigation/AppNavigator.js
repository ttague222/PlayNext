/**
 * PlayNxt App Navigator
 *
 * Three-tab navigation structure:
 * - Play (default): Core recommendation flow
 * - History: Previously accepted recommendations
 * - Profile: Settings and account management
 */

import React, { useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { logScreenView } from '../services/analyticsService';
import { handleShareUrl } from '../services/deepLinkService';

// Exported ref so non-React code (e.g. notification tap handlers) can navigate.
export const navigationRef = createNavigationContainerRef();
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Play Flow Screens
import PlayScreen from '../screens/PlayScreen';
import TimeSelectScreen from '../screens/TimeSelectScreen';
import MoodSelectScreen from '../screens/MoodSelectScreen';
import OptionalFiltersScreen from '../screens/OptionalFiltersScreen';
import ResultsScreen from '../screens/ResultsScreen';

// Tab Screens
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Modal Screens
import SignInScreen from '../screens/SignInScreen';
import EmailSignInScreen from '../screens/EmailSignInScreen';
import PremiumScreen from '../screens/PremiumScreen';

// Detail Screens
import BucketDetailScreen from '../screens/BucketDetailScreen';
import GameDetailScreen from '../screens/GameDetailScreen';
import HelpScreen from '../screens/HelpScreen';
import WhatsNewScreen from '../screens/WhatsNewScreen';
import ConnectSteamScreen from '../screens/ConnectSteamScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

/**
 * Deep linking (Universal Links / App Links for playnxt.io/s/*).
 *
 * Share links are handled imperatively in deepLinkService — count the open,
 * land the viewer on the Play tab — rather than mapped to a route, because
 * the app has no share-viewing screen on purpose: the landing page already
 * showed the picks, and in-app the next step is getting your own. Other
 * links (OAuth redirects) pass through to their own handlers untouched.
 */
const linking = {
  prefixes: ['https://playnxt.io', 'playnxt://'],
  config: { screens: {} },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    // Cold start from a share link: count it; the default route is already
    // the Play tab, so there is nowhere further to go.
    if (handleShareUrl(url)) return null;
    return url;
  },
  subscribe(listener) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (handleShareUrl(url)) {
        // Warm open: surface the Play tab so the link visibly did something.
        if (navigationRef.isReady()) {
          navigationRef.navigate('Main', { screen: 'Play', params: { screen: 'PlayHome' } });
        }
        return;
      }
      listener(url);
    });
    return () => subscription.remove();
  },
};

const stackScreenOptions = {
  headerShown: false,
  animation: 'slide_from_right',
  contentStyle: {
    backgroundColor: '#1a1a2e',
  },
};

/**
 * Play Tab Stack
 * Contains the full recommendation flow
 */
const PlayStack = () => {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="PlayHome" component={PlayScreen} />
      <Stack.Screen name="TimeSelect" component={TimeSelectScreen} />
      <Stack.Screen name="MoodSelect" component={MoodSelectScreen} />
      <Stack.Screen name="OptionalFilters" component={OptionalFiltersScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
    </Stack.Navigator>
  );
};

/**
 * Main Tab Navigator
 * Three tabs only: Play, History, Profile
 */
const TabNavigator = () => {
  const insets = useSafeAreaInsets();

  // Calculate tab bar height based on platform and safe area
  // Android needs extra padding to avoid system navigation bar
  const tabBarHeight = Platform.select({
    ios: 80,
    android: 60 + Math.max(insets.bottom, 10), // Add safe area bottom or minimum padding
  });

  const tabBarPaddingBottom = Platform.select({
    ios: 20,
    android: Math.max(insets.bottom, 10), // Use safe area or minimum padding
  });

  return (
    <Tab.Navigator
      initialRouteName="Play"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a2e',
          borderTopColor: '#2a2a4e',
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: tabBarPaddingBottom,
          height: tabBarHeight,
        },
        tabBarActiveTintColor: '#e94560',
        tabBarInactiveTintColor: '#808080',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: -2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Play') {
            iconName = focused ? 'game-controller' : 'game-controller-outline';
          } else if (route.name === 'Library') {
            iconName = focused ? 'library' : 'library-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Play"
        component={PlayStack}
        options={{
          tabBarLabel: 'Play',
        }}
      />
      <Tab.Screen
        name="Library"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'Library',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

/**
 * Root Navigator
 * Includes modals that can be presented from anywhere
 */
const AppNavigator = () => {
  const routeNameRef = useRef(null);

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={() => {
        routeNameRef.current = navigationRef.getCurrentRoute()?.name;
        logScreenView(routeNameRef.current);
      }}
      onStateChange={() => {
        const currentRouteName = navigationRef.getCurrentRoute()?.name;
        if (currentRouteName && currentRouteName !== routeNameRef.current) {
          routeNameRef.current = currentRouteName;
          logScreenView(currentRouteName);
        }
      }}
    >
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Main" component={TabNavigator} />
        <RootStack.Screen
          name="SignIn"
          component={SignInScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <RootStack.Screen
          name="EmailSignIn"
          component={EmailSignInScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <RootStack.Screen
          name="Premium"
          component={PremiumScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <RootStack.Screen
          name="BucketDetail"
          component={BucketDetailScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <RootStack.Screen
          name="GameDetail"
          component={GameDetailScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <RootStack.Screen
          name="Help"
          component={HelpScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <RootStack.Screen
          name="WhatsNew"
          component={WhatsNewScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <RootStack.Screen
          name="ConnectSteam"
          component={ConnectSteamScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
