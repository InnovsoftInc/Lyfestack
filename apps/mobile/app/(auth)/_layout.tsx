import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/auth.store';

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isRestoring = useAuthStore((s) => s.isRestoring);

  useEffect(() => {
    if (!isRestoring && !isAuthenticated) {
      router.replace('/onboarding');
    }
  }, [isAuthenticated, isRestoring]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
