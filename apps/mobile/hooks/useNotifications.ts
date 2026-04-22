import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import type * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  savePushTokenToServer,
  addNotificationListener,
  addNotificationResponseListener,
} from '../services/notifications';
import { useAuthStore } from '../stores/auth.store';

export function useNotifications(): void {
  const { isAuthenticated, authToken } = useAuthStore();
  const tokenRegistered = useRef(false);

  // Register push token once after authentication
  useEffect(() => {
    if (!isAuthenticated || !authToken || tokenRegistered.current) return;

    void (async () => {
      const token = await registerForPushNotifications();
      if (token && authToken) {
        await savePushTokenToServer(token, authToken);
        tokenRegistered.current = true;
      }
    })();
  }, [isAuthenticated, authToken]);

  // Handle foreground notifications
  useEffect(() => {
    const remove = addNotificationListener((notification) => {
      const type = notification.request.content.data?.['type'] as string | undefined;
      // Foreground notifications are shown automatically via setNotificationHandler
      // Log for analytics
      console.info('[Notifications] Received:', type);
    });
    return remove;
  }, []);

  // Handle notification taps (background / killed state)
  useEffect(() => {
    const remove = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const type = data?.['type'] as string | undefined;

      switch (type) {
        case 'daily_brief':
          router.push('/(auth)/(tabs)/dashboard');
          break;
        case 'task_reminder': {
          const taskId = data?.['taskId'] as string | undefined;
          if (taskId) router.push(`/(auth)/(tabs)/goals/${taskId}`);
          break;
        }
        case 'streak_alert':
          router.push('/(auth)/(tabs)/dashboard');
          break;
        case 'agent_complete':
          router.push('/(auth)/(tabs)/approvals');
          break;
        default:
          router.push('/(auth)/(tabs)/dashboard');
      }
    });
    return remove;
  }, []);
}
