import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect, useNavigation, DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOpenClawStore } from '../../../../stores/openclaw.store';
import { useTheme } from '../../../../hooks/useTheme';
import { Spacing, BorderRadius } from '../../../../theme';
import type { Theme } from '../../../../theme';
import { GlassHeader, headerSpacerHeight } from '../../../../components/ui';

const AVATAR_COLORS = [
  '#E05C5C', '#E0895C', '#D4A843', '#6DBF6D',
  '#4DBFBF', '#5C9AE0', '#8B6DE0', '#D46DBF',
  '#5CB8E0', '#A0C878',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.replace(/-/g, ' ').split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

export function AgentAvatar({ name, size = 48, bgColor }: { name: string; size?: number; bgColor?: string }) {
  const color = bgColor ?? avatarColor(name);
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{initials(name)}</Text>
    </View>
  );
}

export default function AgentsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useTheme();
  const s = styles(theme);
  const insets = useSafeAreaInsets();
  const { connectionStatus, connectionError, agents, reconnect, fetchAgents } = useOpenClawStore();

  useFocusEffect(
    useCallback(() => {
      if (connectionStatus === 'connected') fetchAgents();
    }, [connectionStatus])
  );

  return (
    <View style={s.container}>
      <GlassHeader
        title="Agents"
        leftKind="menu"
        onLeftPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        large
      />

      {/* Connection banner */}
      {connectionStatus !== 'connected' && (
        <View style={[s.bannerWrap, { marginTop: headerSpacerHeight(insets.top, true) + Spacing.sm }]}>
          <View style={[s.banner, connectionStatus === 'connecting' && s.bannerConnecting]}>
            {connectionStatus === 'connecting' ? (
              <>
                <ActivityIndicator size="small" color={theme.warning} />
                <Text style={[s.bannerText, { color: theme.warning }]}>Connecting to your Mac...</Text>
              </>
            ) : (
              <>
                <Text style={s.bannerText}>{connectionError ?? 'Not connected to Mac'}</Text>
                <TouchableOpacity onPress={reconnect} style={s.retryChip} activeOpacity={0.7}>
                  <Text style={s.retryText}>Retry</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      <FlatList
        data={agents}
        keyExtractor={(item) => item.name}
        contentContainerStyle={[
          s.list,
          connectionStatus === 'connected' && { paddingTop: headerSpacerHeight(insets.top, true) + Spacing.sm },
        ]}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => router.push(`/(auth)/(drawer)/agents/${item.name}` as any)}
            activeOpacity={0.7}
          >
            <View style={s.cardLeft}>
              <View style={s.avatarWrap}>
                <AgentAvatar name={item.name} size={52} />
                <View style={[s.statusDot, { backgroundColor: item.status === 'idle' ? theme.success : theme.border }]} />
              </View>
            </View>
            <View style={s.cardBody}>
              <Text style={s.agentName}>{item.name}</Text>
              <Text style={s.agentRole}>{item.role}</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        ListEmptyComponent={
          <View style={s.empty}>
            {connectionStatus === 'connecting' ? (
              <ActivityIndicator color={theme.text.secondary} size="large" />
            ) : (
              <>
                <Text style={s.emptyIcon}>🤖</Text>
                <Text style={s.emptyTitle}>
                  {connectionStatus === 'connected' ? 'No agents yet' : 'Not connected'}
                </Text>
                <Text style={s.emptySubtitle}>
                  {connectionStatus === 'connected'
                    ? 'Create your first agent to get started.'
                    : 'Connect to your Mac to manage agents.'}
                </Text>
              </>
            )}
          </View>
        }
        ListFooterComponent={<View style={{ height: 120 }} />}
      />

      <TouchableOpacity
        style={[s.fab, connectionStatus !== 'connected' && s.fabDisabled]}
        onPress={() => router.push('/(auth)/(drawer)/agents/create' as any)}
        disabled={connectionStatus !== 'connected'}
        activeOpacity={0.85}
      >
        <Text style={[s.fabText, connectionStatus !== 'connected' && s.fabTextOff]}>＋  New Agent</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },

  bannerWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    backgroundColor: t.error + '18',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.error + '44',
  },
  bannerConnecting: { backgroundColor: t.warning + '18', borderColor: t.warning + '44' },
  bannerText: { flex: 1, color: t.error, fontSize: 13, fontWeight: '500' },
  retryChip: {
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20, backgroundColor: t.accent + '22',
  },
  retryText: { color: t.accent, fontSize: 12, fontWeight: '700' },

  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: t.surface,
    borderRadius: 18, padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  cardLeft: { marginRight: Spacing.md },
  avatarWrap: { position: 'relative' },
  statusDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2.5, borderColor: t.surface,
  },
  cardBody: { flex: 1, gap: 3 },
  agentName: { color: t.text.primary, fontSize: 16, fontWeight: '600' },
  agentRole: { color: t.text.secondary, fontSize: 13 },
  chevron: { color: t.border, fontSize: 22, fontWeight: '300' },

  sep: { height: Spacing.sm },

  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.xs },
  emptyTitle: { color: t.text.primary, fontSize: 18, fontWeight: '600' },
  emptySubtitle: { color: t.text.secondary, fontSize: 14, textAlign: 'center', paddingHorizontal: Spacing.xl },

  fab: {
    position: 'absolute', bottom: 28, alignSelf: 'center',
    backgroundColor: t.accent,
    paddingHorizontal: 28, paddingVertical: 15,
    borderRadius: 30,
    shadowColor: t.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12,
    elevation: 8,
  },
  fabDisabled: {
    backgroundColor: t.surface, shadowColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  fabTextOff: { color: t.text.secondary },
});
