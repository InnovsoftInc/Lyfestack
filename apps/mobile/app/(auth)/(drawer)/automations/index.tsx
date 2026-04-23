import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Switch, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { useAutomationsStore } from '../../../../stores/automations.store';
import type { Routine } from '../../../../stores/automations.store';
import { useOpenClawStore } from '../../../../stores/openclaw.store';

const TYPE_META: Record<Routine['type'], { label: string; color: string; emoji: string }> = {
  heartbeat: { label: 'Heartbeat', color: '#a855f7', emoji: '💓' },
  hook:      { label: 'Hook',      color: '#3b82f6', emoji: '🪝' },
  cron:      { label: 'Cron',      color: '#22c55e', emoji: '⏰' },
  custom:    { label: 'Custom',    color: Colors.accent, emoji: '⚡' },
};

const CHANNEL_LABEL: Record<string, string> = {
  telegram: '📱 Telegram',
  slack: '💬 Slack',
};

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    listContent: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
    infoBox: {
      marginHorizontal: Spacing.xl,
      marginTop: Spacing.md,
      marginBottom: Spacing.sm,
      backgroundColor: Colors.accent + '12',
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.accent + '30',
      gap: 4,
    },
    infoTitle: { ...TextStyles.bodyMedium, color: Colors.accent },
    infoText: { ...TextStyles.small, color: theme.text.secondary, lineHeight: 20 },
    sectionLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.sm,
      marginTop: Spacing.md,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    cardDisabled: { opacity: 0.55 },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    cardInfo: { flex: 1, gap: 4 },
    cardName: { ...TextStyles.bodyMedium, color: theme.text.primary },
    cardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      alignSelf: 'flex-start',
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    scheduleText: { ...TextStyles.small, color: theme.text.secondary },
    cardDescription: {
      ...TextStyles.small,
      color: theme.text.secondary,
      lineHeight: 18,
      backgroundColor: theme.background,
      borderRadius: BorderRadius.sm,
      padding: Spacing.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    metaChips: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
      flex: 1,
    },
    metaChip: {
      backgroundColor: theme.background,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: theme.border,
    },
    metaChipText: { ...TextStyles.caption, color: theme.text.secondary },
    actionRow: { flexDirection: 'row', gap: Spacing.sm },
    deleteBtn: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: theme.error,
      backgroundColor: theme.error + '10',
    },
    deleteBtnText: { ...TextStyles.caption, color: theme.error, fontWeight: '600' },
    readonlyNote: { ...TextStyles.caption, color: theme.text.secondary, fontStyle: 'italic' },
    fab: {
      position: 'absolute',
      bottom: Spacing.xl,
      alignSelf: 'center',
      backgroundColor: Colors.accent,
      paddingHorizontal: 28,
      paddingVertical: 15,
      borderRadius: 30,
      shadowColor: Colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
    fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    emptyState: {
      alignItems: 'center',
      paddingTop: 60,
      gap: Spacing.md,
      paddingHorizontal: Spacing.xl,
    },
    emptyIcon: { fontSize: 56 },
    emptyTitle: { ...TextStyles.h3, color: theme.text.primary },
    emptySubtitle: {
      ...TextStyles.body,
      color: theme.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    notConnected: {
      margin: Spacing.xl,
      backgroundColor: theme.error + '12',
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.error + '30',
      gap: Spacing.sm,
      alignItems: 'center',
    },
    notConnectedText: { ...TextStyles.body, color: theme.text.secondary, textAlign: 'center' },
    notConnectedBtn: {
      backgroundColor: theme.error,
      paddingHorizontal: Spacing.xl,
      paddingVertical: 10,
      borderRadius: BorderRadius.full,
    },
    notConnectedBtnText: { ...TextStyles.bodyMedium, color: Colors.white },
  });
}

