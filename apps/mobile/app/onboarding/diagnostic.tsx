import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { useOnboardingStore } from '../../stores/onboarding.store';

const QUESTIONS_BY_TEMPLATE: Record<string, Array<{
  id: string;
  label: string;
  type: 'text' | 'select';
  placeholder?: string;
  options?: string[];
}>> = {
  productivity: [
    { id: 'challenge', label: "What's your biggest productivity challenge right now?", type: 'text', placeholder: 'e.g. Too many meetings, constant distractions...' },
    { id: 'hours', label: 'How many focused hours can you dedicate daily?', type: 'select', options: ['Less than 1 hour', '1–2 hours', '2–4 hours', '4+ hours'] },
    { id: 'tool', label: 'What does success look like in 90 days?', type: 'text', placeholder: 'e.g. Ship a product, clear my backlog...' },
  ],
  'self-improvement': [
    { id: 'habit', label: 'Which habit do you most want to build?', type: 'text', placeholder: 'e.g. Daily reading, journaling, meditation...' },
    { id: 'obstacle', label: "What's stopped you from building it before?", type: 'select', options: ['Lack of time', 'No accountability', 'Lost motivation', 'Forgot or got distracted'] },
    { id: 'success', label: "How will you know you've improved in 90 days?", type: 'text', placeholder: 'e.g. Read 6 books, meditate every day...' },
  ],
  'solo-business': [
    { id: 'offer', label: 'What service or product are you selling?', type: 'text', placeholder: 'e.g. Consulting, coaching, design...' },
    { id: 'stage', label: "Where are you in your business journey?", type: 'select', options: ['Just starting out', 'Have an idea, no clients yet', 'A few clients', 'Growing and scaling'] },
    { id: 'goal', label: 'What revenue goal are you aiming for?', type: 'select', options: ['$1K/mo', '$5K/mo', '$10K/mo', '$20K+/mo'] },
  ],
  'social-media': [
    { id: 'platform', label: 'Which platform is your primary focus?', type: 'select', options: ['LinkedIn', 'X (Twitter)', 'Instagram', 'TikTok', 'YouTube'] },
    { id: 'followers', label: 'Current follower count?', type: 'select', options: ['Under 500', '500–2,500', '2,500–10K', '10K+'] },
    { id: 'goal', label: 'What do you want your content to achieve?', type: 'text', placeholder: 'e.g. Generate leads, build authority, sell products...' },
  ],
  fitness: [
    { id: 'current', label: 'How would you describe your current fitness level?', type: 'select', options: ['Sedentary', 'Light activity', 'Moderately active', 'Very active'] },
    { id: 'goal', label: 'What is your primary fitness goal?', type: 'text', placeholder: 'e.g. Run a 5K, lose 20 lbs, do 10 pull-ups...' },
    { id: 'days', label: 'How many days per week can you work out?', type: 'select', options: ['2 days', '3 days', '4 days', '5+ days'] },
  ],
};

const DEFAULT_QUESTIONS = QUESTIONS_BY_TEMPLATE['productivity'] ?? [];

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
    titleSection: { padding: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.sm },
    title: { ...TextStyles.h2, color: theme.text.primary },
    subtitle: { ...TextStyles.body, color: theme.text.secondary },
    questions: { paddingHorizontal: Spacing.xl, gap: Spacing.xl, paddingBottom: Spacing.xl },
    questionBlock: { gap: Spacing.md },
    questionLabel: { ...TextStyles.bodyMedium, color: theme.text.primary, lineHeight: 24 },
    questionNumber: { color: Colors.accent },
    input: {
      ...TextStyles.body,
      color: theme.text.primary,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      minHeight: 56,
      textAlignVertical: 'top',
    },
    options: { gap: Spacing.sm },
    option: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
    },
    optionSelected: { borderColor: Colors.accent, backgroundColor: 'rgba(14,165,233,0.1)' },
    optionText: { ...TextStyles.bodyMedium, color: theme.text.secondary },
    optionTextSelected: { color: Colors.accent },
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
    continueButtonDisabled: { opacity: 0.4 },
    continueText: { ...TextStyles.button, color: Colors.white, fontSize: 17 },
  });
}

export default function DiagnosticScreen() {
  const { selectedTemplateId, diagnosticAnswers, setAnswer } = useOnboardingStore();
  const questions = selectedTemplateId
    ? (QUESTIONS_BY_TEMPLATE[selectedTemplateId] ?? DEFAULT_QUESTIONS)
    : DEFAULT_QUESTIONS;
  const theme = useTheme();
  const styles = makeStyles(theme);

  const allAnswered = questions.every((q) => diagnosticAnswers[q.id]);

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
              style={[styles.progressDot, step <= 2 && styles.progressDotActive]}
            />
          ))}
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.titleSection}>
          <Text style={styles.title}>A few quick questions</Text>
          <Text style={styles.subtitle}>
            Lyfestack uses these to build a plan tailored to you.
          </Text>
        </View>

        <View style={styles.questions}>
          {questions.map((q, i) => (
            <View key={q.id} style={styles.questionBlock}>
              <Text style={styles.questionLabel}>
                <Text style={styles.questionNumber}>{i + 1}. </Text>
                {q.label}
              </Text>

              {q.type === 'text' ? (
                <TextInput
                  style={styles.input}
                  placeholder={q.placeholder}
                  placeholderTextColor={theme.text.secondary}
                  value={diagnosticAnswers[q.id] ?? ''}
                  onChangeText={(text) => setAnswer(q.id, text)}
                  multiline
                  numberOfLines={2}
                />
              ) : (
                <View style={styles.options}>
                  {q.options?.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.option,
                        diagnosticAnswers[q.id] === opt && styles.optionSelected,
                      ]}
                      onPress={() => setAnswer(q.id, opt)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          diagnosticAnswers[q.id] === opt && styles.optionTextSelected,
                        ]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, !allAnswered && styles.continueButtonDisabled]}
          onPress={() => router.push('/onboarding/generating')}
          disabled={!allAnswered}
          activeOpacity={0.85}
        >
          <Text style={styles.continueText}>Generate My Plan</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
