import { Stack } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';

export default function GoalSetupLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text.primary,
        headerShadowVisible: false,
        presentation: 'modal',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'New Goal' }} />
      <Stack.Screen name="guided" options={{ title: 'Goal Setup' }} />
      <Stack.Screen name="plan-preview" options={{ title: 'Your Plan' }} />
    </Stack>
  );
}
