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
import { DarkTheme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { useGoalsStore } from '../../stores/goals.store';
import { useAuthStore } from '../../stores/auth.store';
import type { DiagnosticAnswer, Plan } from '../../services/goals.api';

export default function PlanPreviewScreen() {
  const { templateId, goalTitle, answersJson } = useLocalSearchParams<{
    templateId: string;
    goalTitle: string;
    answersJson: string;
  }>();

  const { user } = useAuthStore();
  const { createGoal, generatePlan, isLoading, error, clearError } = useGoalsStore();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);

  useEffect(() => {
    if (!templateId || !goalTitle || !answersJson || !user) return;

    const diagnosticAnswers: DiagnosticAnswer[] = JSON.parse(answersJson) as DiagnosticAnswer[];

    async function generate() {
      try {
        // Create goal first
        const goal = await createGoal({
          title: goalTitle,
          description: '',
          templateId,
          diagnosticAnswers,
        });

        setGoalId(goal.id);

        // Then generate plan
        const generatedPlan = await generatePlan(
          goal.id,
          templateId,
          diagnosticAnswers,
          user!.id,
        );
        setPlan(generatedPlan);
        setIsGenerated(true);
      } catch {
        // error already set in store
      }
    }

    void generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setIsSaving(true);
    clearError();
    // Goal is already saved; navigate to goals tab
    router.replace('/(auth)/(drawer)/goals');
  }

  function handleRetry() {
    router.back();
  }

  if (isLoading && !isGenerated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Building your plan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={handleRetry}>
            <Text style={styles.buttonText}>← Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.successBadge}>
            <Text style={styles.successEmoji}>✓</Text>
          </View>
          <Text style={styles.title}>Your Plan is Ready</Text>
          <Text style={styles.goalTitle}>{goalTitle}</Text>
        </View>

        {plan && (
          <View style={styles.planCard}>
            <Text style={styles.planTitle}>{plan.title}</Text>
            <Text style={styles.planDesc}>{plan.description}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaBadge}>
                <Text style={styles.metaLabel}>Start</Text>
                <Text style={styles.metaValue}>{plan.startDate}</Text>
              </View>
              <View style={styles.metaBadge}>
                <Text style={styles.metaLabel}>Target</Text>
                <Text style={styles.metaValue}>{plan.endDate}</Text>
              </View>
            </View>
          </View>
        )}

        {!plan && goalId && (
          <View style={styles.planCard}>
            <Text style={styles.planDesc}>
              Your goal has been saved. Tasks will appear in your daily brief starting tomorrow.
            </Text>
          </View>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Tasks will appear in your Daily Brief each morning, prioritized by your goals and schedule.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, isSaving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.buttonText}>Go to Goals →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DarkTheme.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  loadingText: {
    ...TextStyles.body,
    color: DarkTheme.text.secondary,
  },
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing['2xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  successBadge: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: DarkTheme.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  successEmoji: {
    fontSize: 28,
    color: Colors.white,
  },
  title: {
    ...TextStyles.h2,
    color: DarkTheme.text.primary,
    marginBottom: Spacing.xs,
  },
  goalTitle: {
    ...TextStyles.body,
    color: Colors.accent,
  },
  planCard: {
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    marginBottom: Spacing.md,
  },
  planTitle: {
    ...TextStyles.h4,
    color: DarkTheme.text.primary,
    marginBottom: Spacing.sm,
  },
  planDesc: {
    ...TextStyles.body,
    color: DarkTheme.text.secondary,
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  metaBadge: {
    flex: 1,
    backgroundColor: DarkTheme.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  metaLabel: {
    ...TextStyles.caption,
    color: DarkTheme.text.secondary,
    marginBottom: 2,
  },
  metaValue: {
    ...TextStyles.small,
    color: DarkTheme.text.primary,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    marginBottom: Spacing.xl,
  },
  infoText: {
    ...TextStyles.small,
    color: DarkTheme.text.secondary,
    lineHeight: 20,
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...TextStyles.button,
    color: Colors.white,
  },
  errorText: {
    ...TextStyles.body,
    color: DarkTheme.error,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
});
