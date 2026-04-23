import { useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors, GoalStatus } from '@lyfestack/shared';
import type { Goal } from '@lyfestack/shared';
import { useGoalsStore } from '../../../../stores/goals.store';

function statusColor(status: GoalStatus) {
  switch (status) {
    case GoalStatus.ACTIVE: return Colors.success;
    case GoalStatus.PAUSED: return Colors.warning;
    case GoalStatus.COMPLETED: return Colors.accent;
    default: return Colors.gray400;
  }
}

function statusLabel(status: GoalStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    statsRow: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      alignItems: 'center',
      gap: 4,
    },
    statValue: { ...TextStyles.h3, color: Colors.accent },
    statLabel: { ...TextStyles.caption, color: theme.text.secondary, textAlign: 'center' },
    listContent: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
    sectionLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.sm,
      marginTop: Spacing.sm,
    },
    goalCard: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    goalCardHeader: { gap: 6 },
    goalTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    goalTitle: { ...TextStyles.h4, color: theme.text.primary, flex: 1 },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: BorderRadius.full,
    },
    statusPillText: { ...TextStyles.caption, fontWeight: '700' },
    goalDesc: { ...TextStyles.small, color: theme.text.secondary, lineHeight: 20 },
    progressSection: { gap: Spacing.sm },
    progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
    progressLabel: { ...TextStyles.caption, color: theme.text.secondary },
    progressValue: { ...TextStyles.caption, color: Colors.accent, fontWeight: '700' },
    progressTrack: {
      height: 6,
      backgroundColor: theme.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: Colors.accent,
      borderRadius: 3,
    },
    goalMeta: { flexDirection: 'row', justifyContent: 'space-between' },
    goalMetaText: { ...TextStyles.caption, color: theme.text.secondary },
    fab: {
      position: 'absolute',
      bottom: Spacing.xl,
      right: Spacing.xl,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: Colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: Colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 8,
    },
    fabIcon: { fontSize: 28, color: Colors.white, lineHeight: 32 },
    emptyState: {
      alignItems: 'center',
      paddingTop: 60,
      gap: Spacing.md,
      paddingHorizontal: Spacing.xl,
    },
    emptyIcon: { fontSize: 48 },
    emptyTitle: { ...TextStyles.h3, color: theme.text.primary },
    emptySubtitle: { ...TextStyles.body, color: theme.text.secondary, textAlign: 'center' },
    emptyBtn: {
      marginTop: Spacing.sm,
      backgroundColor: Colors.accent,
      paddingHorizontal: Spacing.xl,
      paddingVertical: 12,
      borderRadius: BorderRadius.full,
    },
    emptyBtnText: { ...TextStyles.bodyMedium, color: Colors.white },
  });
}

function GoalCard({ goal }: { goal: Goal }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const completedMilestones = goal.milestones.filter((m) => m.completedAt).length;
  const totalMilestones = goal.milestones.length;
  const color = statusColor(goal.status);

  return (
    <TouchableOpacity
      style={styles.goalCard}
      onPress={() => router.push(`/(auth)/(drawer)/goals/${goal.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.goalCardHeader}>
        <View style={styles.goalTitleRow}>
          <Text style={styles.goalTitle} numberOfLines={1}>{goal.title}</Text>
          <View style={[styles.statusPill, { backgroundColor: color + '20' }]}>
            <Text style={[styles.statusPillText, { color }]}>{statusLabel(goal.status)}</Text>
          </View>
        </View>
        <Text style={styles.goalDesc} numberOfLines={2}>{goal.description}</Text>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressValue}>{goal.progressScore}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${goal.progressScore}%` }]} />
        </View>
      </View>

      <View style={styles.goalMeta}>
        <Text style={styles.goalMetaText}>
          {completedMilestones}/{totalMilestones} milestones
        </Text>
        {goal.targetDate && (
          <Text style={styles.goalMetaText}>
            Due {new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

type ListItem =
  | { type: 'stats' }
  | { type: 'section'; label: string }
  | { type: 'goal'; goal: Goal }
  | { type: 'empty' };

export default function GoalsScreen() {
  const { goals, isLoading, fetchGoals } = useGoalsStore();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const activeGoals = goals.filter((g) => g.status === GoalStatus.ACTIVE);
  const pausedGoals = goals.filter((g) => g.status === GoalStatus.PAUSED);
  const completedGoals = goals.filter((g) => g.status === GoalStatus.COMPLETED);

  useEffect(() => { void fetchGoals(); }, []);

  const handleRefresh = useCallback(() => { void fetchGoals(); }, [fetchGoals]);

  const items: ListItem[] = [
    { type: 'stats' },
  ];

  if (activeGoals.length > 0) {
    items.push({ type: 'section', label: 'ACTIVE' });
    activeGoals.forEach((g) => items.push({ type: 'goal', goal: g }));
  }
  if (pausedGoals.length > 0) {
    items.push({ type: 'section', label: 'PAUSED' });
    pausedGoals.forEach((g) => items.push({ type: 'goal', goal: g }));
  }
  if (completedGoals.length > 0) {
    items.push({ type: 'section', label: 'COMPLETED' });
    completedGoals.forEach((g) => items.push({ type: 'goal', goal: g }));
  }
  if (goals.length === 0 && !isLoading) {
    items.push({ type: 'empty' });
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item, i) =>
          item.type === 'goal' ? item.goal.id : `${item.type}-${i}`
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
        renderItem={({ item }) => {
          if (item.type === 'stats') {
            return (
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{activeGoals.length}</Text>
                  <Text style={styles.statLabel}>Active</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {Math.round(
                      activeGoals.reduce((s, g) => s + g.progressScore, 0) /
                        Math.max(activeGoals.length, 1),
                    )}%
                  </Text>
                  <Text style={styles.statLabel}>Avg Progress</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {activeGoals.reduce(
                      (s, g) => s + g.milestones.filter((m) => m.completedAt).length,
                      0,
                    )}
                  </Text>
                  <Text style={styles.statLabel}>Milestones Hit</Text>
                </View>
              </View>
            );
          }
          if (item.type === 'section') {
            return <Text style={styles.sectionLabel}>{item.label}</Text>;
          }
          if (item.type === 'goal') {
            return <GoalCard goal={item.goal} />;
          }
          if (item.type === 'empty') {
            return (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🎯</Text>
                <Text style={styles.emptyTitle}>No goals yet</Text>
                <Text style={styles.emptySubtitle}>
                  Add your first goal and let AI build a personalised plan for you.
                </Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push('/goal-setup')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyBtnText}>Create first goal</Text>
                </TouchableOpacity>
              </View>
            );
          }
          return null;
        }}
      />

      {goals.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/goal-setup')}
          activeOpacity={0.85}
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
