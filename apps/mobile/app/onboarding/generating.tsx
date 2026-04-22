import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { getApiBase } from '../../services/api';

// Map onboarding slugs to server template IDs
const SERVER_TEMPLATE_ID: Record<string, string> = {
  'productivity': 'tpl-productivity-focus',
  'fitness': 'tpl-fitness-beginner',
  'solo-business': 'tpl-solo-business',
};

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' },
    content: { padding: Spacing.xl, width: '100%', alignItems: 'center', gap: Spacing.xl },
    sparkleWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(14,165,233,0.12)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sparkle: { fontSize: 36 },
    title: { ...TextStyles.h2, color: theme.text.primary, textAlign: 'center' },
    stepText: { ...TextStyles.body, color: theme.text.secondary, textAlign: 'center', minHeight: 24 },
    progressTrack: {
      width: '100%',
      height: 6,
      backgroundColor: theme.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: Colors.accent,
      borderRadius: 3,
    },
    progressLabel: { ...TextStyles.caption, color: theme.text.secondary },
  });
}

export default function GeneratingScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { selectedTemplateId, diagnosticAnswers, setGeneratedPlan } = useOnboardingStore();
  const [currentStep, setCurrentStep] = useState('Starting up...');
  const [progress, setProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      const serverTemplateId = selectedTemplateId ? SERVER_TEMPLATE_ID[selectedTemplateId] : undefined;

      // No server template for this category — skip straight to preview
      if (!serverTemplateId) {
        if (!cancelled) router.replace('/onboarding/preview');
        return;
      }

      try {
        const base = await getApiBase();
        const answers = Object.entries(diagnosticAnswers).map(([questionId, value]) => ({
          questionId,
          value,
        }));

        const response = await fetch(`${base}/api/plan-preview/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: serverTemplateId, answers }),
        });

        if (!response.ok || !response.body) {
          if (!cancelled) router.replace('/onboarding/preview');
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let eventType = '';
        let navigated = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('event:')) {
              eventType = trimmed.slice(6).trim();
            } else if (trimmed.startsWith('data:')) {
              try {
                const data = JSON.parse(trimmed.slice(5).trim()) as Record<string, unknown>;
                if (eventType === 'progress' && !cancelled) {
                  setCurrentStep((data['step'] as string) ?? '');
                  setProgress((data['progress'] as number) ?? 0);
                } else if (eventType === 'complete' && !cancelled && !navigated) {
                  navigated = true;
                  setGeneratedPlan(data['plan'] as Parameters<typeof setGeneratedPlan>[0]);
                  setProgress(100);
                  setTimeout(() => {
                    if (!cancelled) router.replace('/onboarding/preview');
                  }, 600);
                } else if (eventType === 'error' && !cancelled && !navigated) {
                  navigated = true;
                  router.replace('/onboarding/preview');
                }
              } catch {
                // malformed JSON line, skip
              }
              eventType = '';
            }
          }
        }

        if (!navigated && !cancelled) {
          router.replace('/onboarding/preview');
        }
      } catch {
        if (!cancelled) router.replace('/onboarding/preview');
      }
    }

    generate();
    return () => { cancelled = true; };
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.sparkleWrap}>
          <Text style={styles.sparkle}>✨</Text>
        </View>

        <Text style={styles.title}>Building your plan...</Text>
        <Text style={styles.stepText}>{currentStep}</Text>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <Text style={styles.progressLabel}>{Math.round(progress)}%</Text>
      </View>
    </SafeAreaView>
  );
}
