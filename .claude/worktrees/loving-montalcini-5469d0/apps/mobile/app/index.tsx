import { Redirect } from 'expo-router';

export default function Index() {
  // TODO: check auth state — redirect to onboarding or dashboard
  return <Redirect href="/(auth)/(tabs)/dashboard" />;
}
