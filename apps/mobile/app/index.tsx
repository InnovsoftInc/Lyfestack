import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/auth.store';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isRestoring = useAuthStore((s) => s.isRestoring);
  if (isRestoring) return null;
  return <Redirect href={isAuthenticated ? '/(auth)/(drawer)/dashboard' : '/onboarding'} />;
}
