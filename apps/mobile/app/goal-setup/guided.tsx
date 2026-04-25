import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { useGuidedSetupStore } from '../../stores/guided-setup.store';
import type { GuidedQuestion } from '../../services/guided-setup.api';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    progressBar: {
      height: 3,
      backgroundColor: theme.border,
    },
    progressFill: {
      height: 3,
      backgroundColor: Colors.accent,
    },
    stepLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      textAlign: 'right',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
    },
    questionArea: {
      flex: 1,
      justifyContent: 'center',
      paddingBottom: Spacing.xl,
    },
    question: {
      ...TextStyles.h3,
      color: theme.text.primary,
      marginBottom: Spacing.sm,
      lineHeight: 32,
    },
    context: {
      ...TextStyles.small,
      color: theme.text.secondary,
      marginBottom: Spacing.xl,
      lineHeight: 20,
    },
    // Select / toggle cards
    cardList: { gap: Spacing.sm },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    cardSelected: {
      borderColor: Colors.accent,
      backgroundColor: `${Colors.accent}18`,
    },
    cardText: {
      ...TextStyles.body,
      color: theme.text.primary,
      flex: 1,
    },
    cardTextSelected: { color: Colors.accent, fontWeight: '600' },
    checkmark: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkmarkSelected: {
      borderColor: Colors.accent,
      backgroundColor: Colors.accent,
    },
    checkmarkDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.white,
    },
    // Multiselect chips
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    chipSelected: { borderColor: Colors.accent, backgroundColor: `${Colors.accent}22` },
    chipText: { ...TextStyles.small, color: theme.text.secondary },
    chipTextSelected: { color: Colors.accent, fontWeight: '600' },
    // Slider (scale row)
    sliderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
    sliderChip: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sliderChipSelected: { borderColor: Colors.accent, backgroundColor: Colors.accent },
    sliderChipText: { ...TextStyles.small, color: theme.text.secondary },
    sliderChipTextSelected: { color: Colors.white, fontWeight: '700' },
    sliderLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: Spacing.xs,
    },
    sliderLabelText: { ...TextStyles.caption, color: theme.text.secondary },
    sliderValue: {
      ...TextStyles.h2,
      color: Colors.accent,
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    sliderUnit: { ...TextStyles.caption, color: theme.text.secondary, textAlign: 'center' },
    // Number input
    numberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.lg,
    },
    numberBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: Colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    numberBtnText: { ...TextStyles.h3, color: Colors.accent },
    numberValue: { ...TextStyles.h1, color: theme.text.primary, minWidth: 80, textAlign: 'center' },
    numberUnit: { ...TextStyles.small, color: theme.text.secondary, textAlign: 'center', marginTop: Spacing.xs },
    // Text input
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
    },
    // Footer
    footer: {
      padding: Spacing.lg,
      paddingBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    continueBtn: {
      backgroundColor: Colors.accent,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    continueBtnDisabled: { opacity: 0.4 },
    continueBtnText: { ...TextStyles.button, color: Colors.white },
    backBtn: {
      paddingVertical: Spacing.sm,
      alignItems: 'center',
    },
    backBtnText: { ...TextStyles.body, color: theme.text.secondary },
    errorText: { ...TextStyles.small, color: theme.error, textAlign: 'center' },
  });
}

function ProgressBar({
  step,
  total,
  theme,
}: {
  step: number;
  total: number;
  theme: Theme;
}) {
  const pct = Math.min((step / total) * 100, 100);
  const anim = useRef(new Animated.Value(pct)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 300, useNativeDriver: false }).start();
  }, [pct, anim]);

  const styles = makeStyles(theme);
  return (
    <View style={styles.progressBar}>
      <Animated.View
        style={[styles.progressFill, { width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]}
      />
    </View>
  );
}

