import { Stack } from 'expo-router';

export default function AuthLayout() {
  // TODO: add auth guard — redirect to /onboarding if not authenticated
  return <Stack screenOptions={{ headerShown: false }} />;
}
