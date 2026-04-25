import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_BASE = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';

export type NotificationHandler = (notification: Notifications.Notification) => void;
export type ResponseHandler = (response: Notifications.NotificationResponse) => void;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[Notifications] Push notifications require a physical device');
    return null;
  }

  // Expo Go doesn't support remote push notifications since SDK 53
  if (Constants.appOwnership === 'expo') {
    console.warn('[Notifications] Push notifications are not supported in Expo Go — use a development build');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Permission not granted');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
    });
  }

  const projectId = process.env['EXPO_PUBLIC_PROJECT_ID'];
  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : {},
  );

  return token.data;
}

export async function savePushTokenToServer(
  token: string,
  authToken: string,
): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/users/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ pushToken: token }),
    });

    if (!res.ok) {
      console.warn('[Notifications] Failed to save push token to server:', res.status);
    }
  } catch (err) {
    console.warn('[Notifications] Error saving push token:', err);
  }
}

export function addNotificationListener(handler: NotificationHandler): () => void {
  const sub = Notifications.addNotificationReceivedListener(handler);
  return () => sub.remove();
}

export function addNotificationResponseListener(handler: ResponseHandler): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(handler);
  return () => sub.remove();
}
