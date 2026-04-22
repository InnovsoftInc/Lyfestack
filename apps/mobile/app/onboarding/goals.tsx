import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { DarkTheme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { useOnboardingStore } from '../../stores/onboarding.store';

const TEMPLATES = [
  {
    id: 'productivity',
    name: 'Productivity',
    icon: '⚡',
    description: 'Build systems to get more done, reduce overwhelm, and protect deep work time.',
    tags: ['Focus', 'Systems', 'Time'],
  },
  {
    id: 'self-improvement',
    name: 'Self Improvement',
    icon: '🧠',
    description: 'Develop habits, mindset, and skills for a better version of yourself.',
    tags: ['Habits', 'Mindset', 'Skills'],
  },
  {
    id: 'solo-business',
    name: 'Solo Business',
    icon: '💼',
    description: 'Get your first clients, build revenue, and grow a sustainable solo business.',
    tags: ['Clients', 'Revenue', 'Growth'],
  },
  {
    id: 'social-media',
    name: 'Social Media',
    icon: '📱',
    description: 'Grow your audience, build authority, and create content that converts.',
    tags: ['Audience', 'Content', 'Authority'],
  },
  {
    id: 'fitness',
    name: 'Fitness',
    icon: '💪',
    description: 'Build strength, run further, and make wellness a non-negotiable part of your day.',
    tags: ['Strength', 'Cardio', 'Routine'],
  },
];

export default function GoalSelectionScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const setTemplate = useOnboardingStore((s) => s.setTemplate);

  const handleContinue = () => {
    if (!selected) return;
    setTemplate(selected);
    router.push('/onboarding/diagnostic');
  };

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
              style={[styles.progressDot, step === 1 && styles.progressDotActive]}
            />
          ))}
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <Text style={styles.title}>What's your main goal?</Text>
          <Text style={styles.subtitle}>Pick one to start. You can add more later.</Text>
        </View>

        <View style={styles.templates}>
          {TEMPLATES.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.card, selected === t.id && styles.cardSelected]}
              onPress={() => setSelected(t.id)}
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
                {selected === t.id && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.cardName}>{t.name}</Text>
              <Text style={styles.cardDesc}>{t.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, !selected && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!selected}
          activeOpacity={0.85}
        >
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DarkTheme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  backButton: { padding: Spacing.xs },
  backText: { ...TextStyles.bodyMedium, color: DarkTheme.text.secondary },
  progress: { flexDirection: 'row', gap: 6 },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DarkTheme.border,
  },
  progressDotActive: { backgroundColor: Colors.accent, width: 20 },
  scroll: { flex: 1 },
  titleSection: { padding: Spacing.xl, paddingTop: Spacing.md, gap: Spacing.sm },
  title: { ...TextStyles.h2, color: DarkTheme.text.primary },
  subtitle: { ...TextStyles.body, color: DarkTheme.text.secondary },
  templates: { paddingHorizontal: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xl },
  card: {
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardSelected: { borderColor: Colors.accent, backgroundColor: 'rgba(14,165,233,0.08)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardIcon: { fontSize: 26 },
  cardTags: { flex: 1, flexDirection: 'row', gap: 6 },
  tag: {
    backgroundColor: DarkTheme.border,
    borderRadius: BorderRadius.sm,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  tagText: { ...TextStyles.caption, color: DarkTheme.text.secondary },
  checkmark: { fontSize: 18, color: Colors.accent, fontWeight: 'bold' },
  cardName: { ...TextStyles.h4, color: DarkTheme.text.primary },
  cardDesc: { ...TextStyles.small, color: DarkTheme.text.secondary, lineHeight: 20 },
  footer: {
    padding: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: DarkTheme.border,
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
