import { Stack } from 'expo-router';
import { DarkTheme } from '../../../../theme/colors';
import { TextStyles } from '../../../../theme';

export default function AgentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: DarkTheme.background },
        headerTintColor: DarkTheme.text.primary,
        headerTitleStyle: { ...TextStyles.h4, color: DarkTheme.text.primary },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: DarkTheme.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Your Agents' }} />
      <Stack.Screen name="create" options={{ title: 'New Agent', presentation: 'modal' }} />
      <Stack.Screen name="[name]" options={{ title: 'Agent Chat' }} />
    </Stack>
  );
}
