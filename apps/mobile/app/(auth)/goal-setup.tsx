import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { useGoalsStore } from '../../stores/goals.store';

const TEMPLATES = [
  {
    id: 'productivity',
    name: 'Productivity',
    icon: '⚡',
    description: 'Build systems to get more done, reduce overwhelm, and protect deep work time.',
    tags: ['Focus', 'Systems', 'Time'],
    title: 'Productivity System',
    templateId: 'tpl-productivity-focus',
  },
  {
    id: 'self-improvement',
    name: 'Self Improvement',
    icon: '🧠',
    description: 'Develop habits, mindset, and skills for a better version of yourself.',
    tags: ['Habits', 'Mindset', 'Skills'],
    title: 'Self Improvement',
    templateId: 'tpl-learning-skill',
  },
  {
    id: 'solo-business',
    name: 'Solo Business',
    icon: '💼',
    description: 'Get your first clients, build revenue, and grow a sustainable solo business.',
    tags: ['Clients', 'Revenue', 'Growth'],
    title: 'Solo Business Growth',
    templateId: 'tpl-solo-business',
  },
  {
    id: 'social-media',
    name: 'Social Media',
    icon: '📱',
    description: 'Grow your audience, build authority, and create content that converts.',
    tags: ['Audience', 'Content', 'Authority'],
    title: 'Social Media Growth',
    templateId: 'tpl-creativity-writing',
  },
  {
    id: 'fitness',
    name: 'Fitness',
    icon: '💪',
    description: 'Build strength, run further, and make wellness a non-negotiable part of your day.',
    tags: ['Strength', 'Cardio', 'Routine'],
    title: 'Fitness Journey',
    templateId: 'tpl-fitness-beginner',
  },
];

