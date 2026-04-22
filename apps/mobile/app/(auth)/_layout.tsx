import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/auth.store';
import { useOpenClawStore } from '../../stores/openclaw.store';

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isRestoring = useAuthStore((s) => s.isRestoring);
  const connect = useOpenClawStore((s) => s.connect);

  useEffect(() => {
    if (!isRestoring && !isAuthenticated) {
      router.replace('/onboarding');
    }
  }, [isAuthenticated, isRestoring]);

  // Start OpenClaw connection as soon as the user is authenticated,
  // regardless of which screen they land on.
  useEffect(() => {
    if (!isRestoring && isAuthenticated) {
      connect();
    }
  }, [isRestoring, isAuthenticated]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
