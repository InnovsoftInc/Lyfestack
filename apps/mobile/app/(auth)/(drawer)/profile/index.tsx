import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius, Elevation } from '../../../../theme';
import { Colors, TrustTier } from '@lyfestack/shared';
import { useAuthStore } from '../../../../stores/auth.store';
import { GlassHeader, headerSpacerHeight } from '../../../../components/ui';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scroll: { paddingBottom: Spacing['2xl'] },
    hero: {
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      gap: Spacing.sm,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: Colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      ...Elevation.floating,
      shadowColor: Colors.accent,
    },
    avatarText: { ...TextStyles.h1, color: Colors.white },
    userName: { ...TextStyles.h2, color: theme.text.primary, marginTop: Spacing.sm },
    userEmail: { ...TextStyles.body, color: theme.text.secondary },
    userTimezone: { ...TextStyles.small, color: theme.text.secondary, opacity: 0.7 },
    section: { marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
    sectionLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      padding: Spacing.md,
      gap: Spacing.md,
      ...Elevation.card,
    },
    trustHint: { ...TextStyles.small, color: theme.text.secondary, lineHeight: 20 },
    trustBar: { flexDirection: 'row', gap: Spacing.sm },
    trustSeg: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      backgroundColor: theme.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    trustSegActive: {
      backgroundColor: Colors.accent + '20',
      borderColor: Colors.accent,
    },
    trustLabel: { ...TextStyles.caption, color: theme.text.secondary, fontWeight: '600' },
    trustLabelActive: { color: Colors.accent },
    group: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      overflow: 'hidden',
      ...Elevation.card,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      minHeight: 52,
    },
    rowLabel: { ...TextStyles.bodyMedium, color: theme.text.primary },
    rowLabelDanger: { color: Colors.error },
    rowValue: { ...TextStyles.small, color: theme.text.secondary },
    rowArrow: { color: theme.text.secondary, fontSize: 22, fontWeight: '300' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginLeft: Spacing.md },
    logoutBtn: {
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: theme.surface,
    },
    logoutText: { ...TextStyles.bodyMedium, color: theme.text.secondary },
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

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const theme = useTheme();
  const s = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const currentTier = user?.trustTier ?? TrustTier.ASSISTED;

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
    <View style={s.container}>
      <GlassHeader
        title="Profile"
        leftKind="menu"
        onLeftPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        right={
          <TouchableOpacity
            onPress={() => router.push('/(auth)/(drawer)/settings' as any)}
            hitSlop={10}
            activeOpacity={0.6}
          >
            <Text style={{ fontSize: 22, color: theme.text.primary }}>⚙︎</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: headerSpacerHeight(insets.top) + Spacing.sm }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{(user?.displayName ?? 'U').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={s.userName}>{user?.displayName ?? 'User'}</Text>
          <Text style={s.userEmail}>{user?.email ?? ''}</Text>
          {user?.timezone ? <Text style={s.userTimezone}>{user.timezone}</Text> : null}
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Agent trust level</Text>
          <View style={s.card}>
            <Text style={s.trustHint}>{TRUST_HINTS[currentTier]}</Text>
            <View style={s.trustBar}>
              {(Object.values(TrustTier) as TrustTier[]).map((tier) => (
                <TouchableOpacity
                  key={tier}
                  style={[s.trustSeg, currentTier === tier && s.trustSegActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.trustLabel, currentTier === tier && s.trustLabelActive]}>
                    {TRUST_LABELS[tier]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Account</Text>
          <View style={s.group}>
            <TouchableOpacity style={s.row} activeOpacity={0.6}>
              <Text style={s.rowLabel}>Timezone</Text>
              <Text style={s.rowValue}>{user?.timezone ?? 'UTC'}</Text>
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity style={s.row} activeOpacity={0.6}>
              <Text style={s.rowLabel}>Export my data</Text>
              <Text style={s.rowArrow}>›</Text>
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity style={s.row} activeOpacity={0.6} onPress={handleDeleteAccount}>
              <Text style={[s.rowLabel, s.rowLabelDanger]}>Delete account</Text>
              <Text style={[s.rowArrow, { color: Colors.error }]}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.section}>
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={s.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