const QUESTIONS: Record<string, Array<{ id: string; label: string; type: 'text' | 'select'; placeholder?: string; options?: string[] }>> = {
  productivity: [
    { id: 'challenge', label: "What's your biggest productivity challenge right now?", type: 'text', placeholder: 'e.g. Too many meetings, constant distractions...' },
    { id: 'hours', label: 'How many focused hours can you dedicate daily?', type: 'select', options: ['Less than 1 hour', '1–2 hours', '2–4 hours', '4+ hours'] },
    { id: 'success', label: 'What does success look like in 90 days?', type: 'text', placeholder: 'e.g. Ship a product, clear my backlog...' },
  ],
  'self-improvement': [
    { id: 'habit', label: 'Which habit do you most want to build?', type: 'text', placeholder: 'e.g. Daily reading, journaling, meditation...' },
    { id: 'obstacle', label: "What's stopped you from building it before?", type: 'select', options: ['Lack of time', 'No accountability', 'Lost motivation', 'Forgot or got distracted'] },
    { id: 'success', label: "How will you know you've improved in 90 days?", type: 'text', placeholder: 'e.g. Read 6 books, meditate every day...' },
  ],
  'solo-business': [
    { id: 'offer', label: 'What service or product are you selling?', type: 'text', placeholder: 'e.g. Consulting, coaching, design...' },
    { id: 'stage', label: 'Where are you in your business journey?', type: 'select', options: ['Just starting out', 'Have an idea, no clients yet', 'A few clients', 'Growing and scaling'] },
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
    cancelBtn: { padding: Spacing.xs },
    cancelText: { ...TextStyles.bodyMedium, color: theme.text.secondary },
    progress: { flexDirection: 'row', gap: 6 },
    progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.border },
    progressDotActive: { backgroundColor: Colors.accent, width: 20 },
    scroll: { flex: 1 },
    titleSection: { padding: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.sm },
    title: { ...TextStyles.h2, color: theme.text.primary },
    subtitle: { ...TextStyles.body, color: theme.text.secondary },
    templates: { paddingHorizontal: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xl },
    card: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    cardSelected: { borderColor: Colors.accent, backgroundColor: 'rgba(14,165,233,0.08)' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    cardIcon: { fontSize: 26 },
    cardTags: { flex: 1, flexDirection: 'row', gap: 6 },
    tag: { backgroundColor: theme.border, borderRadius: BorderRadius.sm, paddingVertical: 2, paddingHorizontal: 8 },
    tagText: { ...TextStyles.caption, color: theme.text.secondary },
    checkmark: { fontSize: 18, color: Colors.accent, fontWeight: 'bold' },
    cardName: { ...TextStyles.h4, color: theme.text.primary },
    cardDesc: { ...TextStyles.small, color: theme.text.secondary, lineHeight: 20 },
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
    errorBox: { marginHorizontal: Spacing.xl, padding: Spacing.md, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
    errorText: { ...TextStyles.small, color: '#EF4444' },
    footer: {
      padding: Spacing.xl,
      paddingBottom: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    primaryBtn: {
      backgroundColor: Colors.accent,
      paddingVertical: 14,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
    },
    primaryBtnDisabled: { opacity: 0.4 },
    primaryBtnText: { ...TextStyles.button, color: Colors.white, fontSize: 17 },
  });
}

export default function GoalSetupScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { createGoal } = useGoalsStore();

  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const template = TEMPLATES.find((t) => t.id === selectedId);
  const questions = selectedId ? (QUESTIONS[selectedId] ?? []) : [];
  const allAnswered = questions.every((q) => answers[q.id]);

  const handleCreate = async () => {
    if (!template) return;
    setCreating(true);
    setError('');
    try {
      const description = Object.entries(answers)
        .map(([, v]) => v)
        .filter(Boolean)
        .join('. ');
      await createGoal({
        title: template.title,
        description,
        templateId: template.templateId,
        diagnosticAnswers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })),
      });
      router.back();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create goal');
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={step === 0 ? () => router.back() : () => setStep((s) => s - 1)}
          style={styles.cancelBtn}
        >
          <Text style={styles.cancelText}>{step === 0 ? 'Cancel' : '← Back'}</Text>
        </TouchableOpacity>
        <View style={styles.progress}>
          {[0, 1].map((s) => (
            <View key={s} style={[styles.progressDot, s <= step && styles.progressDotActive]} />
          ))}
        </View>
      </View>

      {step === 0 ? (
        <>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.titleSection}>
              <Text style={styles.title}>What's your goal?</Text>
              <Text style={styles.subtitle}>Pick the area you want to focus on.</Text>
            </View>
            <View style={styles.templates}>
              {TEMPLATES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.card, selectedId === t.id && styles.cardSelected]}
                  onPress={() => setSelectedId(t.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardIcon}>{t.icon}</Text>
                    <View style={styles.cardTags}>
                      {t.tags.map((tag) => (
                        <View key={tag} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                    {selectedId === t.id && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.cardName}>{t.name}</Text>
                  <Text style={styles.cardDesc}>{t.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.primaryBtn, !selectedId && styles.primaryBtnDisabled]}
              onPress={() => { setAnswers({}); setStep(1); }}
              disabled={!selectedId}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.titleSection}>
              <Text style={styles.title}>A few quick questions</Text>
              <Text style={styles.subtitle}>Lyfestack uses these to build a plan tailored to you.</Text>
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
                      value={answers[q.id] ?? ''}
                      onChangeText={(text) => setAnswers((prev) => ({ ...prev, [q.id]: text }))}
                      multiline
                      numberOfLines={2}
                    />
                  ) : (
                    <View style={styles.options}>
                      {q.options?.map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={[styles.option, answers[q.id] === opt && styles.optionSelected]}
                          onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.optionText, answers[q.id] === opt && styles.optionTextSelected]}>
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
            {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.primaryBtn, (!allAnswered || creating) && styles.primaryBtnDisabled]}
              onPress={handleCreate}
              disabled={!allAnswered || creating}
              activeOpacity={0.85}
            >
              {creating
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.primaryBtnText}>Create Goal</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
