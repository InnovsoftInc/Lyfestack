import { Drawer } from 'expo-router/drawer';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { useAuthStore } from '../../../stores/auth.store';
import { DarkTheme } from '../../../theme/colors';
import { TextStyles, Spacing } from '../../../theme';
import { Colors } from '@lyfestack/shared';

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuthStore();

  return (
    <View style={styles.drawerContainer}>
      <View style={styles.drawerHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.displayName?.charAt(0).toUpperCase() ?? 'U'}
          </Text>
        </View>
        <Text style={styles.displayName}>{user?.displayName ?? 'User'}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>
      </View>

      <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerItems}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
        <Text style={styles.logoutIcon}>🚪</Text>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DrawerLayout() {
  return (
    <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: DarkTheme.background },
          headerTintColor: DarkTheme.text.primary,
          headerShadowVisible: false,
          drawerStyle: { backgroundColor: DarkTheme.background, width: 260 },
          drawerActiveTintColor: Colors.accent,
          drawerInactiveTintColor: DarkTheme.text.secondary,
          drawerActiveBackgroundColor: DarkTheme.surface,
          drawerLabelStyle: { ...TextStyles.body, marginLeft: -8 },
        }}
      >
        <Drawer.Screen
          name="dashboard/index"
          options={{ title: 'Today', drawerIcon: ({ focused }) => <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>☀️</Text> }}
        />
        <Drawer.Screen
          name="goals/index"
          options={{ title: 'Goals', drawerIcon: ({ focused }) => <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>🎯</Text> }}
        />
        <Drawer.Screen
          name="goals/[id]"
          options={{ drawerItemStyle: { display: 'none' } }}
        />
        <Drawer.Screen
          name="approvals/index"
          options={{ title: 'Approvals', drawerIcon: ({ focused }) => <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>✅</Text> }}
        />
        <Drawer.Screen
          name="agents"
          options={{ title: 'Agents', drawerIcon: ({ focused }) => <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>🤖</Text> }}
        />
        <Drawer.Screen
          name="profile/index"
          options={{ title: 'Profile', drawerIcon: ({ focused }) => <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>👤</Text> }}
        />
        <Drawer.Screen
          name="profile/integrations"
          options={{ drawerItemStyle: { display: 'none' } }}
        />
      </Drawer>
  );
}

const styles = StyleSheet.create({
  drawerContainer: { flex: 1, backgroundColor: DarkTheme.background },
  drawerHeader: {
    padding: Spacing.xl,
    paddingTop: Spacing.xl * 2,
    borderBottomWidth: 1,
    borderBottomColor: DarkTheme.border,
    gap: 4,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  avatarText: { ...TextStyles.h3, color: Colors.white },
  displayName: { ...TextStyles.h4, color: DarkTheme.text.primary },
  email: { ...TextStyles.small, color: DarkTheme.text.secondary },
  drawerItems: { paddingTop: Spacing.sm },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: DarkTheme.border,
  },
  logoutIcon: { fontSize: 18 },
  logoutText: { ...TextStyles.body, color: DarkTheme.text.secondary },
});
