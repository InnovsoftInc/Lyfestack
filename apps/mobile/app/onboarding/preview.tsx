import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { useOnboardingStore } from '../../stores/onboarding.store';
import type { GeneratedPlan } from '../../stores/onboarding.store';

interface PlanDisplay {
  title: string;
  summary: string;
  milestones: { week: string; title: string; description: string }[];
  tasks: string[];
}

function fromGeneratedPlan(plan: GeneratedPlan): PlanDisplay {
  return {
    title: plan.title,
    summary: plan.description,
    milestones: plan.milestones.map((m) => {
      const week = Math.max(1, Math.ceil((m.dueDayOffset || 7) / 7));
      return { week: `Week ${week}`, title: m.title, description: m.title };
    }),
    tasks: plan.tasks.slice(0, 3).map((t) => t.title),
  };
}

const TEMPLATE_PLANS: Record<string, PlanDisplay> = {
  'productivity': {
    title: 'Your 30-Day Productivity Plan',
    summary: 'Based on your answers, here\'s a focused plan to build better systems and eliminate distractions.',
    milestones: [
      { week: 'Week 1', title: 'Foundation', description: 'Define your daily routine, identify time wasters, and set up focus blocks.' },
      { week: 'Week 2', title: 'Build Habits', description: 'Establish morning ritual, practice deep work sessions, track completion rate.' },
      { week: 'Week 3', title: 'Optimize', description: 'Review what\'s working, eliminate what isn\'t, let agents automate recurring tasks.' },
      { week: 'Week 4', title: 'Sustain', description: 'Lock in your system, hit your 7-day streak, celebrate progress.' },
    ],
    tasks: ['Set up your morning routine', 'Schedule your first focus block', 'Identify your top 3 distractions'],
  },
  'self-improvement': {
    title: 'Your 60-Day Growth Plan',
    summary: 'A structured path to build better habits and invest in yourself consistently.',
    milestones: [
      { week: 'Week 1-2', title: 'Start Small', description: 'Pick one habit, start your journal, set a daily reflection time.' },
      { week: 'Week 3-4', title: 'Build Momentum', description: 'Add a second habit, complete your first book or course module.' },
      { week: 'Week 5-6', title: 'Deepen Practice', description: 'Review progress, adjust habits, compound your growth.' },
      { week: 'Week 7-8', title: 'Measure Impact', description: 'Reflect on transformation, set next phase goals.' },
    ],
    tasks: ['Start a daily journal entry', 'Choose your first book or course', 'Set a daily learning time'],
  },
  'solo-business': {
    title: 'Your 90-Day Business Growth Plan',
    summary: 'A strategic roadmap to find customers, increase revenue, and build systems.',
    milestones: [
      { week: 'Week 1-2', title: 'Audit & Strategy', description: 'Analyze current state, identify bottlenecks, define growth levers.' },
      { week: 'Week 3-6', title: 'Execute', description: 'Launch marketing, optimize pricing, agents handle content and outreach.' },
      { week: 'Week 7-10', title: 'Scale', description: 'Double down on what works, automate operations, track revenue growth.' },
      { week: 'Week 11-13', title: 'Accelerate', description: 'Hit revenue target, review and plan next quarter.' },
    ],
    tasks: ['Audit your current marketing channels', 'Define your ideal customer profile', 'Set your 90-day revenue target'],
  },
  'social-media': {
    title: 'Your 60-Day Social Media Plan',
    summary: 'Consistent content, smart engagement, and data-driven growth.',
    milestones: [
      { week: 'Week 1-2', title: 'Content Strategy', description: 'Define your niche, content pillars, and posting schedule.' },
      { week: 'Week 3-4', title: 'Consistency', description: 'Post daily, engage with your audience, track what resonates.' },
      { week: 'Week 5-6', title: 'Optimize', description: 'Analyze top performers, double down on winning formats.' },
      { week: 'Week 7-8', title: 'Growth Sprint', description: 'Push for follower milestone, launch a content series.' },
    ],
    tasks: ['Define your 3 content pillars', 'Schedule your first week of posts', 'Research trending topics in your niche'],
  },
  'fitness': {
    title: 'Your 60-Day Fitness Plan',
    summary: 'Build consistency, track progress, and make fitness a daily habit.',
    milestones: [
      { week: 'Week 1-2', title: 'Get Started', description: 'Set baseline measurements, create workout schedule, start tracking.' },
      { week: 'Week 3-4', title: 'Build Routine', description: 'Increase consistency, add nutrition tracking if selected.' },
      { week: 'Week 5-6', title: 'Push Through', description: 'Increase intensity, take progress photos, stay accountable.' },
      { week: 'Week 7-8', title: 'Results', description: 'Measure progress, celebrate wins, plan next phase.' },
    ],
    tasks: ['Take your baseline measurements', 'Schedule your first 3 workouts', 'Set your fitness goal target'],
  },
};

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    backButton: { padding: Spacing.xs },
    backText: { ...TextStyles.bodyMedium, color: theme.text.secondary },
    progress: { flexDirection: 'row', gap: 6 },
    progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.border },
    progressDotActive: { backgroundColor: Colors.accent, width: 20 },
    scroll: { flex: 1 },
    titleSection: { padding: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.md },
    sparkle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: 'rgba(14,165,233,0.1)', alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full },
    sparkleIcon: { fontSize: 16 },
    sparkleText: { ...TextStyles.small, color: Colors.accent, fontWeight: '600' },
    title: { ...TextStyles.h2, color: theme.text.primary },
    subtitle: { ...TextStyles.body, color: theme.text.secondary, lineHeight: 26 },
    sectionLabel: { ...TextStyles.caption, color: theme.text.secondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    timeline: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
    timelineItem: { flexDirection: 'row', gap: Spacing.md },
    timelineLeft: { alignItems: 'center', width: 16 },
    timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.border, borderWidth: 2, borderColor: theme.border, marginTop: 4 },
    timelineDotActive: { borderColor: Colors.accent, backgroundColor: Colors.accent },
    timelineLine: { width: 2, flex: 1, backgroundColor: theme.border, marginVertical: 4 },
    timelineContent: { flex: 1, paddingBottom: Spacing.lg },
    timelineWeek: { ...TextStyles.caption, color: Colors.accent, marginBottom: 2 },
    timelineTitle: { ...TextStyles.h4, color: theme.text.primary, marginBottom: 4 },
    timelineDesc: { ...TextStyles.small, color: theme.text.secondary, lineHeight: 20 },
    firstWeek: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'] },
    taskRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', marginBottom: Spacing.md },
    taskBullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent, marginTop: 8, flexShrink: 0 },
    taskText: { ...TextStyles.bodyMedium, color: theme.text.primary, flex: 1, lineHeight: 24 },
    footer: { padding: Spacing.xl, paddingBottom: Spacing.lg, borderTopWidth: 1, borderTopColor: theme.border },
    continueButton: { backgroundColor: Colors.accent, paddingVertical: 14, borderRadius: BorderRadius.md, alignItems: 'center' },
    continueText: { ...TextStyles.button, color: Colors.white, fontSize: 17 },
  });
}

export default function PlanPreviewScreen() {
  const { selectedTemplateId, generatedPlan } = useOnboardingStore();
  const plan = useMemo<PlanDisplay>(() => {
    if (generatedPlan) return fromGeneratedPlan(generatedPlan);
    return TEMPLATE_PLANS[selectedTemplateId ?? 'productivity'] ?? TEMPLATE_PLANS['productivity']!;
  }, [generatedPlan, selectedTemplateId]);
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
            <View key={step} style={[styles.progressDot, step <= 3 && styles.progressDotActive]} />
          ))}
        </View>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <View style={styles.sparkle}>
            <Text style={styles.sparkleIcon}>✨</Text>
            <Text style={styles.sparkleText}>Plan generated</Text>
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
          {plan.tasks.map((task, i) => (
            <View key={i} style={styles.taskRow}>
              <View style={styles.taskBullet} />
              <Text style={styles.taskText}>{task}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueButton} onPress={() => router.push('/onboarding/auth')} activeOpacity={0.85}>
          <Text style={styles.continueText}>Create Account to Start</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
