import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { useOnboardingStore } from '../../stores/onboarding.store';

interface PlanTemplate {
  title: string;
  summary: string;
  milestones: Array<{ week: string; title: string; description: string }>;
  firstTasks: string[];
}

const PLANS_BY_TEMPLATE: Record<string, PlanTemplate> = {
  productivity: {
    title: 'Your 90-Day Productivity Plan',
    summary: 'A focused plan to help you eliminate distractions, protect deep-work time, and consistently hit your goals.',
    milestones: [
      { week: 'Week 1–2', title: 'Audit & Reset', description: 'Map your current time use, identify your top 3 drains, and set non-negotiable focus blocks.' },
      { week: 'Week 3–6', title: 'Systems On', description: 'Build your weekly review cadence, batch low-value tasks, and start delegating to agents.' },
      { week: 'Week 7–10', title: 'Deep Work Mode', description: 'Protect 2+ hours of daily deep work. Measure output, not hours.' },
      { week: 'Week 11–13', title: 'Accelerate', description: 'Optimize what's working, cut what's not, and push toward your 90-day output target.' },
    ],
    firstTasks: [
      'Complete your first weekly time audit',
      'Set up your top 3 focus metrics',
      'Schedule your first protected deep-work block',
    ],
  },
  'self-improvement': {
    title: 'Your 90-Day Habit Plan',
    summary: 'A step-by-step plan to build the habits that matter — with accountability baked in from day one.',
    milestones: [
      { week: 'Week 1–2', title: 'Start Small', description: 'Begin with a 5-minute version of your habit every day. Consistency beats intensity.' },
      { week: 'Week 3–6', title: 'Build the Chain', description: 'Stack your habit with existing routines. Track your streak and review weekly.' },
      { week: 'Week 7–10', title: 'Level Up', description: 'Increase intensity or duration. Agents will remind and adjust based on your data.' },
      { week: 'Week 11–13', title: 'Lock It In', description: 'Your habit is automatic now. Add a second habit or push your existing one further.' },
    ],
    firstTasks: [
      'Define your minimum viable daily habit',
      'Set your daily reminder time',
      'Log your first check-in',
    ],
  },
  'solo-business': {
    title: 'Your 90-Day Business Launch Plan',
    summary: 'Go from idea to paying clients with a structured plan built around your offer and market.',
    milestones: [
      { week: 'Week 1–2', title: 'Offer Clarity', description: 'Define your service, pricing, and ideal client. Build a one-page pitch.' },
      { week: 'Week 3–6', title: 'First Outreach', description: 'Contact 20 potential clients. Run your first discovery calls. Refine your pitch.' },
      { week: 'Week 7–10', title: 'First Revenue', description: 'Close your first client. Deliver and document your process.' },
      { week: 'Week 11–13', title: 'Scale the System', description: 'Get referrals, raise prices, and let agents handle follow-ups and scheduling.' },
    ],
    firstTasks: [
      'Write your one-paragraph offer statement',
      'List 10 potential first clients',
      'Book your first outreach call',
    ],
  },
  'social-media': {
    title: 'Your 90-Day Content Growth Plan',
    summary: 'Build an audience with consistent, high-quality content — and let agents handle the scheduling.',
    milestones: [
      { week: 'Week 1–2', title: 'Content Foundation', description: 'Define your content pillars, post format, and publishing cadence.' },
      { week: 'Week 3–6', title: 'Consistency Mode', description: 'Post every scheduled day. Agents draft and queue content for your approval.' },
      { week: 'Week 7–10', title: 'Optimize & Engage', description: 'Double down on what's working. Reply to comments. Collaborate with others.' },
      { week: 'Week 11–13', title: 'Compound Growth', description: 'Your audience is growing. Repurpose top content and expand to a second format.' },
    ],
    firstTasks: [
      'Write your first 3 post ideas',
      'Set your weekly publishing schedule',
      'Approve your first agent-drafted post',
    ],
  },
  fitness: {
    title: 'Your 90-Day Fitness Plan',
    summary: 'Build a consistent training routine that fits your life and gets you to your goal.',
    milestones: [
      { week: 'Week 1–2', title: 'Build the Base', description: 'Establish your workout schedule. Focus on form and showing up, not intensity.' },
      { week: 'Week 3–6', title: 'Progressive Load', description: 'Gradually increase difficulty. Track your key metrics each week.' },
      { week: 'Week 7–10', title: 'Peak Phase', description: 'Push toward your target. Your morning routine is locked in by now.' },
      { week: 'Week 11–13', title: 'Finish Strong', description: 'Hit your 90-day goal. Set the next target before momentum fades.' },
    ],
    firstTasks: [
      'Schedule your first 3 workouts this week',
      'Log your starting fitness benchmark',
      'Set your daily habit reminder',
    ],
  },
};

const DEFAULT_PLAN: PlanTemplate = {
  title: 'Your 90-Day Plan',
  summary: 'A personalized roadmap to build momentum and hit your goal over the next 90 days.',
  milestones: [
    { week: 'Week 1–2', title: 'Foundation', description: 'Set up your systems, establish daily routines, and get your first wins on the board.' },
    { week: 'Week 3–6', title: 'Build Momentum', description: 'Deepen your habits, tackle your first major milestone, and let agents start handling recurring tasks.' },
    { week: 'Week 7–10', title: 'Compound Growth', description: 'Review and optimize. Your agents have enough data to operate more autonomously now.' },
    { week: 'Week 11–13', title: 'Accelerate', description: 'Push toward your 90-day target. Agents surface opportunities you may have missed.' },
  ],
  firstTasks: [
    'Complete your first daily brief review',
    'Set up your top 3 leading indicators',
    'Approve your first agent-drafted action',
  ],
};

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
    },
    backButton: { padding: Spacing.xs },
    backText: { ...TextStyles.bodyMedium, color: theme.text.secondary },
    progress: { flexDirection: 'row', gap: 6 },
    progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.border },
    progressDotActive: { backgroundColor: Colors.accent, width: 20 },
    scroll: { flex: 1 },
    titleSection: { padding: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.md },
    sparkle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: 'rgba(14,165,233,0.1)',
      alignSelf: 'flex-start',
      paddingVertical: 6,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.full,
    },
    sparkleIcon: { fontSize: 16 },
    sparkleText: { ...TextStyles.small, color: Colors.accent, fontWeight: '600' },
    title: { ...TextStyles.h2, color: theme.text.primary },
    subtitle: { ...TextStyles.body, color: theme.text.secondary, lineHeight: 26 },
    sectionLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.md,
    },
    timeline: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
    timelineItem: { flexDirection: 'row', gap: Spacing.md },
    timelineLeft: { alignItems: 'center', width: 16 },
    timelineDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.border,
      borderWidth: 2,
      borderColor: theme.border,
      marginTop: 4,
    },
    timelineDotActive: { borderColor: Colors.accent, backgroundColor: Colors.accent },
    timelineLine: { width: 2, flex: 1, backgroundColor: theme.border, marginVertical: 4 },
    timelineContent: { flex: 1, paddingBottom: Spacing.lg },
    timelineWeek: { ...TextStyles.caption, color: Colors.accent, marginBottom: 2 },
    timelineTitle: { ...TextStyles.h4, color: theme.text.primary, marginBottom: 4 },
    timelineDesc: { ...TextStyles.small, color: theme.text.secondary, lineHeight: 20 },
    firstWeek: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'] },
    taskRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', marginBottom: Spacing.md },
    taskBullet: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.accent,
      marginTop: 8,
      flexShrink: 0,
    },
    taskText: { ...TextStyles.bodyMedium, color: theme.text.primary, flex: 1, lineHeight: 24 },
    footer: {
      padding: Spacing.xl,
      paddingBottom: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    continueButton: {
      backgroundColor: Colors.accent,
      paddingVertical: 14,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
    },
    continueText: { ...TextStyles.button, color: Colors.white, fontSize: 17 },
  });
}

