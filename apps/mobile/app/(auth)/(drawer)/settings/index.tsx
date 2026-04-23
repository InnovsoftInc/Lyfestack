import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { useTheme } from '../../../../hooks/useTheme';
import { useThemeStore } from '../../../../stores/theme.store';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius, Elevation } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { GlassHeader, headerSpacerHeight } from '../../../../components/ui';
import { useOpenClawStore } from '../../../../stores/openclaw.store';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scroll: { paddingBottom: Spacing['2xl'] },
    sectionLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.lg },
    group: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      overflow: 'hidden',
      ...Elevation.card,
      shadowColor: '#000',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      minHeight: 52,
    },
    rowIcon: {
      width: 28,
      fontSize: 18,
      marginRight: Spacing.sm,
    },
    rowLabel: {
      ...TextStyles.bodyMedium,
      color: theme.text.primary,
      flex: 1,
    },
    rowValue: { ...TextStyles.small, color: theme.text.secondary },
    rowArrow: { color: theme.text.secondary, fontSize: 22, fontWeight: '300', marginLeft: Spacing.sm },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginLeft: Spacing.md + 28 + Spacing.sm },
    statusDot: {
      width: 8, height: 8, borderRadius: 4,
      marginLeft: Spacing.sm,
    },
    footer: { alignItems: 'center', paddingTop: Spacing.xl },
    footerText: { ...TextStyles.caption, color: theme.text.secondary, opacity: 0.5 },
  });
}

interface RowProps {
  icon?: string;
  label: string;
  value?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
}

function Row({ icon, label, value, trailing, onPress }: RowProps) {
  const theme = useTheme();
  const s = makeStyles(theme);
  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      {icon ? <Text style={s.rowIcon}>{icon}</Text> : <View style={{ width: 28 + Spacing.sm }} />}
      <Text style={s.rowLabel}>{label}</Text>
      {value ? <Text style={s.rowValue}>{value}</Text> : null}
      {trailing}
      {onPress && !trailing ? <Text style={s.rowArrow}>›</Text> : null}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const s = makeStyles(theme);
  const { isDark, toggle: toggleDark } = useThemeStore();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { connectionStatus } = useOpenClawStore();

  const connectionColor =
    connectionStatus === 'connected' ? theme.success :
    connectionStatus === 'connecting' ? theme.warning : theme.error;
  const connectionLabel =
    connectionStatus === 'connected' ? 'Connected' :
    connectionStatus === 'connecting' ? 'Connecting…' : 'Not connected';

  return (
    <View style={s.container}>
      <GlassHeader
        title="Settings"
        leftKind="menu"
        onLeftPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        large
      />
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: headerSpacerHeight(insets.top, true) + Spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.section}>
          <Text style={s.sectionLabel}>Appearance</Text>
          <View style={s.group}>
            <Row
              icon="🌙"
              label="Dark mode"
              trailing={
                <Switch
                  value={isDark}
                  onValueChange={toggleDark}
                  trackColor={{ false: theme.border, true: Colors.accent }}
                  thumbColor={Colors.white}
                />
              }
            />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>OpenClaw</Text>
          <View style={s.group}>
            <Row
              icon="🔗"
              label="Connection"
              trailing={
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={s.rowValue}>{connectionLabel}</Text>
                  <View style={[s.statusDot, { backgroundColor: connectionColor }]} />
                  <Text style={s.rowArrow}>›</Text>
                </View>
              }
              onPress={() => router.push('/(auth)/connect-openclaw')}
            />
            <View style={s.divider} />
            <Row
              icon="🤖"
              label="Agents"
              onPress={() => router.push('/(auth)/(drawer)/agents')}
            />
            <View style={s.divider} />
            <Row
              icon="⚙️"
              label="OpenClaw preferences"
              onPress={() => router.push('/(auth)/(drawer)/profile/openclaw-settings' as any)}
            />
            <View style={s.divider} />
            <Row
              icon="📊"
              label="Usage & tokens"
              onPress={() => router.push('/(auth)/(drawer)/profile/openclaw-usage' as any)}
            />
            <View style={s.divider} />
            <Row
              icon="🧩"
              label="Skills"
              onPress={() => router.push('/(auth)/(drawer)/profile/skills' as any)}
            />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Integrations</Text>
          <View style={s.group}>
            <Row
              icon="🔌"
              label="Connected services"
              onPress={() => router.push('/(auth)/(drawer)/profile/integrations' as any)}
            />
            <View style={s.divider} />
            <Row
              icon="✨"
              label="OpenAI features"
              onPress={() => router.push('/(auth)/(drawer)/profile/openai-settings' as any)}
            />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>About</Text>
          <View style={s.group}>
            <Row icon="ℹ️" label="Version" value="0.1.0" />
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Lyfestack · Made by InnovSoft</Text>
        </View>
      </ScrollView>
    </View>
  );
}
