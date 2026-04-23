import { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, router } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius, Elevation } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { useBriefStore } from '../../../../stores/brief.store';
import { useOpenClawStore } from '../../../../stores/openclaw.store';
import { useAuthStore } from '../../../../stores/auth.store';
import type { BriefTask } from '../../../../services/briefs.api';
import { GlassHeader, headerSpacerHeight } from '../../../../components/ui';

const TASK_TYPE_ICON: Record<string, string> = {
  HABIT: '🔁',
  TASK: '✅',
  REFLECTION: '💭',
  MILESTONE: '🏆',
  RESEARCH: '🔍',
  CONTENT: '✍️',
};

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.lg,
    },
    loadingText: {
      ...TextStyles.body,
      color: theme.text.secondary,
    },
    list: { paddingBottom: Spacing['2xl'] },
    header: {
      padding: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.xs,
    },
    greeting: {
      ...TextStyles.h2,
      color: theme.text.primary,
      flex: 1,
    },
    profileBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: Colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileInitial: { ...TextStyles.bodyMedium, color: Colors.white, fontWeight: '700' },
    summary: {
      ...TextStyles.body,
      color: theme.text.secondary,
      marginBottom: Spacing.md,
    },
    streakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.sm,
      borderWidth: 1,
      borderColor: theme.border,
      alignSelf: 'flex-start',
    },
    streakText: {
      ...TextStyles.small,
      color: theme.text.secondary,
      fontWeight: '600',
    },
    streakCount: {
      ...TextStyles.bodyMedium,
      color: Colors.accent,
      fontWeight: '700',
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    progressBar: {
      flex: 1,
      height: 6,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: Colors.accent,
      borderRadius: BorderRadius.full,
    },
    progressLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      minWidth: 60,
      textAlign: 'right',
    },
    insightsBox: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      gap: Spacing.xs,
      borderWidth: 1,
      borderColor: theme.border,
    },
    insightText: {
      ...TextStyles.small,
      color: theme.text.secondary,
      lineHeight: 20,
    },
    sectionLabel: {
      ...TextStyles.bodyMedium,
      color: theme.text.secondary,
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    taskCard: {
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    taskCardDone: { opacity: 0.5 },
    taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    taskIcon: { fontSize: 20, marginTop: 2, width: 28 },
    taskBody: { flex: 1 },
    taskTitle: { ...TextStyles.bodyMedium, color: theme.text.primary, marginBottom: 2 },
    taskTitleDone: { textDecorationLine: 'line-through', color: theme.text.secondary },
    taskDesc: { ...TextStyles.small, color: theme.text.secondary, marginBottom: Spacing.xs },
    taskMeta: { flexDirection: 'row', gap: Spacing.xs },
    metaChip: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      backgroundColor: theme.background,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    doneButton: {
      backgroundColor: Colors.accent,
      paddingVertical: 6,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.sm,
      alignSelf: 'flex-start',
    },
    doneButtonText: {
      ...TextStyles.caption,
      color: Colors.white,
      fontWeight: '600',
    },
    completedBadge: {
      width: 28,
      height: 28,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.success,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'flex-start',
    },
    completedText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
    emptyTasks: {
      alignItems: 'center',
      padding: Spacing.xl,
      gap: Spacing.sm,
    },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { ...TextStyles.h3, color: theme.text.primary },
    emptySubtitle: { ...TextStyles.body, color: theme.text.secondary, textAlign: 'center' },
    emptyAction: {
      marginTop: Spacing.sm,
      backgroundColor: Colors.accent,
      paddingHorizontal: Spacing.xl,
      paddingVertical: 12,
      borderRadius: BorderRadius.full,
    },
    emptyActionText: { ...TextStyles.bodyMedium, color: Colors.white },
    retryButton: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    retryText: { ...TextStyles.button, color: theme.text.secondary },
    errorText: { ...TextStyles.body, color: theme.error, textAlign: 'center' },
    connectionBanner: {
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      padding: Spacing.sm,
      borderRadius: BorderRadius.md,
      backgroundColor: Colors.accent + '15',
      borderWidth: 1,
      borderColor: Colors.accent + '44',
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    connectionText: { ...TextStyles.small, color: Colors.accent, flex: 1 },
    agentShortcut: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.xl,
      padding: Spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      ...Elevation.card,
    },
    agentAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: Colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    agentAvatarText: { ...TextStyles.bodyMedium, color: Colors.white, fontWeight: '700' },
    agentShortcutBody: { flex: 1 },
    agentShortcutTitle: { ...TextStyles.bodyMedium, color: theme.text.primary, fontWeight: '600' },
    agentShortcutHint: { ...TextStyles.caption, color: theme.text.secondary, marginTop: 2 },
    agentShortcutIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    agentShortcutIconText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  });
}

