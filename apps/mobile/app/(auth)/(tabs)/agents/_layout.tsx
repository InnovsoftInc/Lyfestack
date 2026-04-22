import { Stack } from 'expo-router';

export default function AgentsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[name]" />
      <Stack.Screen name="create" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
