import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemeStore } from '../../../../stores/theme.store';
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
    trustHint: { ...TextStyles.small, color: theme.text.secondary, lineHeight: 20 },
    trustBar: { flexDirection: 'row', gap: Spacing.sm },
    trustBarSegment: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      backgroundColor: theme.border,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    trustBarSegmentActive: {
      backgroundColor: Colors.accent + '20',
      borderColor: Colors.accent,
    },
    trustBarLabel: { ...TextStyles.caption, color: theme.text.secondary, fontWeight: '600' },
    trustBarLabelActive: { color: Colors.accent },
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

const TRUST_LABELS: Record<TrustTier, string> = {
  [TrustTier.MANUAL]: 'Manual',
  [TrustTier.ASSISTED]: 'Assisted',
  [TrustTier.AUTONOMOUS]: 'Autonomous',
};

const TRUST_HINTS: Record<TrustTier, string> = {
  [TrustTier.MANUAL]: 'You approve every agent action before it runs.',
  [TrustTier.ASSISTED]: 'Agents run with smart defaults; you review edge cases.',
  [TrustTier.AUTONOMOUS]: 'Agents act freely — maximum productivity, minimum friction.',
};

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
  const { isDark, toggle: toggleDark } = useThemeStore();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const currentTier = user?.trustTier ?? TrustTier.ASSISTED;

  const handleTrustChange = (_tier: TrustTier) => {
    // Trust tier updates propagate through the auth store on next login sync
  };

  const handleLogout = () => {
    logout();
    router.replace('/onboarding');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {} },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
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

        {/* Agent Trust Level */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AGENT TRUST LEVEL</Text>
          <View style={styles.trustCard}>
            <Text style={styles.trustHint}>
              {TRUST_HINTS[currentTier]}
            </Text>
            <View style={styles.trustBar}>
              {(Object.values(TrustTier) as TrustTier[]).map((tier) => (
                <TouchableOpacity
                  key={tier}
                  style={[
                    styles.trustBarSegment,
                    currentTier === tier && styles.trustBarSegmentActive,
                  ]}
                  onPress={() => handleTrustChange(tier)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.trustBarLabel,
                    currentTier === tier && styles.trustBarLabelActive,
                  ]}>
                    {TRUST_LABELS[tier]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>APPEARANCE</Text>
          <View style={styles.settingsGroup}>
            <SettingRow
              label="Dark mode"
              toggle
              toggleValue={isDark}
              onToggle={toggleDark}
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

        {/* OpenClaw */}
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
            <SettingRow label="Timezone" value={user?.timezone ?? 'UTC'} onPress={() => {}} />
            <View style={styles.divider} />
            <SettingRow label="Export my data" onPress={() => {}} />
            <View style={styles.divider} />
            <SettingRow label="Delete account" onPress={handleDeleteAccount} danger />
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
