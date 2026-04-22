import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';

const MOCK_PLAN = {
  title: 'Your 90-Day Plan',
  summary: 'Based on your answers, here\'s a focused plan to build momentum in the first 90 days.',
  milestones: [
    { week: 'Week 1–2', title: 'Foundation', description: 'Set up your systems, establish daily routines, and get your first wins on the board.', done: false },
    { week: 'Week 3–6', title: 'Build Momentum', description: 'Deepen your habits, tackle your first major milestone, and let agents start handling recurring tasks.', done: false },
    { week: 'Week 7–10', title: 'Compound Growth', description: 'Review and optimize. Your agents have enough data to operate more autonomously now.', done: false },
    { week: 'Week 11–13', title: 'Accelerate', description: 'Push toward your 90-day target. Agents surface opportunities you may have missed.', done: false },
  ],
  tasks: [
    'Complete your first daily brief review',
    'Set up your top 3 leading indicators',
    'Approve your first agent-drafted content',
  ],
};

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    loadingContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.xl,
      gap: Spacing.lg,
    },
    loadingTitle: { ...TextStyles.h3, color: theme.text.primary, textAlign: 'center' },
    loadingSubtitle: { ...TextStyles.body, color: theme.text.secondary, textAlign: 'center', lineHeight: 26 },
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
  const [loading, setLoading] = useState(true);
  const theme = useTheme();
  const styles = makeStyles(theme);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingTitle}>Building your plan...</Text>
          <Text style={styles.loadingSubtitle}>
            Lyfestack is analyzing your answers and generating a personalized roadmap.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.sparkleText}>Plan generated</Text>
          </View>
          <Text style={styles.title}>{MOCK_PLAN.title}</Text>
          <Text style={styles.subtitle}>{MOCK_PLAN.summary}</Text>
        </View>

        <View style={styles.timeline}>
          <Text style={styles.sectionLabel}>Milestone Timeline</Text>
          {MOCK_PLAN.milestones.map((m, i) => (
            <View key={m.week} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, i === 0 && styles.timelineDotActive]} />
                {i < MOCK_PLAN.milestones.length - 1 && <View style={styles.timelineLine} />}
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
          {MOCK_PLAN.tasks.map((task, i) => (
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
