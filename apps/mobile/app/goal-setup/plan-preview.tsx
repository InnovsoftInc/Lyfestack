import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { useGuidedSetupStore } from '../../stores/guided-setup.store';
import { useGoalsStore } from '../../stores/goals.store';
import { useAuthStore } from '../../stores/auth.store';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing['2xl'] },
    header: { alignItems: 'center', marginBottom: Spacing.xl },
    badge: {
      width: 64,
      height: 64,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    badgeText: { fontSize: 28 },
    title: { ...TextStyles.h2, color: theme.text.primary, marginBottom: Spacing.xs },
    goalTitle: { ...TextStyles.body, color: Colors.accent, textAlign: 'center' },
    card: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: Spacing.md,
    },
    cardTitle: { ...TextStyles.h4, color: theme.text.primary, marginBottom: Spacing.sm },
    cardDesc: { ...TextStyles.body, color: theme.text.secondary, marginBottom: Spacing.md, lineHeight: 22 },
    metaRow: { flexDirection: 'row', gap: Spacing.md },
    metaBadge: {
      flex: 1,
      backgroundColor: theme.background,
      borderRadius: BorderRadius.sm,
      padding: Spacing.sm,
      alignItems: 'center',
    },
    metaLabel: { ...TextStyles.caption, color: theme.text.secondary, marginBottom: 2 },
    metaValue: { ...TextStyles.small, color: theme.text.primary, fontWeight: '600' },
    sectionTitle: {
      ...TextStyles.bodyMedium,
      color: theme.text.primary,
      marginBottom: Spacing.sm,
      marginTop: Spacing.xs,
    },
    milestone: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    milestoneIndex: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: `${Colors.accent}22`,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    milestoneIndexText: { ...TextStyles.caption, color: Colors.accent, fontWeight: '700' },
    milestoneBody: { flex: 1 },
    milestoneTitle: { ...TextStyles.bodyMedium, color: theme.text.primary, marginBottom: 2 },
    milestoneDesc: { ...TextStyles.small, color: theme.text.secondary, lineHeight: 18 },
    milestoneMeta: { ...TextStyles.caption, color: Colors.accent, marginTop: 2 },
    insight: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    insightDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.accent,
      marginTop: 7,
    },
    insightText: { ...TextStyles.small, color: theme.text.secondary, flex: 1, lineHeight: 20 },
    infoBox: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: Colors.accent,
      marginBottom: Spacing.xl,
    },
    infoText: { ...TextStyles.small, color: theme.text.secondary, lineHeight: 20 },
    button: {
      backgroundColor: Colors.accent,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { ...TextStyles.button, color: Colors.white },
    errorText: { ...TextStyles.body, color: theme.error, textAlign: 'center', marginBottom: Spacing.md },
  });
}

export default function PlanPreviewScreen() {
  const { templateName } = useLocalSearchParams<{ templateName?: string }>();
  const { generatedPlan, answers, sessionId, reset } = useGuidedSetupStore();
  const { createGoal } = useGoalsStore();
  const { user } = useAuthStore();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Auto-save goal when plan is first shown
  useEffect(() => {
    if (!generatedPlan || !user || saved) return;
    setSaved(true);

    void createGoal({
      title: generatedPlan.goalTitle,
      description: generatedPlan.goalDescription,
      diagnosticAnswers: answers.map((a) => ({ questionId: `step-${a.step}`, value: a.value })),
      targetDate: generatedPlan.estimatedDurationDays
        ? new Date(Date.now() + generatedPlan.estimatedDurationDays * 86400000).toISOString().split('T')[0]
        : undefined,
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save goal';
      setError(msg);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedPlan, user]);

  async function handleGoToGoals() {
    setIsSaving(true);
    reset();
    router.replace('/(auth)/(drawer)/goals');
  }

  if (!generatedPlan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={{ ...TextStyles.body, color: theme.text.secondary }}>Loading your plan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const startDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endDate = new Date(
    Date.now() + generatedPlan.estimatedDurationDays * 86400000,
  ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓</Text>
          </View>
          <Text style={styles.title}>Your Plan is Ready</Text>
          <Text style={styles.goalTitle}>{generatedPlan.goalTitle}</Text>
        </View>

        {/* Plan summary card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{generatedPlan.goalTitle}</Text>
          <Text style={styles.cardDesc}>{generatedPlan.goalDescription}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Text style={styles.metaLabel}>Start</Text>
              <Text style={styles.metaValue}>{startDate}</Text>
            </View>
            <View style={styles.metaBadge}>
              <Text style={styles.metaLabel}>Target</Text>
              <Text style={styles.metaValue}>{endDate}</Text>
            </View>
            <View style={styles.metaBadge}>
              <Text style={styles.metaLabel}>Duration</Text>
              <Text style={styles.metaValue}>{generatedPlan.estimatedDurationDays}d</Text>
            </View>
          </View>
        </View>

        {/* Milestones */}
        {generatedPlan.milestones.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Milestones</Text>
            {generatedPlan.milestones.map((ms, i) => (
              <View
                key={i}
                style={[
                  styles.milestone,
                  i === generatedPlan.milestones.length - 1 && { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 },
                ]}
              >
                <View style={styles.milestoneIndex}>
                  <Text style={styles.milestoneIndexText}>{i + 1}</Text>
                </View>
                <View style={styles.milestoneBody}>
                  <Text style={styles.milestoneTitle}>{ms.title}</Text>
                  {ms.description ? (
                    <Text style={styles.milestoneDesc}>{ms.description}</Text>
                  ) : null}
                  <Text style={styles.milestoneMeta}>
                    Day {ms.dueDayOffset} · {ms.tasks?.length ?? 0} tasks
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Insights */}
        {generatedPlan.insights.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Personalized Insights</Text>
            {generatedPlan.insights.map((insight, i) => (
              <View key={i} style={styles.insight}>
                <View style={styles.insightDot} />
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Tasks will appear in your Daily Brief each morning, prioritized by your goals and schedule.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, isSaving && styles.buttonDisabled]}
          onPress={() => void handleGoToGoals()}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Go to Goals →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
