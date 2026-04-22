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
import { SafeAreaView } from 'react-native-safe-area-context';
import { DarkTheme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { useBriefStore } from '../../../../stores/brief.store';
import type { BriefTask } from '../../../../services/briefs.api';

const TASK_TYPE_ICON: Record<string, string> = {
  HABIT: '🔁',
  TASK: '✅',
  REFLECTION: '💭',
  MILESTONE: '🏆',
  RESEARCH: '🔍',
  CONTENT: '✍️',
};

function TaskCard({
  task,
  onComplete,
}: {
  task: BriefTask;
  onComplete: (id: string) => void;
}) {
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

  if (isLoading && !brief) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading your brief...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !brief) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const completedCount = brief?.tasks.filter(
    (t) => t.status === 'COMPLETED' || t.completedAt != null,
  ).length ?? 0;
  const totalCount = brief?.tasks.length ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={brief?.tasks ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.greeting}>{brief?.greeting ?? 'Good morning'}</Text>
            <Text style={styles.summary}>{brief?.summary ?? 'Pull down to load your brief.'}</Text>

            {totalCount > 0 && (
              <View style={styles.progressRow}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` },
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
                  <Text key={i} style={styles.insightText}>
                    💡 {insight}
                  </Text>
                ))}
              </View>
            )}

            {totalCount > 0 && (
              <Text style={styles.sectionLabel}>Today's Tasks</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TaskCard task={item} onComplete={handleComplete} />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyTasks}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyTitle}>All clear!</Text>
              <Text style={styles.emptySubtitle}>No tasks scheduled today.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DarkTheme.background },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  loadingText: {
    ...TextStyles.body,
    color: DarkTheme.text.secondary,
    lineHeight: 26,
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
  },
  list: {
    paddingBottom: Spacing['2xl'],
  },
  header: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  greeting: {
    ...TextStyles.h2,
    color: DarkTheme.text.primary,
    marginBottom: Spacing.xs,
  },
  summary: {
    ...TextStyles.body,
    color: DarkTheme.text.secondary,
    marginBottom: Spacing.md,
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
    backgroundColor: DarkTheme.surface,
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
    color: DarkTheme.text.secondary,
    minWidth: 60,
    textAlign: 'right',
  },
  insightsBox: {
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  insightText: {
    ...TextStyles.small,
    color: DarkTheme.text.secondary,
    lineHeight: 20,
  },
  sectionLabel: {
    ...TextStyles.bodyMedium,
    color: DarkTheme.text.secondary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  taskCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
  },
  taskCardDone: {
    opacity: 0.5,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  taskIcon: {
    fontSize: 20,
    marginTop: 2,
    width: 28,
  },
  taskBody: {
    flex: 1,
  },
  taskTitle: {
    ...TextStyles.bodyMedium,
    color: DarkTheme.text.primary,
    marginBottom: 2,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: DarkTheme.text.secondary,
  },
  taskDesc: {
    ...TextStyles.small,
    color: DarkTheme.text.secondary,
    marginBottom: Spacing.xs,
  },
  taskMeta: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  metaChip: {
    ...TextStyles.caption,
    color: DarkTheme.text.secondary,
    backgroundColor: DarkTheme.background,
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
    backgroundColor: DarkTheme.success,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  completedText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyTasks: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    ...TextStyles.h3,
    color: DarkTheme.text.primary,
  },
  emptySubtitle: {
    ...TextStyles.body,
    color: DarkTheme.text.secondary,
  },
  retryButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
  },
  retryText: {
    ...TextStyles.button,
    color: DarkTheme.text.secondary,
  },
  errorText: {
    ...TextStyles.body,
    color: DarkTheme.error,
    textAlign: 'center',
  },
});