function RoutineCard({
  routine,
  onToggle,
  onDelete,
}: {
  routine: Routine;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const meta = TYPE_META[routine.type];
  const canToggle = routine.type === 'hook';
  const canDelete = routine.type === 'hook';

  return (
    <View style={[styles.card, !routine.enabled && styles.cardDisabled]}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <View style={styles.cardMeta}>
            <View style={[styles.badge, { backgroundColor: meta.color + '22' }]}>
              <Text style={[styles.badgeText, { color: meta.color }]}>
                {meta.emoji} {meta.label}
              </Text>
            </View>
          </View>
          <Text style={styles.cardName}>{routine.name}</Text>
          <Text style={styles.scheduleText}>{routine.schedule}</Text>
        </View>
        {canToggle ? (
          <Switch
            value={routine.enabled}
            onValueChange={onToggle}
            trackColor={{ false: theme.border, true: Colors.accent }}
            thumbColor={Colors.white}
          />
        ) : (
          <View style={{ paddingTop: 4 }}>
            <Text style={styles.readonlyNote}>read-only</Text>
          </View>
        )}
      </View>

      {routine.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>
          {routine.description}
        </Text>
      ) : null}

      <View style={styles.cardFooterRow}>
        <View style={styles.metaChips}>
          {routine.channel && (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>
                {CHANNEL_LABEL[routine.channel] ?? routine.channel}
              </Text>
            </View>
          )}
          {routine.model && (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText} numberOfLines={1}>
                {routine.model.split('/').pop()}
              </Text>
            </View>
          )}
          {routine.trigger && (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{routine.trigger}</Text>
            </View>
          )}
        </View>
        {canDelete && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

export default function AutomationsScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { automations, isLoading, fetch, toggle, remove } = useAutomationsStore();
  const { connectionStatus } = useOpenClawStore();
  const isConnected = connectionStatus === 'connected';

  useEffect(() => {
    if (isConnected) void fetch();
  }, [isConnected]);

  const handleRefresh = useCallback(() => { void fetch(); }, [fetch]);

  const handleDelete = (routine: Routine) => {
    Alert.alert(
      'Delete Hook',
      `Remove "${routine.name}" from OpenClaw? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void remove(routine.id) },
      ],
    );
  };

  if (!isConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notConnected}>
          <Text style={{ fontSize: 40 }}>⚡</Text>
          <Text style={styles.notConnectedText}>
            Connect to your Mac to view all OpenClaw scheduled tasks — heartbeat, hooks, and cron jobs.
          </Text>
          <TouchableOpacity
            style={styles.notConnectedBtn}
            onPress={() => router.push('/(auth)/connect-openclaw')}
            activeOpacity={0.8}
          >
            <Text style={styles.notConnectedBtnText}>Connect to Mac</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const hooks = automations.filter((a) => a.type === 'hook');
  const hookCount = hooks.filter((a) => a.enabled).length;

  return (
    <SafeAreaView style={styles.container}>
      {automations.length > 0 && (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>
            ⚡ {automations.length} routine{automations.length !== 1 ? 's' : ''} from OpenClaw
          </Text>
          <Text style={styles.infoText}>
            {hookCount} active hook{hookCount !== 1 ? 's' : ''} · heartbeat · cron jobs
          </Text>
        </View>
      )}

      <FlatList
        data={automations}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
        ListHeaderComponent={
          automations.length > 0 ? (
            <Text style={styles.sectionLabel}>ALL ROUTINES</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <RoutineCard
            routine={item}
            onToggle={(enabled) => void toggle(item.id, enabled)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🪝</Text>
              <Text style={styles.emptyTitle}>No routines found</Text>
              <Text style={styles.emptySubtitle}>
                OpenClaw schedules appear here — heartbeat, webhook hooks, and cron jobs from your workspace.
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <ActivityIndicator color={Colors.accent} size="large" />
            </View>
          )
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(auth)/(drawer)/automations/create' as any)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>＋  New Hook</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
