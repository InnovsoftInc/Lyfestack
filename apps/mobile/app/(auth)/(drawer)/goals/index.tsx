import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      padding: Spacing.xl,
      paddingBottom: Spacing.md,
    },
    heading: { ...TextStyles.h1, color: theme.text.primary },
    subheading: { ...TextStyles.small, color: theme.text.secondary, marginTop: 2 },
    scroll: { flex: 1 },
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
    goalsList: { paddingHorizontal: Spacing.xl, gap: Spacing.md },
    sectionLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.sm,
    },
    goalCard: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      gap: Spacing.md,
    },
    goalCardHeader: { gap: 6 },
    goalTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    goalTitle: { ...TextStyles.h4, color: theme.text.primary, flex: 1 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
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
    spacer: { height: 100 },
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

interface GoalCardProps {
  goal: Goal;
}

function GoalCard({ goal }: GoalCardProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const completedMilestones = goal.milestones.filter((m) => m.completedAt).length;
  const totalMilestones = goal.milestones.length;

  return (
    <TouchableOpacity
      style={styles.goalCard}
      onPress={() => router.push(`/(auth)/(drawer)/goals/${goal.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.goalCardHeader}>
        <View style={styles.goalTitleRow}>
          <Text style={styles.goalTitle} numberOfLines={1}>{goal.title}</Text>
          <View style={[styles.statusDot, { backgroundColor: statusColor(goal.status) }]} />
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

export default function GoalsScreen() {
  const { goals } = useGoalsStore();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const activeGoals = goals.filter((g) => g.status === GoalStatus.ACTIVE);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Goals</Text>
          <Text style={styles.subheading}>{activeGoals.length} active</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeGoals.length}</Text>
            <Text style={styles.statLabel}>Active Goals</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {Math.round(activeGoals.reduce((sum, g) => sum + g.progressScore, 0) / Math.max(activeGoals.length, 1))}%
            </Text>
            <Text style={styles.statLabel}>Avg Progress</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {activeGoals.reduce((sum, g) => sum + g.milestones.filter((m) => m.completedAt).length, 0)}
            </Text>
            <Text style={styles.statLabel}>Milestones Hit</Text>
          </View>
        </View>

        <View style={styles.goalsList}>
          <Text style={styles.sectionLabel}>ACTIVE</Text>
          {activeGoals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/onboarding/goals')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
