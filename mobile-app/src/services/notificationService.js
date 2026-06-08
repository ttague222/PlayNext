/**
 * PlayNxt push-notification registration and handling (Expo).
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import api from './api';

const EAS_PROJECT_ID = '268e6152-b422-47f9-b6c3-2b6811100ba6';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Request OS permission, get the Expo token, and register it with the API.
 * Returns the token on success, or null.
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
  const token = tokenResponse.data;
  try {
    await api.registerPushToken(token, Platform.OS);
  } catch (e) {
    // Registration failed — token still valid locally; will retry on next foreground
    console.warn('[notifications] register failed:', e?.message);
  }
  return token;
}

/**
 * Disable notifications: try to unregister the current token from the API.
 * Quietly no-ops when permission was never granted (so toggling OFF before
 * the user ever enabled is safe and silent).
 */
export async function unregisterFromPushNotifications() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    const token = tokenResponse?.data;
    if (token) {
      await api.unregisterPushToken(token);
    }
  } catch (e) {
    console.warn('[notifications] unregister failed:', e?.message);
  }
}

/**
 * Wire a tap handler. `onNotification(data)` receives the full notification
 * data payload: { deep_link: 'whats_new' | 'play' | 'followup', signal_id?, game_title? }.
 * Returns the subscription so callers can remove it on unmount.
 */
export function addNotificationResponseListener(onNotification) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data || {};
    onNotification(data);
  });
}
