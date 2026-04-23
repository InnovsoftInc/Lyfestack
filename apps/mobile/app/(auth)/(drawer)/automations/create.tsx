import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Switch,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { useAutomationsStore } from '../../../../stores/automations.store';
import { useOpenClawStore } from '../../../../stores/openclaw.store';

const SCHEDULE_PRESETS = [
  { label: 'Every 5 min', value: '*/5 * * * *' },
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Daily 8am', value: '0 8 * * *' },
  { label: 'Daily 9am', value: '0 9 * * *' },
  { label: 'Daily 10am', value: '0 10 * * *' },
  { label: 'Daily 2pm', value: '0 14 * * *' },
  { label: 'Daily 8pm', value: '0 20 * * *' },
  { label: 'Nightly 11pm', value: '0 23 * * *' },
  { label: 'Weekly Mon', value: '0 9 * * 1' },
];

const CHANNEL_OPTIONS = [
  { label: '📱 Telegram', value: 'telegram' },
  { label: '💬 Slack', value: 'slack' },
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
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    toggleLabel: { ...TextStyles.body, color: theme.text.primary },
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
    primaryBtnTextOff: { color: theme.text.secondary },
    errorBox: {
      padding: Spacing.md,
      backgroundColor: theme.error + '18',
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.error + '55',
    },
    errorText: { color: theme.error, fontSize: 13 },
    infoBox: {
      padding: Spacing.md,
      backgroundColor: Colors.accent + '12',
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.accent + '44',
      gap: 4,
    },
    infoText: { color: theme.text.secondary, fontSize: 12, lineHeight: 18 },
    cronPreview: {
      backgroundColor: theme.background,
      borderRadius: 10,
      padding: Spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    cronPreviewText: {
      ...TextStyles.caption,
      color: Colors.accent,
      fontFamily: 'monospace',
    },
  });
}

export default function CreateCronJobScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { create } = useAutomationsStore();
  const { agents } = useOpenClawStore();

  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState('0 9 * * *');
  const [customSchedule, setCustomSchedule] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.name ?? 'main');
  const [prompt, setPrompt] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<'telegram' | 'slack'>('telegram');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeSchedule = useCustom ? customSchedule : schedule;
  const canSave = name.trim().length > 0 && activeSchedule.trim().length > 0
    && selectedAgent.length > 0 && prompt.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await create({
        name: name.trim(),
        schedule: activeSchedule.trim(),
        agent: selectedAgent,
        prompt: prompt.trim(),
        enabled,
        notify: { channel: selectedChannel },
      });
      router.back();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create routine');
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
        <Text style={styles.headerTitle}>New Cron Job</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Cron jobs run your OpenClaw agent on a schedule. The prompt is sent to the agent when the job fires.
          </Text>
        </View>

        {/* Name */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Job Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Daily Lead Finder"
            placeholderTextColor={theme.text.secondary}
          />
        </View>

        {/* Schedule */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Schedule</Text>
          <View style={styles.chips}>
            {SCHEDULE_PRESETS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[styles.chip, !useCustom && schedule === p.value && styles.chipActive]}
                onPress={() => { setSchedule(p.value); setUseCustom(false); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, !useCustom && schedule === p.value && styles.chipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.chip, useCustom && styles.chipActive]}
              onPress={() => setUseCustom(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, useCustom && styles.chipTextActive]}>Custom…</Text>
            </TouchableOpacity>
          </View>
          {useCustom && (
            <TextInput
              style={styles.input}
              value={customSchedule}
              onChangeText={setCustomSchedule}
              placeholder="e.g. 0 9 * * 1-5"
              placeholderTextColor={theme.text.secondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
          {activeSchedule.trim().length > 0 && (
            <View style={styles.cronPreview}>
              <Text style={styles.cronPreviewText}>{activeSchedule}</Text>
            </View>
          )}
        </View>

        {/* Agent */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Agent</Text>
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
            {agents.length === 0 && (
              <TextInput
                style={styles.input}
                value={selectedAgent}
                onChangeText={setSelectedAgent}
                placeholder="e.g. marketer"
                placeholderTextColor={theme.text.secondary}
              />
            )}
          </View>
        </View>

        {/* Prompt */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Prompt</Text>
          <Text style={styles.fieldHint}>What the agent should do when this job fires.</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="e.g. Send the morning batch of cold outreach emails to local businesses."
            placeholderTextColor={theme.text.secondary}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Notify channel */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Notify Channel</Text>
          <View style={styles.chips}>
            {CHANNEL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, selectedChannel === opt.value && styles.chipActive]}
                onPress={() => setSelectedChannel(opt.value as 'telegram' | 'slack')}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selectedChannel === opt.value && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Enabled */}
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enable immediately</Text>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: theme.border, true: Colors.accent }}
              thumbColor={Colors.white}
            />
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
            <Text style={[styles.primaryBtnText, (!canSave || saving) && styles.primaryBtnTextOff]}>
              Create Job
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
