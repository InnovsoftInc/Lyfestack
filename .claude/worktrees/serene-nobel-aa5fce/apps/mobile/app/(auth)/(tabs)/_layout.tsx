import { Tabs } from 'expo-router';
import { DarkTheme } from '../../../theme/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: DarkTheme.background,
          borderTopColor: DarkTheme.border,
        },
        tabBarActiveTintColor: DarkTheme.accent,
        tabBarInactiveTintColor: DarkTheme.text.secondary,
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Today' }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals' }} />
      <Tabs.Screen name="approvals" options={{ title: 'Approvals' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