function agentInitials(name: string): string {
  const parts = name.replace(/[-_]/g, ' ').split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

function TaskCard({ task, onComplete }: { task: BriefTask; onComplete: (id: string) => void }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const isComplete = task.status === 'COMPLETED' || task.completedAt != null;

  return (
    <View style={[styles.taskCard, isComplete && styles.taskCardDone]}>
      <View style={styles.taskRow}>
        <Text style={styles.taskIcon}>{TASK_TYPE_ICON[task.type] ?? '•'}</Text>
        <View style={styles.taskBody}>
          <Text style={[styles.taskTitle, isComplete && styles.taskTitleDone]} numberOfLines={2}>
            {task.title}
          </Text>
          {task.description ? (
            <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text>
          ) : null}
          <View style={styles.taskMeta}>
            {task.estimatedMinutes ? (
              <Text style={styles.metaChip}>⏱ {task.estimatedMinutes}m</Text>
            ) : null}
            {task.priority != null ? (
              <Text style={styles.metaChip}>↑ {task.priority}</Text>
            ) : null}
          </View>
        </View>
        {!isComplete && (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => onComplete(task.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        )}
        {isComplete && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>✓</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const { brief, isLoading, error, fetchTodayBrief, completeTask } = useBriefStore();
  const { agents, connectionStatus } = useOpenClawStore();
  const { user } = useAuthStore();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const primaryAgent = agents[0];
  const initial = (user?.displayName ?? 'U').charAt(0).toUpperCase();

  useEffect(() => {
    void fetchTodayBrief();
  }, [fetchTodayBrief]);

  const handleRefresh = useCallback(() => {
    void fetchTodayBrief();
  }, [fetchTodayBrief]);

  const handleComplete = useCallback(
    (taskId: string) => {
      if (!brief) return;
      void completeTask(brief.id, taskId);
    },
    [brief, completeTask],
  );

  const headerNode = (
    <GlassHeader
      title="Today"
      leftKind="menu"
      onLeftPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      right={
        <TouchableOpacity
          onPress={() => router.push('/(auth)/(drawer)/profile' as any)}
          hitSlop={10}
          activeOpacity={0.8}
        >
          <View style={styles.profileBtn}>
            <Text style={styles.profileInitial}>{initial}</Text>
          </View>
        </TouchableOpacity>
      }
    />
  );

  if (isLoading && !brief) {
    return (
      <View style={styles.container}>
        {headerNode}
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading your brief...</Text>
        </View>
      </View>
    );
  }

  if (error && !brief) {
    return (
      <View style={styles.container}>
        {headerNode}
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const completedCount = brief?.tasks.filter(
    (t) => t.status === 'COMPLETED' || t.completedAt != null,
  ).length ?? 0;
  const totalCount = brief?.tasks.length ?? 0;
  const allDone = totalCount > 0 && completedCount === totalCount;

  return (
    <View style={styles.container}>
      {headerNode}
      <FlatList
        data={brief?.tasks ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={[styles.list, { paddingTop: headerSpacerHeight(insets.top) + Spacing.sm }]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
            progressViewOffset={headerSpacerHeight(insets.top)}
          />
        }
        ListHeaderComponent={
          <>
            {/* OpenClaw connection nudge */}
            {connectionStatus !== 'connected' && agents.length === 0 && (
              <TouchableOpacity
                style={styles.connectionBanner}
                onPress={() => router.push('/(auth)/connect-openclaw')}
                activeOpacity={0.8}
              >
                <Text style={styles.connectionText}>
                  Connect to your Mac to enable AI agents ›
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.header}>
              <View style={styles.headerTop}>
                <Text style={styles.greeting} numberOfLines={1}>
                  {brief?.greeting ?? `Good morning${user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}`}
                </Text>
              </View>
              <Text style={styles.summary}>{brief?.summary ?? 'Pull down to load your brief.'}</Text>
            </View>

            {primaryAgent ? (
              <TouchableOpacity
                style={styles.agentShortcut}
                activeOpacity={0.7}
                onPress={() => router.push(`/(auth)/(drawer)/agents/${primaryAgent.name}/chat` as any)}
              >
                <View style={styles.agentAvatar}>
                  <Text style={styles.agentAvatarText}>{agentInitials(primaryAgent.name)}</Text>
                </View>
                <View style={styles.agentShortcutBody}>
                  <Text style={styles.agentShortcutTitle}>Chat with {primaryAgent.name}</Text>
                  <Text style={styles.agentShortcutHint} numberOfLines={1}>
                    {primaryAgent.role || 'Your primary agent'}
                  </Text>
                </View>
                <View style={styles.agentShortcutIcon}>
                  <Text style={styles.agentShortcutIconText}>›</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            <View style={styles.header}>
              {totalCount > 0 && (
                <View style={styles.progressRow}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${(completedCount / totalCount) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressLabel}>
                    {completedCount}/{totalCount} done
                  </Text>
                </View>
              )}

              {brief?.insights && brief.insights.length > 0 && (
                <View style={styles.insightsBox}>
                  {brief.insights.map((insight, i) => (
                    <Text key={i} style={styles.insightText}>💡 {insight}</Text>
                  ))}
                </View>
              )}

              {totalCount > 0 && (
                <Text style={styles.sectionLabel}>Today's Tasks</Text>
              )}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <TaskCard task={item} onComplete={handleComplete} />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyTasks}>
              <Text style={styles.emptyEmoji}>{allDone ? '🎉' : '✨'}</Text>
              <Text style={styles.emptyTitle}>{allDone ? 'All done!' : 'Clear day'}</Text>
              <Text style={styles.emptySubtitle}>
                {allDone
                  ? 'Every task is complete. Great work today.'
                  : 'No tasks scheduled. Add a goal to get started.'}
              </Text>
              {!allDone && (
                <TouchableOpacity
                  style={styles.emptyAction}
                  onPress={() => router.push('/goal-setup')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyActionText}>Add a goal</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
      />
    </View>
  );
}
