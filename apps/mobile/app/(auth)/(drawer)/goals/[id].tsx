import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { useGoalsStore } from '../../../../stores/goals.store';
import { useBriefsStore } from '../../../../stores/briefs.store';
import { Badge } from '../../../../components/ui';
import type { Task } from '@lyfestack/shared';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
    notFoundText: { ...TextStyles.body, color: theme.text.secondary },
    backLink: { ...TextStyles.bodyMedium, color: Colors.accent },
    header: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    backBtn: { padding: Spacing.xs, alignSelf: 'flex-start' },
    backText: { ...TextStyles.bodyMedium, color: theme.text.secondary },
    scroll: { flex: 1 },
    hero: {
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.xl,
      gap: Spacing.md,
    },
    title: { ...TextStyles.h2, color: theme.text.primary },
    desc: { ...TextStyles.body, color: theme.text.secondary, lineHeight: 26 },
    progressSection: { gap: Spacing.sm },
    progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
    progressLabel: { ...TextStyles.small, color: theme.text.secondary },
    progressValue: { ...TextStyles.small, color: Colors.accent, fontWeight: '700' },
    progressTrack: {
      height: 8,
      backgroundColor: theme.surface,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 4 },
    metaRow: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    metaItem: {
      flex: 1,
      padding: Spacing.md,
      alignItems: 'center',
      gap: 4,
      borderRightWidth: 1,
      borderRightColor: theme.border,
    },
    metaValue: { ...TextStyles.h4, color: theme.text.primary },
    metaLabel: { ...TextStyles.caption, color: theme.text.secondary },
    section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
    sectionLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.md,
    },
    timelineItem: { flexDirection: 'row', gap: Spacing.md },
    timelineLeft: { alignItems: 'center', width: 16 },
    timelineDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: theme.surface,
      borderWidth: 2,
      borderColor: theme.border,
      marginTop: 3,
    },
    timelineDotDone: { borderColor: Colors.accent, backgroundColor: Colors.accent },
    timelineLine: { width: 2, flex: 1, backgroundColor: theme.border, marginVertical: 4 },
    timelineLineDone: { backgroundColor: Colors.accent },
    timelineContent: { flex: 1, paddingBottom: Spacing.lg },
    milestoneHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    milestoneTitle: { ...TextStyles.bodyMedium, color: theme.text.primary, flex: 1 },
    milestoneTitleDone: { color: theme.text.secondary, textDecorationLine: 'line-through' },
    checkmark: { color: Colors.accent, fontSize: 16, fontWeight: 'bold' },
    milestoneDue: { ...TextStyles.caption, color: theme.text.secondary, marginTop: 2 },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      gap: Spacing.md,
    },
    taskRowLeft: { flex: 1, gap: 6 },
    taskTitle: { ...TextStyles.small, color: theme.text.primary },
    taskConfidence: { ...TextStyles.small, color: Colors.accent, fontWeight: '700' },
    chartPlaceholder: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      gap: Spacing.md,
    },
    chartLabel: { ...TextStyles.caption, color: theme.text.secondary },
    chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 8 },
    chartBarWrapper: { flex: 1, justifyContent: 'flex-end' },
    chartBar: {
      backgroundColor: Colors.accent,
      borderRadius: 3,
      opacity: 0.7,
      width: '100%',
    },
    chartDayLabels: { flexDirection: 'row', gap: 8 },
    chartDayLabel: { ...TextStyles.caption, color: theme.text.secondary, flex: 1, textAlign: 'center' },
    spacer: { height: 40 },
  });
}

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { goals } = useGoalsStore();
  const { brief } = useBriefsStore();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const goal = goals.find((g) => g.id === id);

  if (!goal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Goal not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const goalTasks = (brief?.tasks as Task[] | undefined)?.filter((t) => t.goalId === id) ?? [];

  const completedMilestones = goal.milestones.filter((m) => m.completedAt).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Goals</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.title}>{goal.title}</Text>
          <Text style={styles.desc}>{goal.description}</Text>

          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Overall Progress</Text>
              <Text style={styles.progressValue}>{goal.progressScore}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${goal.progressScore}%` }]} />
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>{completedMilestones}/{goal.milestones.length}</Text>
              <Text style={styles.metaLabel}>Milestones</Text>
            </View>
            {goal.targetDate && (
              <View style={styles.metaItem}>
                <Text style={styles.metaValue}>
                  {new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <Text style={styles.metaLabel}>Target Date</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Text style={[styles.metaValue, { color: Colors.success }]}>Active</Text>
              <Text style={styles.metaLabel}>Status</Text>
            </View>
          </View>
        </View>

        {/* Milestone Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MILESTONES</Text>
          {goal.milestones.map((milestone, i) => {
            const isComplete = !!milestone.completedAt;
            return (
              <View key={milestone.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, isComplete && styles.timelineDotDone]} />
                  {i < goal.milestones.length - 1 && (
                    <View style={[styles.timelineLine, isComplete && styles.timelineLineDone]} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.milestoneHeader}>
                    <Text style={[styles.milestoneTitle, isComplete && styles.milestoneTitleDone]}>
                      {milestone.title}
                    </Text>
                    {isComplete && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  {milestone.dueDate && (
                    <Text style={styles.milestoneDue}>
                      {isComplete ? 'Completed' : 'Due'}{' '}
                      {new Date(isComplete ? milestone.completedAt! : milestone.dueDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Today's Tasks for this Goal */}
        {goalTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TODAY'S TASKS</Text>
            {goalTasks.map((task) => (
              <View key={task.id} style={styles.taskRow}>
                <View style={styles.taskRowLeft}>
                  <Badge
                    label={task.type.toLowerCase()}
                    variant={task.type === 'ACTION' ? 'primary' : 'success'}
                  />
                  <Text style={styles.taskTitle}>{task.title}</Text>
                </View>
                <Text style={styles.taskConfidence}>{task.confidence}%</Text>
              </View>
            ))}
          </View>
        )}

        {/* Leading Indicators (mock chart placeholder) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEADING INDICATORS</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartLabel}>Weekly progress chart</Text>
            <View style={styles.chartBars}>
              {[40, 55, 48, 62, 58, 70, 65].map((h, i) => (
                <View key={i} style={styles.chartBarWrapper}>
                  <View style={[styles.chartBar, { height: h }]} />
                </View>
              ))}
            </View>
            <View style={styles.chartDayLabels}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <Text key={i} style={styles.chartDayLabel}>{d}</Text>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
