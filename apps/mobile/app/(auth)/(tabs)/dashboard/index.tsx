import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DarkTheme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors, ApprovalState, TaskType } from '@lyfestack/shared';
import { useBriefsStore } from '../../../../stores/briefs.store';
import { useAuthStore } from '../../../../stores/auth.store';
import { Card, Badge, ProgressRing } from '../../../../components/ui';
import type { MockTask } from '../../../../utils/mockData';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - Spacing.xl * 2;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function taskTypeBadge(type: TaskType): { label: string; variant: 'primary' | 'success' | 'warning' | 'neutral' } {
  switch (type) {
    case TaskType.HABIT: return { label: 'Habit', variant: 'success' };
    case TaskType.ACTION: return { label: 'Action', variant: 'primary' };
    case TaskType.MILESTONE: return { label: 'Milestone', variant: 'warning' };
    default: return { label: type, variant: 'neutral' };
  }
}

function confidenceColor(score: number) {
  if (score >= 85) return Colors.success;
  if (score >= 65) return Colors.warning;
  return Colors.error;
}

interface TaskCardProps {
  task: MockTask;
}

function TaskCard({ task }: TaskCardProps) {
  const badge = taskTypeBadge(task.type);
  const isPending = task.approvalState === ApprovalState.PENDING;

  return (
    <Card style={[styles.taskCard, { width: CARD_WIDTH }]} elevated>
      <View style={styles.taskCardHeader}>
        <Badge label={badge.label} variant={badge.variant} />
        <View style={styles.confidenceRow}>
          <Text style={styles.confidenceLabel}>AI confidence</Text>
          <Text style={[styles.confidenceScore, { color: confidenceColor(task.confidence) }]}>
            {task.confidence}%
          </Text>
        </View>
      </View>

      <Text style={styles.taskTitle}>{task.title}</Text>
      <Text style={styles.taskDesc} numberOfLines={2}>{task.description}</Text>

      {task.durationMinutes && (
        <Text style={styles.taskMeta}>⏱ {task.durationMinutes} min</Text>
      )}

      {isPending ? (
        <View style={styles.taskActions}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionApprove]} activeOpacity={0.8}>
            <Text style={styles.actionApproveText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionDefer]} activeOpacity={0.8}>
            <Text style={styles.actionDeferText}>Defer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionComplete]} activeOpacity={0.8}>
            <Text style={styles.actionCompleteText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.taskActions}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionComplete, { flex: 1 }]} activeOpacity={0.8}>
            <Text style={styles.actionCompleteText}>Mark Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionDefer]} activeOpacity={0.8}>
            <Text style={styles.actionDeferText}>Defer</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const { brief, streak, completionRate } = useBriefsStore();
  const today = new Date();

  const automations = brief?.insights ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>{getGreeting()}, {user?.displayName ?? 'there'} 👋</Text>
            <Text style={styles.date}>{formatDate(today)}</Text>
          </View>
        </View>

        {/* Momentum Ring */}
        <View style={styles.momentumSection}>
          <View style={styles.momentumCard}>
            <ProgressRing progress={completionRate} size={96} strokeWidth={8} color={Colors.accent}>
              <Text style={styles.ringPercent}>{Math.round(completionRate * 100)}%</Text>
            </ProgressRing>
            <View style={styles.momentumInfo}>
              <Text style={styles.momentumTitle}>Weekly Momentum</Text>
              <Text style={styles.momentumSubtitle}>
                {Math.round(completionRate * 100)}% of tasks completed
              </Text>
              <View style={styles.streakRow}>
                <Text style={styles.streakFire}>🔥</Text>
                <Text style={styles.streakText}>{streak}-day streak</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Daily Brief Summary */}
        {brief?.summary && (
          <View style={styles.briefSummary}>
            <Text style={styles.sectionLabel}>DAILY BRIEF</Text>
            <Text style={styles.briefText}>{brief.summary}</Text>
          </View>
        )}

        {/* Task Cards — horizontal scroll */}
        <View style={styles.tasksSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>TODAY'S FOCUS</Text>
            <Text style={styles.taskCount}>{brief?.tasks.length ?? 0} tasks</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            contentContainerStyle={styles.taskScroll}
            snapToInterval={CARD_WIDTH + Spacing.md}
            decelerationRate="fast"
          >
            {(brief?.tasks as MockTask[] | undefined)?.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </ScrollView>
          <Text style={styles.scrollHint}>← swipe to see all tasks →</Text>
        </View>

        {/* Automations */}
        <View style={styles.automationsSection}>
          <Text style={styles.sectionLabel}>INSIGHTS & AUTOMATIONS</Text>
          {automations.map((insight, i) => (
            <TouchableOpacity key={i} style={styles.automationRow} activeOpacity={0.7}>
              <View style={styles.automationDot} />
              <Text style={styles.automationText}>{insight}</Text>
              <Text style={styles.automationArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Powered by Lyfestack • {streak}-day streak 🔥</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DarkTheme.background },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerText: { gap: 4 },
  greeting: { ...TextStyles.h3, color: DarkTheme.text.primary },
  date: { ...TextStyles.small, color: DarkTheme.text.secondary },
  momentumSection: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg },
  momentumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    padding: Spacing.md,
  },
  momentumInfo: { flex: 1, gap: 4 },
  momentumTitle: { ...TextStyles.h4, color: DarkTheme.text.primary },
  momentumSubtitle: { ...TextStyles.small, color: DarkTheme.text.secondary },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  streakFire: { fontSize: 16 },
  streakText: { ...TextStyles.bodyMedium, color: Colors.warning },
  ringPercent: { ...TextStyles.small, color: DarkTheme.text.primary, fontWeight: '700' },
  briefSummary: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  briefText: {
    ...TextStyles.body,
    color: DarkTheme.text.secondary,
    lineHeight: 26,
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
  },
  tasksSection: { marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    ...TextStyles.caption,
    color: DarkTheme.text.secondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  taskCount: { ...TextStyles.caption, color: Colors.accent },
  taskScroll: { paddingHorizontal: Spacing.xl, gap: Spacing.md },
  taskCard: { flexShrink: 0, gap: Spacing.sm },
  taskCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confidenceLabel: { ...TextStyles.caption, color: DarkTheme.text.secondary },
  confidenceScore: { ...TextStyles.caption, fontWeight: '700' },
  taskTitle: { ...TextStyles.h4, color: DarkTheme.text.primary },
  taskDesc: { ...TextStyles.small, color: DarkTheme.text.secondary, lineHeight: 20 },
  taskMeta: { ...TextStyles.caption, color: DarkTheme.text.secondary },
  taskActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionApprove: { backgroundColor: Colors.accent, flex: 1 },
  actionDefer: { backgroundColor: DarkTheme.border },
  actionComplete: { backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: Colors.success },
  actionApproveText: { ...TextStyles.small, color: Colors.white, fontWeight: '600' },
  actionDeferText: { ...TextStyles.small, color: DarkTheme.text.secondary },
  actionCompleteText: { ...TextStyles.small, color: Colors.success, fontWeight: '600' },
  scrollHint: {
    ...TextStyles.caption,
    color: DarkTheme.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    opacity: 0.6,
  },
  automationsSection: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg, gap: Spacing.sm },
  automationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
  },
  automationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    flexShrink: 0,
  },
  automationText: { ...TextStyles.small, color: DarkTheme.text.primary, flex: 1, lineHeight: 20 },
  automationArrow: { ...TextStyles.bodyMedium, color: DarkTheme.text.secondary },
  footer: { padding: Spacing.xl, alignItems: 'center' },
  footerText: { ...TextStyles.caption, color: DarkTheme.text.secondary, opacity: 0.6 },
});
