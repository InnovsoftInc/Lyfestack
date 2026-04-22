import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { approveGoalBuilder } from '../../services/goal-builder.api';
import type { AIPlan, AIPlanMilestone, AIPlanTask } from '../../services/goal-builder.api';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
    scroll: { padding: Spacing.lg, paddingBottom: 120 },
    header: { marginBottom: Spacing.xl },
    headerTitle: { ...TextStyles.h2, color: theme.text.primary, marginBottom: Spacing.xs },
    headerSub: { ...TextStyles.body, color: theme.text.secondary },
    sectionTitle: { ...TextStyles.h4, color: theme.text.primary, marginBottom: Spacing.sm, marginTop: Spacing.lg },
    summaryCard: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: Spacing.md,
    },
    summaryText: { ...TextStyles.body, color: theme.text.secondary, lineHeight: 22 },
    timelineBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    timelineText: { ...TextStyles.small, color: Colors.accent, fontWeight: '600' },
    milestoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: theme.border,
      gap: Spacing.sm,
    },
    weekBadge: {
      width: 36,
      height: 36,
      borderRadius: BorderRadius.full,
      backgroundColor: Colors.accent + '20',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    weekText: { ...TextStyles.caption, color: Colors.accent, fontWeight: '700' },
    milestoneInput: {
      flex: 1,
      ...TextStyles.body,
      color: theme.text.primary,
      padding: 0,
    },
    taskRow: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    taskHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    taskTitle: { ...TextStyles.bodyMedium, color: theme.text.primary, flex: 1 },
    taskDesc: { ...TextStyles.caption, color: theme.text.secondary, marginTop: 4 },
    taskMeta: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
    taskBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
      backgroundColor: theme.background,
    },
    taskBadgeText: { ...TextStyles.caption, color: theme.text.secondary },
    removeBtn: {
      width: 28,
      height: 28,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.error + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    removeBtnText: { color: theme.error, fontSize: 16, fontWeight: '700', lineHeight: 18 },
    addTaskBtn: {
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: 'dashed',
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    addTaskText: { ...TextStyles.body, color: Colors.accent },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: Spacing.lg,
      backgroundColor: theme.background,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    saveButton: {
      backgroundColor: Colors.accent,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: { ...TextStyles.button, color: Colors.white },
    errorText: { ...TextStyles.body, color: theme.error, textAlign: 'center', marginBottom: Spacing.md },
    editHint: { ...TextStyles.caption, color: theme.text.secondary, textAlign: 'center', marginBottom: Spacing.lg },
  });
}

export default function PlanPreviewScreen() {
  const { sessionId, planJson, templateName } = useLocalSearchParams<{
    sessionId: string;
    planJson: string;
    templateName: string;
  }>();

  const theme = useTheme();
  const styles = makeStyles(theme);

  const initialPlan: AIPlan = planJson
    ? (JSON.parse(planJson) as AIPlan)
    : { title: 'Your Plan', summary: '', milestones: [], tasks: [], timeline: { durationDays: 90, startDate: new Date().toISOString().split('T')[0] } };

  const [milestones, setMilestones] = useState<AIPlanMilestone[]>(initialPlan.milestones);
  const [tasks, setTasks] = useState<AIPlanTask[]>(initialPlan.tasks);
  const [removedIndices, setRemovedIndices] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateMilestoneTitle(index: number, title: string) {
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, title } : m)));
  }

  function removeTask(index: number) {
    setRemovedIndices((prev) => [...prev, index]);
  }

  function addCustomTask() {
    Alert.prompt(
      'Add Task',
      'Enter a task title:',
      (title) => {
        if (title?.trim()) {
          setTasks((prev) => [
            ...prev,
            { title: title.trim(), description: '', type: 'ACTION', priority: 'MEDIUM', estimatedMinutes: 30 },
          ]);
        }
      },
      'plain-text',
    );
  }

  async function handleStartGoal() {
    if (!sessionId) {
      setError('Session expired. Please go back and restart.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const editedMilestones = milestones.map((m, i) => ({
        index: i,
        title: m.title,
      }));

      await approveGoalBuilder(sessionId, {
        editedMilestones,
        removedTaskIndices: removedIndices,
        addedTasks: tasks.slice(initialPlan.tasks.length).map((t) => ({
          title: t.title,
          description: t.description,
        })),
      });

      router.replace('/(auth)/(drawer)/goals');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save goal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const visibleTasks = tasks.filter((_, i) => !removedIndices.includes(i));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{initialPlan.title || templateName}</Text>
          <Text style={styles.headerSub}>Review and edit your plan before starting</Text>
        </View>

        <Text style={styles.editHint}>Tap milestone titles to edit them. Remove tasks you don't want.</Text>

        {/* Summary */}
        {initialPlan.summary ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{initialPlan.summary}</Text>
            <View style={styles.timelineBadge}>
              <Text style={styles.timelineText}>{initialPlan.timeline.durationDays} days</Text>
              <Text style={styles.timelineText}>·</Text>
              <Text style={styles.timelineText}>Starts {initialPlan.timeline.startDate}</Text>
            </View>
          </View>
        ) : null}

        {/* Milestones */}
        {milestones.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Milestones</Text>
            {milestones.map((m, i) => (
              <View key={i} style={styles.milestoneRow}>
                <View style={styles.weekBadge}>
                  <Text style={styles.weekText}>W{m.week}</Text>
                </View>
                <TextInput
                  style={styles.milestoneInput}
                  value={m.title}
                  onChangeText={(v) => updateMilestoneTitle(i, v)}
                  placeholderTextColor={theme.text.secondary}
                />
              </View>
            ))}
          </>
        )}

        {/* Tasks */}
        {visibleTasks.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Tasks</Text>
            {tasks.map((t, originalIndex) => {
              if (removedIndices.includes(originalIndex)) return null;
              return (
                <View key={originalIndex} style={styles.taskRow}>
                  <View style={styles.taskHeader}>
                    <Text style={styles.taskTitle} numberOfLines={2}>{t.title}</Text>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => removeTask(originalIndex)}>
                      <Text style={styles.removeBtnText}>×</Text>
                    </TouchableOpacity>
                  </View>
                  {t.description ? <Text style={styles.taskDesc}>{t.description}</Text> : null}
                  <View style={styles.taskMeta}>
                    <View style={styles.taskBadge}>
                      <Text style={styles.taskBadgeText}>{t.type}</Text>
                    </View>
                    <View style={styles.taskBadge}>
                      <Text style={styles.taskBadgeText}>{t.priority}</Text>
                    </View>
                    {t.estimatedMinutes > 0 && (
                      <View style={styles.taskBadge}>
                        <Text style={styles.taskBadgeText}>{t.estimatedMinutes}min</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        <TouchableOpacity style={styles.addTaskBtn} onPress={addCustomTask}>
          <Text style={styles.addTaskText}>+ Add a custom task</Text>
        </TouchableOpacity>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Spacer for fixed footer */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Fixed footer with save button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleStartGoal}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Looks Good — Start This Goal</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