function SelectInput({
  options,
  value,
  onChange,
  multiselect,
  theme,
  styles,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  multiselect: boolean;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  if (multiselect) {
    const selected = value ? value.split('|||') : [];
    function toggle(opt: string) {
      const next = selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt];
      onChange(next.join('|||'));
    }
    return (
      <View style={styles.chipRow}>
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => toggle(opt)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.cardList}>
      {options.map((opt) => {
        const isSelected = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.card, isSelected && styles.cardSelected]}
            onPress={() => onChange(opt)}
            activeOpacity={0.8}
          >
            <Text style={[styles.cardText, isSelected && styles.cardTextSelected]}>{opt}</Text>
            <View style={[styles.checkmark, isSelected && styles.checkmarkSelected]}>
              {isSelected && <View style={styles.checkmarkDot} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SliderInput({
  min = 1,
  max = 10,
  defaultVal = 5,
  unit,
  value,
  onChange,
  styles,
}: {
  min?: number;
  max?: number;
  defaultVal?: number;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const numVal = value ? Number(value) : defaultVal;
  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <View>
      <Text style={styles.sliderValue}>{numVal}</Text>
      {unit && <Text style={styles.sliderUnit}>{unit}</Text>}
      <View style={[styles.sliderRow, { marginTop: Spacing.md }]}>
        {ticks.map((v) => {
          const isSelected = v === numVal;
          return (
            <TouchableOpacity
              key={v}
              style={[styles.sliderChip, isSelected && styles.sliderChipSelected]}
              onPress={() => onChange(String(v))}
              activeOpacity={0.8}
            >
              <Text style={[styles.sliderChipText, isSelected && styles.sliderChipTextSelected]}>
                {v}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabelText}>Low</Text>
        <Text style={styles.sliderLabelText}>High</Text>
      </View>
    </View>
  );
}

function NumberInput({
  min = 0,
  max = 999,
  defaultVal = 1,
  unit,
  value,
  onChange,
  styles,
}: {
  min?: number;
  max?: number;
  defaultVal?: number;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const numVal = value ? Number(value) : defaultVal;

  function adjust(delta: number) {
    const next = Math.min(max, Math.max(min, numVal + delta));
    onChange(String(next));
  }

  return (
    <View>
      <View style={styles.numberRow}>
        <TouchableOpacity style={styles.numberBtn} onPress={() => adjust(-1)}>
          <Text style={styles.numberBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.numberValue}>{numVal}</Text>
        <TouchableOpacity style={styles.numberBtn} onPress={() => adjust(1)}>
          <Text style={styles.numberBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      {unit && <Text style={styles.numberUnit}>{unit}</Text>}
    </View>
  );
}

function ToggleInput({
  value,
  onChange,
  styles,
}: {
  value: string;
  onChange: (v: string) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.cardList}>
      {['Yes', 'No'].map((opt) => {
        const isSelected = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.card, isSelected && styles.cardSelected]}
            onPress={() => onChange(opt)}
            activeOpacity={0.8}
          >
            <Text style={[styles.cardText, isSelected && styles.cardTextSelected]}>{opt}</Text>
            <View style={[styles.checkmark, isSelected && styles.checkmarkSelected]}>
              {isSelected && <View style={styles.checkmarkDot} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function renderInput(
  q: GuidedQuestion,
  value: string,
  onChange: (v: string) => void,
  theme: Theme,
  styles: ReturnType<typeof makeStyles>,
) {
  switch (q.inputType) {
    case 'select':
      return (
        <SelectInput
          options={q.options ?? []}
          value={value}
          onChange={onChange}
          multiselect={false}
          theme={theme}
          styles={styles}
        />
      );
    case 'multiselect':
      return (
        <SelectInput
          options={q.options ?? []}
          value={value}
          onChange={onChange}
          multiselect
          theme={theme}
          styles={styles}
        />
      );
    case 'slider':
      return (
        <SliderInput
          {...(q.min !== undefined && { min: q.min })}
          {...(q.max !== undefined && { max: q.max })}
          {...(q.default !== undefined && { defaultVal: q.default })}
          {...(q.unit !== undefined && { unit: q.unit })}
          value={value}
          onChange={onChange}
          styles={styles}
        />
      );
    case 'number':
      return (
        <NumberInput
          {...(q.min !== undefined && { min: q.min })}
          {...(q.max !== undefined && { max: q.max })}
          {...(q.default !== undefined && { defaultVal: q.default })}
          {...(q.unit !== undefined && { unit: q.unit })}
          value={value}
          onChange={onChange}
          styles={styles}
        />
      );
    case 'toggle':
      return <ToggleInput value={value} onChange={onChange} styles={styles} />;
    default:
      return (
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChange}
          placeholder={q.placeholder ?? 'Your answer...'}
          placeholderTextColor={theme.text.secondary}
          multiline
          returnKeyType="done"
        />
      );
  }
}

export default function GuidedScreen() {
  const { templateId, templateName } = useLocalSearchParams<{
    templateId: string;
    templateName: string;
  }>();

  const {
    sessionId,
    currentQuestion,
    questionHistory,
    isLoading,
    error,
    startSession,
    submitAnswer,
    goBack,
    clearError,
  } = useGuidedSetupStore();

  const [inputValue, setInputValue] = useState('');
  const slideAnim = useRef(new Animated.Value(0)).current;
  const theme = useTheme();
  const styles = makeStyles(theme);

  // Start session on mount
  useEffect(() => {
    if (!templateId || sessionId) return;
    void startSession(templateId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // Animate question in when it changes
  useEffect(() => {
    if (!currentQuestion) return;
    slideAnim.setValue(40);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();

    // Pre-fill default for slider/number
    if (currentQuestion.inputType === 'slider' || currentQuestion.inputType === 'number') {
      setInputValue(String(currentQuestion.default ?? currentQuestion.min ?? 1));
    } else {
      setInputValue('');
    }
  }, [currentQuestion?.step, currentQuestion, slideAnim]);

  function hasValue(): boolean {
    if (!currentQuestion) return false;
    if (currentQuestion.inputType === 'multiselect') return inputValue.trim().length > 0;
    if (currentQuestion.inputType === 'slider' || currentQuestion.inputType === 'number') {
      return inputValue.trim().length > 0;
    }
    return inputValue.trim().length > 0;
  }

  async function handleContinue() {
    if (!currentQuestion || !hasValue()) return;
    clearError();

    if (currentQuestion.isLastQuestion) {
      // Navigate to generating screen
      await submitAnswer(inputValue);
      router.push({
        pathname: '/goal-setup/generating',
        params: { templateName: templateName ?? '' },
      });
      return;
    }

    await submitAnswer(inputValue);
  }

  function handleBack() {
    if (questionHistory.length <= 1) {
      router.back();
      return;
    }
    goBack();
    setInputValue('');
  }

  if (!currentQuestion && isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!currentQuestion) return null;

  const progress = currentQuestion.step / currentQuestion.estimatedTotalSteps;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Progress */}
        <ProgressBar step={currentQuestion.step} total={currentQuestion.estimatedTotalSteps} theme={theme} />
        <Text style={styles.stepLabel}>
          {Math.round(progress * 100)}%
        </Text>

        <ScrollView
          style={styles.content}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.questionArea}>
            <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
              <Text style={styles.question}>{currentQuestion.question}</Text>
              {currentQuestion.context ? (
                <Text style={styles.context}>{currentQuestion.context}</Text>
              ) : null}
              {renderInput(currentQuestion, inputValue, setInputValue, theme, styles)}
            </Animated.View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.continueBtn, (!hasValue() || isLoading) && styles.continueBtnDisabled]}
            onPress={() => void handleContinue()}
            disabled={!hasValue() || isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.continueBtnText}>
                {currentQuestion.isLastQuestion ? 'Generate My Plan →' : 'Continue →'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
