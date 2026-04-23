import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors, TrustTier } from '@lyfestack/shared';
import { useAuthStore } from '../../../../stores/auth.store';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scroll: { flex: 1 },
    header: { padding: Spacing.xl, paddingBottom: Spacing.md },
    heading: { ...TextStyles.h1, color: theme.text.primary },
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginHorizontal: Spacing.xl,
      marginBottom: Spacing.xl,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: Colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: { ...TextStyles.h3, color: Colors.white },
    userInfo: { gap: 3 },
    userName: { ...TextStyles.h4, color: theme.text.primary },
    userEmail: { ...TextStyles.small, color: theme.text.secondary },
    userTimezone: { ...TextStyles.caption, color: theme.text.secondary },
    section: { marginBottom: Spacing.xl, paddingHorizontal: Spacing.xl },
    sectionLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.md,
    },
    trustCard: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      gap: Spacing.md,
    },
    trustValue: { ...TextStyles.bodyMedium, color: theme.text.primary },
    trustHint: { ...TextStyles.small, color: theme.text.secondary, lineHeight: 20 },
    trustBar: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    trustBarSegment: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      backgroundColor: theme.border,
    },
    trustBarSegmentActive: { backgroundColor: Colors.accent },
    trustBarLabel: { ...TextStyles.caption, color: Colors.white },
    settingsGroup: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      minHeight: 52,
    },
    settingLabel: { ...TextStyles.bodyMedium, color: theme.text.primary },
    settingLabelDanger: { color: Colors.error },
    settingValue: { ...TextStyles.small, color: theme.text.secondary },
    settingArrow: { ...TextStyles.h4, color: theme.text.secondary },
    integrationStatus: { ...TextStyles.small, fontWeight: '600' },
    divider: { height: 1, backgroundColor: theme.border, marginLeft: Spacing.md },
    logoutBtn: {
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 14,
      alignItems: 'center',
    },
    logoutText: { ...TextStyles.bodyMedium, color: theme.text.secondary },
    footer: { alignItems: 'center', paddingBottom: Spacing.xl },
    footerText: { ...TextStyles.caption, color: theme.text.secondary, opacity: 0.5 },
  });
}

interface SettingRowProps {
  label: string;
  value?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  danger?: boolean;
}

function SettingRow({ label, value, toggle, toggleValue, onToggle, onPress, danger }: SettingRowProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress && !toggle}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>{label}</Text>
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: theme.border, true: Colors.accent }}
          thumbColor={Colors.white}
        />
      ) : value ? (
        <Text style={styles.settingValue}>{value}</Text>
      ) : onPress ? (
        <Text style={styles.settingArrow}>›</Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const [darkMode, setDarkMode] = useState(true);
  const [notifMorning, setNotifMorning] = useState(true);
  const [notifApprovals, setNotifApprovals] = useState(true);
  const [notifWeekly, setNotifWeekly] = useState(false);
  const theme = useTheme();
  const styles = makeStyles(theme);

  const trustLabel = {
    [TrustTier.MANUAL]: 'Manual (you approve everything)',
    [TrustTier.ASSISTED]: 'Assisted (smart defaults)',
    [TrustTier.AUTONOMOUS]: 'Autonomous (agents act freely)',
  };

  const handleLogout = () => {
    logout();
    router.replace('/onboarding');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* User card */}
        <View style={styles.header}>
          <Text style={styles.heading}>Profile</Text>
        </View>

        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.displayName ?? 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.displayName ?? 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <Text style={styles.userTimezone}>{user?.timezone ?? 'UTC'}</Text>
          </View>
        </View>

        {/* Agent trust level */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AGENT TRUST LEVEL</Text>
          <View style={styles.trustCard}>
            <Text style={styles.trustValue}>
              {user?.trustTier ? trustLabel[user.trustTier] : 'Assisted'}
            </Text>
            <Text style={styles.trustHint}>
              Higher trust = agents act more autonomously. Adjust as you build confidence in your system.
            </Text>
            <View style={styles.trustBar}>
              {Object.values(TrustTier).map((tier) => (
                <View
                  key={tier}
                  style={[
                    styles.trustBarSegment,
                    user?.trustTier === tier && styles.trustBarSegmentActive,
                  ]}
                >
                  <Text style={styles.trustBarLabel}>
                    {tier.charAt(0) + tier.slice(1).toLowerCase()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
          <View style={styles.settingsGroup}>
            <SettingRow
              label="Morning daily brief"
              toggle
              toggleValue={notifMorning}
              onToggle={setNotifMorning}
            />
            <View style={styles.divider} />
            <SettingRow
              label="Approval requests"
              toggle
              toggleValue={notifApprovals}
              onToggle={setNotifApprovals}
            />
            <View style={styles.divider} />
            <SettingRow
              label="Weekly recap"
              toggle
              toggleValue={notifWeekly}
              onToggle={setNotifWeekly}
            />
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>APPEARANCE</Text>
          <View style={styles.settingsGroup}>
            <SettingRow
              label="Dark mode"
              toggle
              toggleValue={darkMode}
              onToggle={setDarkMode}
            />
          </View>
        </View>

        {/* Integrations */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONNECTED INTEGRATIONS</Text>
          <View style={styles.settingsGroup}>
            <SettingRow
              label="Manage Integrations"
              onPress={() => router.push('/(auth)/(drawer)/profile/integrations')}
            />
          </View>
        </View>

        {/* OpenClaw Connection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>OPENCLAW</Text>
          <View style={styles.settingsGroup}>
            <SettingRow
              label="Connect to Mac"
              onPress={() => router.push('/(auth)/connect-openclaw')}
            />
            <View style={styles.divider} />
            <SettingRow
              label="Manage Agents"
              onPress={() => router.push('/(auth)/(drawer)/agents')}
            />
            <View style={styles.divider} />
            <SettingRow
              label="OpenClaw Settings"
              onPress={() => router.push('/(auth)/(drawer)/profile/openclaw-settings' as any)}
            />
            <View style={styles.divider} />
            <SettingRow
              label="Usage & Tokens"
              onPress={() => router.push('/(auth)/(drawer)/profile/openclaw-usage' as any)}
            />
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.settingsGroup}>
            <SettingRow label="Change timezone" value={user?.timezone ?? 'UTC'} onPress={() => {}} />
            <View style={styles.divider} />
            <SettingRow label="Export my data" onPress={() => {}} />
            <View style={styles.divider} />
            <SettingRow label="Delete account" onPress={() => {}} danger />
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Lyfestack v0.1.0 · Made with ☀️ by InnovSoft</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
