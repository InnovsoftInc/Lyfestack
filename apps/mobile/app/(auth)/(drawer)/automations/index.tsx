import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { DrawerActions } from '@react-navigation/native';
import { useTheme } from '../../../../hooks/useTheme';
import { Spacing } from '../../../../theme';
import type { Theme } from '../../../../theme';
import { routinesApi, humanizeCron, formatRelativeTime, formatNextRun } from '../../../../services/routines.api';
import type { Routine } from '../../../../services/routines.api';

export default function AutomationsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useTheme();
  const s = styles(theme);
  const insets = useSafeAreaInsets();

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const fetchRoutines = useCallback(async () => {
    try {
      const data = await routinesApi.list();
      setRoutines(data);
    } catch (err) {
      console.warn('[Routines] fetch failed', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void fetchRoutines();
    }, [fetchRoutines]),
  );

  const handleToggle = useCallback(async (id: string) => {
    setTogglingId(id);
    try {
      const updated = await routinesApi.toggle(id);
      setRoutines((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch {
      Alert.alert('Error', 'Failed to toggle routine.');
    } finally {
      setTogglingId(null);
    }
  }, []);

  const handleDelete = useCallback((id: string, name: string) => {
    Alert.alert(
      'Delete Routine',
      `Delete "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await routinesApi.delete(id);
              setRoutines((prev) => prev.filter((r) => r.id !== id));
            } catch {
              Alert.alert('Error', 'Failed to delete routine.');
            }
          },
        },
      ],
    );
  }, []);

  const handleRunNow = useCallback(async (id: string) => {
    setRunningId(id);
    try {
      const record = await routinesApi.runNow(id);
      const msg = record.status === 'success'
        ? 'Routine ran successfully.'
        : `Run failed: ${record.error ?? 'Unknown error'}`;
      Alert.alert('Run Complete', msg);
      void fetchRoutines();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Run failed.');
    } finally {
      setRunningId(null);
    }
  }, [fetchRoutines]);

  const renderItem = useCallback(({ item }: { item: Routine }) => (
    <TouchableOpacity
      style={s.card}
      onPress={() => router.push({ pathname: '/(auth)/(drawer)/automations/create', params: { editId: item.id } } as any)}
      onLongPress={() => handleDelete(item.id, item.name)}
      activeOpacity={0.75}
      delayLongPress={600}
    >
      <View style={s.cardHeader}>
        <View style={[s.statusDot, { backgroundColor: item.enabled ? theme.success : theme.border }]} />
        <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
        {togglingId === item.id ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : (
          <Switch
            value={item.enabled}
            onValueChange={() => handleToggle(item.id)}
            trackColor={{ false: theme.border, true: theme.accent + '66' }}
            thumbColor={item.enabled ? theme.accent : theme.text.secondary}
          />
        )}
      </View>

      <Text style={s.schedule}>{humanizeCron(item.schedule)}</Text>

      {item.description ? (
        <Text style={s.description} numberOfLines={2}>{item.description}</Text>
      ) : null}

      <View style={s.agentRow}>
        <View style={s.agentChip}>
          <Text style={s.agentChipText}>{item.agentName}</Text>
        </View>
      </View>

      <View style={s.metaRow}>
        <View style={s.metaItem}>
          <Text style={s.metaLabel}>Last run</Text>
          <Text style={s.metaValue}>{formatRelativeTime(item.lastRun)}</Text>
        </View>
        <View style={s.metaDivider} />
        <View style={s.metaItem}>
          <Text style={s.metaLabel}>Next run</Text>
          <Text style={s.metaValue}>{item.enabled ? formatNextRun(item.nextRun) : '—'}</Text>
        </View>
        <View style={s.metaDivider} />
        <TouchableOpacity
          style={s.runBtn}
          onPress={() => handleRunNow(item.id)}
          disabled={runningId === item.id}
          activeOpacity={0.7}
        >
          {runningId === item.id
            ? <ActivityIndicator size="small" color={theme.accent} />
            : <Text style={s.runBtnText}>Run now</Text>}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  ), [theme, togglingId, runningId, handleToggle, handleDelete, handleRunNow, router, s]);

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + Spacing.md }]}>
        <TouchableOpacity
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          hitSlop={12}
          activeOpacity={0.6}
          style={s.menuBtn}
        >
          <Text style={[s.menuIcon, { color: theme.text.primary }]}>☰</Text>
        </TouchableOpacity>
        <Text style={s.title}>Routines</Text>
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={routines}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void fetchRoutines(); }}
              tintColor={theme.accent}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>⏰</Text>
              <Text style={s.emptyTitle}>No routines yet</Text>
              <Text style={s.emptySubtitle}>
                Create a routine to run agents on a schedule — daily briefings, weekly reviews, and more.
              </Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 120 }} />}
        />
      )}

      <TouchableOpacity
        style={s.fab}
        onPress={() => router.push('/(auth)/(drawer)/automations/create' as any)}
        activeOpacity={0.85}
      >
        <Text style={s.fabText}>＋  New Routine</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    menuBtn: { padding: 4 },
    menuIcon: { fontSize: 22 },
    title: {
      color: t.text.primary,
      fontSize: 34,
      fontWeight: '700',
      letterSpacing: 0.3,
      flex: 1,
    },

    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs },

    card: {
      backgroundColor: t.surface,
      borderRadius: 18,
      padding: Spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      gap: Spacing.xs,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    cardName: {
      flex: 1,
      color: t.text.primary,
      fontSize: 17,
      fontWeight: '600',
    },

    schedule: {
      color: t.accent,
      fontSize: 13,
      fontWeight: '600',
      marginLeft: Spacing.xs + 2,
    },
    description: {
      color: t.text.secondary,
      fontSize: 13,
      lineHeight: 18,
      marginLeft: Spacing.xs + 2,
    },

    agentRow: {
      flexDirection: 'row',
      marginLeft: Spacing.xs + 2,
      marginTop: 2,
    },
    agentChip: {
      backgroundColor: t.accent + '1A',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    agentChipText: {
      color: t.accent,
      fontSize: 12,
      fontWeight: '600',
    },

    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: Spacing.xs,
      paddingTop: Spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
    },
    metaItem: { flex: 1, alignItems: 'center' },
    metaLabel: { color: t.text.secondary, fontSize: 11, fontWeight: '500' },
    metaValue: { color: t.text.primary, fontSize: 13, fontWeight: '600', marginTop: 2 },
    metaDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: t.border },

    runBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 30,
    },
    runBtnText: {
      color: t.accent,
      fontSize: 13,
      fontWeight: '700',
    },

    empty: {
      alignItems: 'center',
      paddingTop: 80,
      gap: Spacing.sm,
      paddingHorizontal: Spacing.xl,
    },
    emptyIcon: { fontSize: 48, marginBottom: Spacing.xs },
    emptyTitle: { color: t.text.primary, fontSize: 18, fontWeight: '600' },
    emptySubtitle: {
      color: t.text.secondary,
      fontSize: 14,
      textAlign: 'center',
    },

    fab: {
      position: 'absolute',
      bottom: 28,
      alignSelf: 'center',
      backgroundColor: t.accent,
      paddingHorizontal: 28,
      paddingVertical: 15,
      borderRadius: 30,
      shadowColor: t.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
    fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
