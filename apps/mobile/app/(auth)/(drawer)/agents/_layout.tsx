import { Stack } from 'expo-router';
import { useTheme } from '../../../../hooks/useTheme';

export default function AgentsLayout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[name]" />
      <Stack.Screen name="[name]/chat" />
      <Stack.Screen name="[name]/file" />
      <Stack.Screen name="create" />
    </Stack>
  );
}
