import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { DarkTheme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { getTemplateById } from '../../services/templates.api';
import type { TemplateDefinition, DiagnosticQuestion } from '../../services/templates.api';
import type { DiagnosticAnswer } from '../../services/goals.api';

export default function DiagnosticScreen() {
  const { templateId, templateName } = useLocalSearchParams<{
    templateId: string;
    templateName: string;
  }>();

  const [template, setTemplate] = useState<TemplateDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [goalTitle, setGoalTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) return;
    getTemplateById(templateId)
      .then((t) => {
        setTemplate(t);
        // Pre-fill default answers for scale questions
        const defaults: Record<string, string | number | boolean> = {};
        t.diagnosticQuestions.forEach((q) => {
          if (q.type === 'scale') defaults[q.id] = q.min ?? 1;
        });
        setAnswers(defaults);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load questions');
      })
      .finally(() => setIsLoading(false));
  }, [templateId]);

  function setAnswer(questionId: string, value: string | number | boolean) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit() {
    if (!goalTitle.trim()) {
      setError('Please enter a goal title');
      return;
    }
    if (!template) return;

    setIsSubmitting(true);
    setError(null);

    const diagnosticAnswers: DiagnosticAnswer[] = Object.entries(answers).map(
      ([questionId, value]) => ({ questionId, value }),
    );

    router.push({
      pathname: '/goal-setup/plan-preview',
      params: {
        templateId: template.id,
        goalTitle: goalTitle.trim(),
        answersJson: JSON.stringify(diagnosticAnswers),
      },
    });
  }

  function renderQuestion(q: DiagnosticQuestion) {
    const answer = answers[q.id];

    if (q.type === 'choice' && q.options) {
      return (
        <View style={styles.questionBlock} key={q.id}>
          <Text style={styles.questionText}>{q.question}</Text>
          <View style={styles.optionsRow}>
            {q.options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.optionChip, answer === opt && styles.optionChipSelected]}
                onPress={() => setAnswer(q.id, opt)}
              >
                <Text
                  style={[styles.optionText, answer === opt && styles.optionTextSelected]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    if (q.type === 'boolean') {
      return (
        <View style={styles.questionBlock} key={q.id}>
          <Text style={styles.questionText}>{q.question}</Text>
          <View style={styles.optionsRow}>
            {['Yes', 'No'].map((opt) => {
              const val = opt === 'Yes';
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionChip, answer === val && styles.optionChipSelected]}
                  onPress={() => setAnswer(q.id, val)}
                >
                  <Text style={[styles.optionText, answer === val && styles.optionTextSelected]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    if (q.type === 'scale') {
      const min = q.min ?? 1;
      const max = q.max ?? 10;
      const scaleValues = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      return (
        <View style={styles.questionBlock} key={q.id}>
          <Text style={styles.questionText}>{q.question}</Text>
          <View style={styles.scaleRow}>
            {scaleValues.map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.scaleChip, answer === val && styles.optionChipSelected]}
                onPress={() => setAnswer(q.id, val)}
              >
                <Text style={[styles.optionText, answer === val && styles.optionTextSelected]}>
                  {val}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.scaleLabels}>
            <Text style={styles.scaleLabelText}>Low</Text>
            <Text style={styles.scaleLabelText}>High</Text>
          </View>
        </View>
      );
    }

    // text fallback
    return (
      <View style={styles.questionBlock} key={q.id}>
        <Text style={styles.questionText}>{q.question}</Text>
        <TextInput
          style={styles.textInput}
          value={typeof answer === 'string' ? answer : ''}
          onChangeText={(v) => setAnswer(q.id, v)}
          placeholderTextColor={DarkTheme.text.secondary}
          placeholder="Your answer..."
        />
      </View>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{templateName ?? 'Set Up Your Goal'}</Text>
          <Text style={styles.subtitle}>Answer a few questions so we can build your plan</Text>
        </View>

        {/* Goal title */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Goal title</Text>
          <TextInput
            style={styles.textInput}
            value={goalTitle}
            onChangeText={setGoalTitle}
            placeholder="e.g. Run a 5K in 8 weeks"
            placeholderTextColor={DarkTheme.text.secondary}
          />
        </View>

        {/* Diagnostic questions */}
        {template?.diagnosticQuestions.map((q) => renderQuestion(q))}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitText}>Build My Plan →</Text>
          )}
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
  },
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing['2xl'],
  },
  header: {
    marginBottom: Spacing.lg,
  },
  backText: {
    ...TextStyles.body,
    color: Colors.accent,
    marginBottom: Spacing.md,
  },
  title: {
    ...TextStyles.h2,
    color: DarkTheme.text.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...TextStyles.body,
    color: DarkTheme.text.secondary,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    ...TextStyles.bodyMedium,
    color: DarkTheme.text.primary,
    marginBottom: Spacing.sm,
  },
  questionBlock: {
    marginBottom: Spacing.lg,
  },
  questionText: {
    ...TextStyles.bodyMedium,
    color: DarkTheme.text.primary,
    marginBottom: Spacing.sm,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  optionChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    backgroundColor: DarkTheme.surface,
  },
  optionChipSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  optionText: {
    ...TextStyles.small,
    color: DarkTheme.text.secondary,
  },
  optionTextSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
  scaleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  scaleChip: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    backgroundColor: DarkTheme.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  scaleLabelText: {
    ...TextStyles.caption,
    color: DarkTheme.text.secondary,
  },
  textInput: {
    ...TextStyles.body,
    color: DarkTheme.text.primary,
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    padding: Spacing.md,
  },
  errorText: {
    ...TextStyles.small,
    color: DarkTheme.error,
    marginBottom: Spacing.md,
  },
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    ...TextStyles.button,
    color: Colors.white,
  },
});