export default function PlanPreviewScreen() {
  const { selectedTemplateId } = useOnboardingStore();
  const plan = (selectedTemplateId && PLANS_BY_TEMPLATE[selectedTemplateId]) ?? DEFAULT_PLAN;
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.progress}>
          {[1, 2, 3, 4].map((step) => (
            <View
              key={step}
              style={[styles.progressDot, step <= 3 && styles.progressDotActive]}
            />
          ))}
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <View style={styles.sparkle}>
            <Text style={styles.sparkleIcon}>✨</Text>
            <Text style={styles.sparkleText}>Plan ready</Text>
          </View>
          <Text style={styles.title}>{plan.title}</Text>
          <Text style={styles.subtitle}>{plan.summary}</Text>
        </View>

        <View style={styles.timeline}>
          <Text style={styles.sectionLabel}>Milestone Timeline</Text>
          {plan.milestones.map((m, i) => (
            <View key={m.week} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, i === 0 && styles.timelineDotActive]} />
                {i < plan.milestones.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineWeek}>{m.week}</Text>
                <Text style={styles.timelineTitle}>{m.title}</Text>
                <Text style={styles.timelineDesc}>{m.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.firstWeek}>
          <Text style={styles.sectionLabel}>Your first 3 tasks</Text>
          {plan.firstTasks.map((task, i) => (
            <View key={i} style={styles.taskRow}>
              <View style={styles.taskBullet} />
              <Text style={styles.taskText}>{task}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => router.push('/onboarding/auth')}
          activeOpacity={0.85}
        >
          <Text style={styles.continueText}>Create Account to Start</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
