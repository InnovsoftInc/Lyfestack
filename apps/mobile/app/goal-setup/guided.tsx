import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import {
  startGoalBuilder,
  answerGoalBuilderQuestion,
} from '../../services/goal-builder.api';
import type { AIQuestion, AIPlan } from '../../services/goal-builder.api';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
    loadingText: { ...TextStyles.body, color: theme.text.secondary, textAlign: 'center' },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing['2xl'] },
    progress: {
      height: 3,
      backgroundColor: theme.border,
      borderRadius: 2,
      marginBottom: Spacing.xl,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 2 },
    contextBubble: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
      borderLeftWidth: 3,
      borderLeftColor: Colors.accent,
    },
    contextText: { ...TextStyles.small, color: theme.text.secondary, lineHeight: 18 },
    questionText: {
      ...TextStyles.h3,
      color: theme.text.primary,
      marginBottom: Spacing.lg,
      lineHeight: 28,
    },
    optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
    optionChip: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    optionChipSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
    optionText: { ...TextStyles.small, color: theme.text.secondary },
    optionTextSelected: { color: Colors.white, fontWeight: '600' },
    scaleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
    scaleChip: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
    scaleLabelText: { ...TextStyles.caption, color: theme.text.secondary },
    textInput: {
      ...TextStyles.body,
      color: theme.text.primary,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      minHeight: 80,
      textAlignVertical: 'top',
      marginBottom: Spacing.lg,
    },
    continueButton: {
      backgroundColor: Colors.accent,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    continueButtonDisabled: { opacity: 0.5 },
    continueText: { ...TextStyles.button, color: Colors.white },
    errorText: { ...TextStyles.small, color: theme.error, marginBottom: Spacing.md, textAlign: 'center' },
    stepCount: { ...TextStyles.caption, color: theme.text.secondary, textAlign: 'center', marginBottom: Spacing.sm },
  });
}

export default function GuidedSetupScreen() {
  const { templateId, templateName } = useLocalSearchParams<{
    templateId: string;
    templateName: string;
  }>();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<AIQuestion | null>(null);
  const [answer, setAnswer] = useState<string>('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const theme = useTheme();
  const styles = makeStyles(theme);

  useEffect(() => {
    if (!templateId || !templateName) return;
    startGoalBuilder(templateId, templateName)
      .then(({ sessionId: sid, question: q }) => {
        setSessionId(sid);
        setQuestion(q);
        setIsLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to start guided setup');
        setIsLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function animateTransition(cb: () => void) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      cb();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }

  async function handleContinue() {
    if (!sessionId || !question) return;
    const currentAnswer = answer.trim();
    if (!currentAnswer) { setError('Please provide an answer before continuing'); return; }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await answerGoalBuilderQuestion(sessionId, currentAnswer);

      if (result.done && result.plan) {
        const plan: AIPlan = result.plan;
        router.replace({
          pathname: '/goal-setup/plan-preview',
          params: {
            sessionId,
            planJson: JSON.stringify(plan),
            templateName: templateName ?? '',
          },
        });
        return;
      }

      if (result.question) {
        animateTransition(() => {
          setQuestion(result.question!);
          setAnswer('');
          setQuestionIndex((i) => i + 1);
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit answer');
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderInput() {
    if (!question) return null;

    if (question.inputType === 'choice' && question.options) {
      return (
        <View style={styles.optionsRow}>
          {question.options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.optionChip, answer === opt && styles.optionChipSelected]}
              onPress={() => setAnswer(opt)}
            >
              <Text style={[styles.optionText, answer === opt && styles.optionTextSelected]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (question.inputType === 'boolean') {
      return (
        <View style={styles.optionsRow}>
          {['Yes', 'No'].map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.optionChip, answer === opt && styles.optionChipSelected]}
              onPress={() => setAnswer(opt)}
            >
              <Text style={[styles.optionText, answer === opt && styles.optionTextSelected]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (question.inputType === 'scale') {
      const values = Array.from({ length: 10 }, (_, i) => i + 1);
      return (
        <>
          <View style={styles.scaleRow}>
            {values.map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.scaleChip, answer === String(val) && styles.optionChipSelected]}
                onPress={() => setAnswer(String(val))}
              >
                <Text style={[styles.optionText, answer === String(val) && styles.optionTextSelected]}>
                  {val}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.scaleLabels}>
            <Text style={styles.scaleLabelText}>Low</Text>
            <Text style={styles.scaleLabelText}>High</Text>
          </View>
        </>
      );
    }

    return (
      <TextInput
        style={styles.textInput}
        value={answer}
        onChangeText={setAnswer}
        placeholder={question.placeholder ?? 'Your answer...'}
        placeholderTextColor={theme.text.secondary}
        multiline
      />
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Starting your guided setup...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !question) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.continueButton} onPress={() => router.back()}>
            <Text style={styles.continueText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const estimatedTotal = 7;
  const progress = Math.min(questionIndex / estimatedTotal, 0.95);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Progress bar */}
        <View style={styles.progress}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.stepCount}>Question {questionIndex + 1}</Text>

        {question && (
          <Animated.View style={{ opacity: fadeAnim }}>
            {question.context && (
              <View style={styles.contextBubble}>
                <Text style={styles.contextText}>{question.context}</Text>
              </View>
            )}

            <Text style={styles.questionText}>{question.question}</Text>

            {renderInput()}

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.continueButton, (!answer.trim() || isSubmitting) && styles.continueButtonDisabled]}
              onPress={handleContinue}
              disabled={!answer.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.continueText}>
                  {question.isLastQuestion ? 'Build My Plan →' : 'Continue →'}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
