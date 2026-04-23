import { Drawer } from 'expo-router/drawer';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { useEffect } from 'react';
import { useAuthStore } from '../../../stores/auth.store';
import { useOpenClawStore } from '../../../stores/openclaw.store';
import { useApprovalsStore } from '../../../stores/approvals.store';
import { useTheme } from '../../../hooks/useTheme';
import type { Theme } from '../../../theme/colors';
import { TextStyles, Spacing } from '../../../theme';
import { Colors, ApprovalState } from '@lyfestack/shared';

function makeBannerStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: Spacing.xl,
      marginBottom: Spacing.md,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      backgroundColor: theme.surface,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    text: { fontSize: 12, fontWeight: '600', flex: 1 },
  });
}

function ConnectionBanner() {
  const { connectionStatus, connectionUrl, reconnect } = useOpenClawStore();
  const theme = useTheme();
  const bannerStyles = makeBannerStyles(theme);

  const color = connectionStatus === 'connected'
    ? '#22C55E'
    : connectionStatus === 'connecting'
    ? '#F59E0B'
    : '#EF4444';
  const label = connectionStatus === 'connected'
    ? `Connected${connectionUrl ? ` · ${connectionUrl.replace('http://', '')}` : ''}`
    : connectionStatus === 'connecting'
    ? 'Scanning network...'
    : 'Not connected — tap to retry';

  return (
    <TouchableOpacity
      style={[bannerStyles.container, { borderColor: color + '55' }]}
      onPress={connectionStatus !== 'connecting' ? reconnect : undefined}
      activeOpacity={connectionStatus !== 'connecting' ? 0.7 : 1}
    >
      <View style={[bannerStyles.dot, { backgroundColor: color }]} />
      <Text style={[bannerStyles.text, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    drawerContainer: { flex: 1, backgroundColor: theme.background },
    drawerHeader: {
      padding: Spacing.xl,
      paddingTop: Spacing.xl * 2,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
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
    displayName: { ...TextStyles.h4, color: theme.text.primary },
    email: { ...TextStyles.small, color: theme.text.secondary },
    drawerItems: { paddingTop: Spacing.sm },
    pendingBadge: {
      backgroundColor: Colors.error,
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: 8,
    },
    pendingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.xl,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    logoutIcon: { fontSize: 18 },
    logoutText: { ...TextStyles.body, color: theme.text.secondary },
  });
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuthStore();
  const { actions } = useApprovalsStore();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const pendingCount = actions.filter((a) => a.approvalState === ApprovalState.PENDING).length;

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

      <ConnectionBanner />

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
  const theme = useTheme();

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text.primary,
        headerShadowVisible: false,
        drawerStyle: { backgroundColor: theme.background, width: 260 },
        drawerActiveTintColor: Colors.accent,
        drawerInactiveTintColor: theme.text.secondary,
        drawerActiveBackgroundColor: theme.surface,
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
        name="automations/index"
        options={{ title: 'Automate', drawerIcon: ({ focused }) => <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>⚡</Text> }}
      />
      <Drawer.Screen
        name="approvals/index"
        options={{ title: 'Approvals', drawerIcon: ({ focused }) => <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>✅</Text> }}
      />
      <Drawer.Screen
        name="agents"
        options={{ title: 'Agents', headerShown: false, drawerIcon: ({ focused }) => <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>🤖</Text> }}
      />
      <Drawer.Screen
        name="profile/index"
        options={{ title: 'Profile', drawerIcon: ({ focused }) => <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>👤</Text> }}
      />
      <Drawer.Screen name="goals/[id]" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="automations/create" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="profile/integrations" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="profile/openclaw-settings" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="profile/openclaw-usage" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="profile/openai-settings" options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer>
  );
}
