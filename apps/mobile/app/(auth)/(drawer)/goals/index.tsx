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
    errorText: { ...TextStyles.body, color: theme.error, textAlign: 'center' },
    retryButton: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    retryText: { ...TextStyles.button, color: theme.text.secondary },
    list: { paddingBottom: 100 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      padding: Spacing.xl,
      paddingBottom: Spacing.md,
    },
    heading: { ...TextStyles.h1, color: theme.text.primary },
    subheading: { ...TextStyles.small, color: theme.text.secondary, marginTop: 2 },
    statsRow: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.xl,
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
    sectionLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.sm,
      marginHorizontal: Spacing.xl,
    },
    goalCard: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      gap: Spacing.md,
      marginHorizontal: Spacing.xl,
      marginBottom: Spacing.md,
    },
    goalTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    goalTitle: { ...TextStyles.h4, color: theme.text.primary, flex: 1 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    goalDesc: { ...TextStyles.small, color: theme.text.secondary, lineHeight: 20 },
    progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
    progressLabel: { ...TextStyles.caption, color: theme.text.secondary },
    progressValue: { ...TextStyles.caption, color: Colors.accent, fontWeight: '700' },
    progressTrack: {
      height: 6,
      backgroundColor: theme.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 3 },
    goalMeta: { flexDirection: 'row', justifyContent: 'space-between' },
    goalMetaText: { ...TextStyles.caption, color: theme.text.secondary },
    emptyState: {
      alignItems: 'center',
      padding: Spacing['2xl'],
      gap: Spacing.md,
    },
    emptyIcon: { fontSize: 48 },
    emptyTitle: { ...TextStyles.h3, color: theme.text.primary },
    emptySubtitle: { ...TextStyles.body, color: theme.text.secondary, textAlign: 'center' },
    emptyButton: {
      backgroundColor: Colors.accent,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.xl,
      borderRadius: BorderRadius.md,
    },
    emptyButtonText: { ...TextStyles.button, color: Colors.white },
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
    fabIcon: { fontSize: 28, color: Colors.white, lineHeight: 32, fontWeight: '400' },
  });
}

function GoalCard({ goal }: { goal: Goal }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const completedMilestones = goal.milestones.filter((m) => m.completedAt).length;

  return (
    <TouchableOpacity
      style={styles.goalCard}
      onPress={() => router.push(`/(auth)/(drawer)/goals/${goal.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.goalTitleRow}>
        <Text style={styles.goalTitle} numberOfLines={1}>{goal.title}</Text>
        <View style={[styles.statusDot, { backgroundColor: statusColor(goal.status) }]} />
      </View>
      <Text style={styles.goalDesc} numberOfLines={2}>{goal.description}</Text>

      <View>
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
          {completedMilestones}/{goal.milestones.length} milestones
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
  | { kind: 'stats'; key: string }
  | { kind: 'sectionLabel'; key: string }
  | { kind: 'goal'; goal: Goal; key: string }
  | { kind: 'empty'; key: string };

export default function GoalsScreen() {
  const { goals, isLoading, error, fetchGoals } = useGoalsStore();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const activeGoals = goals.filter((g) => g.status === GoalStatus.ACTIVE);

  useEffect(() => {
    void fetchGoals();
  }, [fetchGoals]);

  const handleRefresh = useCallback(() => {
    void fetchGoals();
  }, [fetchGoals]);

  if (isLoading && goals.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error && goals.length === 0) {
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

  const items: ListItem[] = [
    { kind: 'stats', key: 'stats' },
    { kind: 'sectionLabel', key: 'label-active' },
  ];

  if (activeGoals.length === 0) {
    items.push({ kind: 'empty', key: 'empty' });
  } else {
    activeGoals.forEach((g) => items.push({ kind: 'goal', goal: g, key: g.id }));
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Goals</Text>
          <Text style={styles.subheading}>{activeGoals.length} active</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
        renderItem={({ item }) => {
          if (item.kind === 'stats') {
            return (
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{activeGoals.length}</Text>
                  <Text style={styles.statLabel}>Active Goals</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {Math.round(
                      activeGoals.reduce((sum, g) => sum + g.progressScore, 0) /
                        Math.max(activeGoals.length, 1),
                    )}%
                  </Text>
                  <Text style={styles.statLabel}>Avg Progress</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {activeGoals.reduce(
                      (sum, g) => sum + g.milestones.filter((m) => m.completedAt).length,
                      0,
                    )}
                  </Text>
                  <Text style={styles.statLabel}>Milestones Hit</Text>
                </View>
              </View>
            );
          }
          if (item.kind === 'sectionLabel') {
            return <Text style={styles.sectionLabel}>ACTIVE</Text>;
          }
          if (item.kind === 'empty') {
            return (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🎯</Text>
                <Text style={styles.emptyTitle}>No goals yet</Text>
                <Text style={styles.emptySubtitle}>Create your first goal to start tracking progress.</Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => router.push('/goal-setup')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyButtonText}>Create a Goal</Text>
                </TouchableOpacity>
              </View>
            );
          }
          return <GoalCard goal={item.goal} />;
        }}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/goal-setup')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
