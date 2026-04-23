import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Switch, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { useAutomationsStore } from '../../../../stores/automations.store';
import type { Automation } from '../../../../stores/automations.store';
import { useOpenClawStore } from '../../../../stores/openclaw.store';

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
    cardInfo: { flex: 1, gap: 3 },
    cardName: { ...TextStyles.bodyMedium, color: theme.text.primary },
    cardAgent: { ...TextStyles.small, color: Colors.accent },
    cardSchedule: { ...TextStyles.caption, color: theme.text.secondary },
    cardMessage: {
      ...TextStyles.small,
      color: theme.text.secondary,
      lineHeight: 18,
      backgroundColor: theme.background,
      borderRadius: BorderRadius.sm,
      padding: Spacing.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    lastRun: { ...TextStyles.caption, color: theme.text.secondary },
    actionRow: { flexDirection: 'row', gap: Spacing.sm },
    runBtn: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: Colors.accent,
    },
    runBtnText: { ...TextStyles.caption, color: Colors.accent, fontWeight: '600' },
    deleteBtn: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: theme.error,
      backgroundColor: theme.error + '10',
    },
    deleteBtnText: { ...TextStyles.caption, color: theme.error, fontWeight: '600' },
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
    fabDisabled: {
      backgroundColor: theme.surface,
      shadowColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.border,
    },
    fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    fabTextOff: { color: theme.text.secondary },
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

function AutomationCard({
  automation,
  onToggle,
  onDelete,
  onRun,
}: {
  automation: Automation;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  onRun: () => void;
}) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const lastRun = automation.lastRunAt
    ? `Last run ${new Date(automation.lastRunAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
    : 'Never run';

  return (
    <View style={[styles.card, !automation.enabled && styles.cardDisabled]}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{automation.name}</Text>
          <Text style={styles.cardAgent}>🤖 {automation.agentName}</Text>
          <Text style={styles.cardSchedule}>⏰ {automation.scheduleLabel}</Text>
        </View>
        <Switch
          value={automation.enabled}
          onValueChange={onToggle}
          trackColor={{ false: theme.border, true: Colors.accent }}
          thumbColor={Colors.white}
        />
      </View>

      <Text style={styles.cardMessage} numberOfLines={2}>
        "{automation.message}"
      </Text>

      <View style={styles.cardFooter}>
        <Text style={styles.lastRun}>{lastRun}</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.runBtn} onPress={onRun} activeOpacity={0.7}>
            <Text style={styles.runBtnText}>▶ Run now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function AutomationsScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { automations, isLoading, fetch, toggle, remove, runNow } = useAutomationsStore();
  const { connectionStatus } = useOpenClawStore();
  const isConnected = connectionStatus === 'connected';

  useEffect(() => {
    if (isConnected) void fetch();
  }, [isConnected]);

  const handleRefresh = useCallback(() => { void fetch(); }, [fetch]);

  const handleDelete = (automation: Automation) => {
    Alert.alert(
      'Delete Automation',
      `Delete "${automation.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void remove(automation.id) },
      ],
    );
  };

  const handleRun = (automation: Automation) => {
    Alert.alert(
      'Run now',
      `Send "${automation.message}" to ${automation.agentName} immediately?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Run', onPress: () => void runNow(automation.id) },
      ],
    );
  };

  if (!isConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notConnected}>
          <Text style={{ fontSize: 40 }}>⚡</Text>
          <Text style={styles.notConnectedText}>
            Connect to your Mac to create and manage automated agent tasks.
          </Text>
          <TouchableOpacity
            style={styles.notConnectedBtnText}
            onPress={() => router.push('/(auth)/connect-openclaw')}
            activeOpacity={0.8}
          >
            <Text style={styles.notConnectedBtnText}>Connect to Mac</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const enabledCount = automations.filter((a) => a.enabled).length;

  return (
    <SafeAreaView style={styles.container}>
      {automations.length > 0 && (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>
            ⚡ {enabledCount} active automation{enabledCount !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.infoText}>
            Scheduled tasks run automatically and send prompts to your agents.
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
            <Text style={styles.sectionLabel}>YOUR AUTOMATIONS</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <AutomationCard
            automation={item}
            onToggle={(enabled) => void toggle(item.id, enabled)}
            onDelete={() => handleDelete(item)}
            onRun={() => handleRun(item)}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>⚡</Text>
              <Text style={styles.emptyTitle}>No automations yet</Text>
              <Text style={styles.emptySubtitle}>
                Schedule prompts to run automatically — daily standups, content drafts,
                research updates, and more.
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
        <Text style={styles.fabText}>＋  New Automation</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
