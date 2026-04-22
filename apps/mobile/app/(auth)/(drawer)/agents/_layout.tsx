import { Stack } from 'expo-router';
import { useTheme } from '../../../../hooks/useTheme';

export default function AgentsLayout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[name]" />
      <Stack.Screen name="[name]/chat" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[name]/file" options={{ presentation: 'modal' }} />
      <Stack.Screen name="create" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
