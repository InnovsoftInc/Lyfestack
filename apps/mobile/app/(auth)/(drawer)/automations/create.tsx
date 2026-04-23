import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { useAutomationsStore } from '../../../../stores/automations.store';
import { useOpenClawStore } from '../../../../stores/openclaw.store';

const SCHEDULE_OPTIONS = [
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Every 6 hours', cron: '0 */6 * * *' },
  { label: 'Daily at 8am', cron: '0 8 * * *' },
  { label: 'Daily at noon', cron: '0 12 * * *' },
  { label: 'Daily at 6pm', cron: '0 18 * * *' },
  { label: 'Weekdays at 9am', cron: '0 9 * * 1-5' },
  { label: 'Weekly Monday 9am', cron: '0 9 * * 1' },
];

const PROMPT_TEMPLATES = [
  'Give me a brief status summary',
  'Draft a daily standup update',
  'Research the latest trends in my industry',
  'Review my goals and suggest next steps',
  'Write a social media post for today',
  'Summarize what I should focus on today',
];

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    cancelText: { color: Colors.accent, fontSize: 16 },
    headerTitle: { color: theme.text.primary, fontSize: 17, fontWeight: '700' },
    headerRight: { width: 60 },
    scroll: { padding: Spacing.lg, gap: Spacing.md },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      padding: Spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      gap: Spacing.sm,
    },
    fieldLabel: {
      color: theme.text.secondary,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    fieldHint: { color: theme.text.secondary, fontSize: 12 },
    input: {
      backgroundColor: theme.background,
      borderRadius: 12,
      paddingHorizontal: Spacing.sm + 6,
      paddingVertical: Spacing.sm + 2,
      color: theme.text.primary,
      fontSize: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    textarea: { minHeight: 90, textAlignVertical: 'top', lineHeight: 20 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm - 2 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: theme.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    chipActive: { backgroundColor: Colors.accent + '20', borderColor: Colors.accent },
    chipText: { color: theme.text.secondary, fontSize: 13 },
    chipTextActive: { color: Colors.accent, fontWeight: '600' },
    templateBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: theme.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    templateBtnText: { color: theme.text.secondary, fontSize: 12 },
    primaryBtn: {
      backgroundColor: Colors.accent,
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: 'center',
      shadowColor: Colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 6,
      marginTop: Spacing.md,
    },
    primaryBtnOff: {
      backgroundColor: theme.surface,
      shadowOpacity: 0,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    errorBox: {
      padding: Spacing.md,
      backgroundColor: theme.error + '18',
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.error + '55',
    },
    errorText: { color: theme.error, fontSize: 13 },
    noAgentWarn: {
      padding: Spacing.md,
      backgroundColor: Colors.warning + '15',
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.warning + '44',
    },
    noAgentText: { color: Colors.warning, fontSize: 13, textAlign: 'center' },
  });
}

export default function CreateAutomationScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { create } = useAutomationsStore();
  const { agents } = useOpenClawStore();

  const [name, setName] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.name ?? '');
  const [selectedSchedule, setSelectedSchedule] = useState(SCHEDULE_OPTIONS[2]!);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSave = name.trim().length > 0 && selectedAgent && message.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await create({
        name: name.trim(),
        agentName: selectedAgent,
        cronExpression: selectedSchedule.cron,
        scheduleLabel: selectedSchedule.label,
        message: message.trim(),
        enabled: true,
      });
      router.back();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create automation');
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.handleWrap}>
        <View style={styles.handle} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Automation</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Name */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Automation Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Daily standup"
            placeholderTextColor={theme.text.secondary}
          />
        </View>

        {/* Agent */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Agent</Text>
          {agents.length === 0 ? (
            <View style={styles.noAgentWarn}>
              <Text style={styles.noAgentText}>
                No agents found. Create an agent first from the Agents tab.
              </Text>
            </View>
          ) : (
            <View style={styles.chips}>
              {agents.map((a) => (
                <TouchableOpacity
                  key={a.name}
                  style={[styles.chip, selectedAgent === a.name && styles.chipActive]}
                  onPress={() => setSelectedAgent(a.name)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, selectedAgent === a.name && styles.chipTextActive]}>
                    {a.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Schedule */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Schedule</Text>
          <View style={styles.chips}>
            {SCHEDULE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.cron}
                style={[styles.chip, selectedSchedule.cron === opt.cron && styles.chipActive]}
                onPress={() => setSelectedSchedule(opt)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selectedSchedule.cron === opt.cron && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Message */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Message / Prompt</Text>
          <Text style={styles.fieldHint}>What should the agent do when this runs?</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={message}
            onChangeText={setMessage}
            placeholder="e.g. Give me a brief summary of what I should focus on today"
            placeholderTextColor={theme.text.secondary}
            multiline
            textAlignVertical="top"
          />
          {/* Quick templates */}
          <Text style={styles.fieldLabel}>Quick templates</Text>
          <View style={styles.chips}>
            {PROMPT_TEMPLATES.map((t) => (
              <TouchableOpacity
                key={t}
                style={styles.templateBtn}
                onPress={() => setMessage(t)}
                activeOpacity={0.7}
              >
                <Text style={styles.templateBtnText}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, (!canSave || saving) && styles.primaryBtnOff]}
          onPress={handleSave}
          disabled={!canSave || saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Create Automation</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
