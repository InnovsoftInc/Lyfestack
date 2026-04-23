import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { useGuidedSetupStore } from '../../stores/guided-setup.store';
import { connectSSE } from '../../services/guided-setup.api';
import type { GenerationMessage } from '../../stores/guided-setup.store';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    inner: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
      justifyContent: 'center',
    },
    heading: {
      ...TextStyles.h2,
      color: theme.text.primary,
      marginBottom: Spacing.xs,
    },
    subheading: {
      ...TextStyles.body,
      color: theme.text.secondary,
      marginBottom: Spacing['2xl'],
    },
    messageList: { gap: Spacing.md },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 5,
    },
    dotActive: { backgroundColor: Colors.accent },
    dotDone: { backgroundColor: theme.success },
    dotError: { backgroundColor: theme.error },
    messageText: {
      ...TextStyles.body,
      color: theme.text.secondary,
      flex: 1,
      lineHeight: 22,
    },
    messageTextDone: { color: theme.text.primary },
    checkmark: {
      ...TextStyles.small,
      color: theme.success,
      fontWeight: '700',
      marginTop: 4,
    },
    doneContainer: {
      marginTop: Spacing['2xl'],
      alignItems: 'center',
    },
    doneTitle: {
      ...TextStyles.h3,
      color: theme.text.primary,
      marginBottom: Spacing.xs,
      textAlign: 'center',
    },
    doneSubtitle: {
      ...TextStyles.body,
      color: theme.text.secondary,
      marginBottom: Spacing.xl,
      textAlign: 'center',
    },
    viewPlanBtn: {
      backgroundColor: Colors.accent,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing['2xl'],
      alignItems: 'center',
    },
    viewPlanText: { ...TextStyles.button, color: Colors.white },
    errorText: {
      ...TextStyles.body,
      color: theme.error,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    retryBtn: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.xl,
    },
    retryText: { ...TextStyles.body, color: theme.text.secondary },
    pulsingDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: Colors.accent,
      marginTop: 5,
    },
  });
}

function MessageRow({
  msg,
  isLast,
  theme,
  styles,
}: {
  msg: GenerationMessage;
  isLast: boolean;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (!isLast || msg.type === 'complete' || msg.type === 'error') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLast, msg.type, pulseAnim]);

  const isDone = !isLast || msg.type === 'complete';

  return (
    <Animated.View style={[styles.messageRow, { opacity: fadeAnim }]}>
      {isDone ? (
        <Text style={styles.checkmark}>✓</Text>
      ) : (
        <Animated.View style={[styles.pulsingDot, { opacity: pulseAnim }]} />
      )}
      <Text style={[styles.messageText, isDone && styles.messageTextDone]}>{msg.message}</Text>
    </Animated.View>
  );
}

export default function GeneratingScreen() {
  const { templateName } = useLocalSearchParams<{ templateName?: string }>();
  const {
    sessionId,
    generationMessages,
    generatedPlan,
    addGenerationMessage,
    setGeneratedPlan,
    setIsGenerating,
  } = useGuidedSetupStore();

  const theme = useTheme();
  const styles = makeStyles(theme);
  const connectionRef = useRef<{ close: () => void } | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!sessionId || hasStarted.current) return;
    hasStarted.current = true;
    setIsGenerating(true);

    connectionRef.current = connectSSE(
      sessionId,
      (event) => {
        addGenerationMessage(event);
        if (event.type === 'complete' && event.plan) {
          setGeneratedPlan(event.plan);
          setIsGenerating(false);
        } else if (event.type === 'error') {
          setIsGenerating(false);
        }
      },
      (_err) => {
        addGenerationMessage({ type: 'error', message: 'Connection lost. Please try again.' } as Parameters<typeof addGenerationMessage>[0]);
        setIsGenerating(false);
      },
    );

    return () => {
      connectionRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const lastMsg = generationMessages[generationMessages.length - 1];
  const hasError = lastMsg?.type === 'error';
  const isDone = generatedPlan !== null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.heading}>
          {isDone ? 'Your plan is ready' : 'Building your plan...'}
        </Text>
        <Text style={styles.subheading}>
          {isDone
            ? `Personalized for ${templateName ?? 'your goal'}`
            : 'This takes just a moment'}
        </Text>

        <View style={styles.messageList}>
          {generationMessages.map((msg, i) => (
            <MessageRow
              key={msg.id}
              msg={msg}
              isLast={i === generationMessages.length - 1}
              theme={theme}
              styles={styles}
            />
          ))}
        </View>

        {isDone && (
          <View style={styles.doneContainer}>
            <Text style={styles.doneTitle}>Ready to go!</Text>
            <Text style={styles.doneSubtitle}>
              Your personalized milestones and daily tasks are waiting.
            </Text>
            <TouchableOpacity
              style={styles.viewPlanBtn}
              onPress={() =>
                router.replace({
                  pathname: '/goal-setup/plan-preview',
                  params: { templateName: templateName ?? '' },
                })
              }
              activeOpacity={0.85}
            >
              <Text style={styles.viewPlanText}>View My Plan →</Text>
            </TouchableOpacity>
          </View>
        )}

        {hasError && !isDone && (
          <View style={styles.doneContainer}>
            <Text style={styles.errorText}>{lastMsg.message}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
              <Text style={styles.retryText}>← Go Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
