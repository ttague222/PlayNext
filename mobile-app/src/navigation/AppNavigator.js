/**
 * PlayNxt App Navigator
 *
 * Three-tab navigation structure:
 * - Play (default): Core recommendation flow
 * - History: Previously accepted recommendations
 * - Profile: Settings and account management
 */

import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
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
import PremiumScreen from '../screens/PremiumScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

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
          } else if (route.name === 'History') {
            iconName = focused ? 'time' : 'time-outline';
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
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'History',
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
  return (
    <NavigationContainer>
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
          name="Premium"
          component={PremiumScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
