import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../../hooks/useTheme';
import { Spacing } from '../../../../theme';
import type { Theme } from '../../../../theme';
import {
  routinesApi,
  SCHEDULE_PRESETS,
  humanizeCron,
} from '../../../../services/routines.api';
import { useOpenClawStore } from '../../../../stores/openclaw.store';

function isValidCron(expr: string): boolean {
  // Simple 5-part validation without external library
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  // Allow * and numbers and ranges for each part
  const cronPartRe = /^(\*|(\d+(-\d+)?(\/\d+)?)(,(\d+(-\d+)?(\/\d+)?))*|\*\/\d+)$/;
  return parts.every((p) => cronPartRe.test(p));
}

export default function CreateRoutineScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editId?: string }>();
  const theme = useTheme();
  const s = styles(theme);
  const insets = useSafeAreaInsets();
  const { agents } = useOpenClawStore();
  const isEdit = Boolean(params.editId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>(SCHEDULE_PRESETS[0].value);
  const [customCron, setCustomCron] = useState('');
  const [agentName, setAgentName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);

  const schedule = selectedPreset === 'custom' ? customCron : selectedPreset;

  useEffect(() => {
    if (!isEdit || !params.editId) return;
    routinesApi.list().then((routines) => {
      const r = routines.find((x) => x.id === params.editId);
      if (!r) return;
      setName(r.name);
      setDescription(r.description);
      setAgentName(r.agentName);
      setPrompt(r.prompt);
      setEnabled(r.enabled);
      const preset = SCHEDULE_PRESETS.find((p) => p.value === r.schedule && p.value !== 'custom');
      if (preset) {
        setSelectedPreset(r.schedule);
      } else {
        setSelectedPreset('custom');
        setCustomCron(r.schedule);
      }
    }).catch(console.warn).finally(() => setLoadingEdit(false));
  }, [isEdit, params.editId]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Give this routine a name.'); return; }
    if (!agentName.trim()) { Alert.alert('Required', 'Select an agent.'); return; }
    if (!prompt.trim()) { Alert.alert('Required', 'Describe what the agent should do.'); return; }

    const finalSchedule = selectedPreset === 'custom' ? customCron.trim() : selectedPreset;
    if (!finalSchedule || !isValidCron(finalSchedule)) {
      Alert.alert('Invalid Schedule', 'Please enter a valid cron expression (e.g. "0 8 * * *").');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        schedule: finalSchedule,
        agentName: agentName.trim(),
        prompt: prompt.trim(),
        enabled,
      };

      if (isEdit && params.editId) {
        await routinesApi.update(params.editId, payload);
      } else {
        await routinesApi.create(payload);
      }
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save routine.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!params.editId) return;
    Alert.alert(
      'Delete Routine',
      `Delete "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await routinesApi.delete(params.editId!);
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to delete routine.');
            }
          },
        },
      ],
    );
  };

  if (loadingEdit) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + Spacing.md }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={12} activeOpacity={0.6}>
          <Text style={[s.backIcon, { color: theme.accent }]}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>{isEdit ? 'Edit Routine' : 'New Routine'}</Text>
        {isEdit && (
          <TouchableOpacity onPress={handleDelete} hitSlop={12} activeOpacity={0.6}>
            <Text style={{ color: theme.error, fontSize: 14, fontWeight: '600' }}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <Text style={s.label}>Name</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="Morning briefing"
          placeholderTextColor={theme.text.secondary}
          returnKeyType="next"
        />

        {/* Description */}
        <Text style={s.label}>Description <Text style={s.optional}>(optional)</Text></Text>
        <TextInput
          style={s.input}
          value={description}
          onChangeText={setDescription}
          placeholder="What does this routine do?"
          placeholderTextColor={theme.text.secondary}
          returnKeyType="next"
        />

        {/* Schedule */}
        <Text style={s.label}>Schedule</Text>
        <View style={s.presetsGrid}>
          {SCHEDULE_PRESETS.map((preset) => {
            const active = selectedPreset === preset.value;
            return (
              <TouchableOpacity
                key={preset.value}
                style={[s.presetChip, active && s.presetChipActive]}
                onPress={() => setSelectedPreset(preset.value)}
                activeOpacity={0.7}
              >
                <Text style={[s.presetChipText, active && s.presetChipTextActive]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedPreset === 'custom' && (
          <>
            <TextInput
              style={[s.input, s.mono]}
              value={customCron}
              onChangeText={setCustomCron}
              placeholder="0 8 * * *"
              placeholderTextColor={theme.text.secondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {customCron.trim() && isValidCron(customCron.trim()) && (
              <Text style={s.cronPreview}>{humanizeCron(customCron.trim())}</Text>
            )}
            {customCron.trim() && !isValidCron(customCron.trim()) && (
              <Text style={[s.cronPreview, { color: theme.error }]}>Invalid cron expression</Text>
            )}
            <Text style={s.hint}>Format: minute hour day-of-month month day-of-week</Text>
          </>
        )}

        {/* Agent selector */}
        <Text style={s.label}>Agent</Text>
        <TouchableOpacity
          style={[s.input, s.picker]}
          onPress={() => setAgentPickerOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={agentName ? s.pickerValue : s.pickerPlaceholder}>
            {agentName || 'Select an agent...'}
          </Text>
          <Text style={s.pickerChevron}>{agentPickerOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {agentPickerOpen && (
          <View style={s.dropdown}>
            {agents.length === 0 ? (
              <Text style={s.dropdownEmpty}>No agents available — connect to your Mac first.</Text>
            ) : (
              agents.map((agent) => (
                <TouchableOpacity
                  key={agent.name}
                  style={[s.dropdownItem, agentName === agent.name && s.dropdownItemActive]}
                  onPress={() => { setAgentName(agent.name); setAgentPickerOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dropdownItemText, agentName === agent.name && { color: theme.accent }]}>
                    {agent.name}
                  </Text>
                  {agent.role ? (
                    <Text style={s.dropdownItemSub}>{agent.role}</Text>
                  ) : null}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Prompt */}
        <Text style={s.label}>What should the agent do?</Text>
        <TextInput
          style={[s.input, s.textarea]}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Summarize my tasks for the day and send a brief to my email..."
          placeholderTextColor={theme.text.secondary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Enabled */}
        <View style={s.toggleRow}>
          <View style={s.toggleInfo}>
            <Text style={s.toggleLabel}>Enable routine</Text>
            <Text style={s.toggleSub}>
              {enabled ? 'Routine will run on schedule' : 'Routine is paused'}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: theme.border, true: theme.accent + '66' }}
            thumbColor={enabled ? theme.accent : theme.text.secondary}
          />
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.saveBtnText}>{isEdit ? 'Save Changes' : 'Create Routine'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    backBtn: { padding: 4, marginRight: 4 },
    backIcon: { fontSize: 30, fontWeight: '300', lineHeight: 32 },
    title: { flex: 1, color: t.text.primary, fontSize: 22, fontWeight: '700' },

    scroll: { padding: Spacing.lg, gap: 4 },

    label: {
      color: t.text.secondary,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: Spacing.md,
      marginBottom: 6,
    },
    optional: { textTransform: 'none', fontWeight: '400' },

    input: {
      backgroundColor: t.surface,
      borderRadius: 14,
      paddingHorizontal: Spacing.md,
      paddingVertical: 13,
      color: t.text.primary,
      fontSize: 15,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
    },
    mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 14 },
    textarea: { minHeight: 100, paddingTop: 13 },

    cronPreview: {
      color: t.accent,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 6,
      marginLeft: 4,
    },
    hint: {
      color: t.text.secondary,
      fontSize: 11,
      marginTop: 4,
      marginLeft: 4,
    },

    presetsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    presetChip: {
      backgroundColor: t.surface,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
    },
    presetChipActive: {
      backgroundColor: t.accent + '22',
      borderColor: t.accent,
    },
    presetChipText: { color: t.text.secondary, fontSize: 13, fontWeight: '500' },
    presetChipTextActive: { color: t.accent, fontWeight: '700' },

    picker: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pickerValue: { color: t.text.primary, fontSize: 15 },
    pickerPlaceholder: { color: t.text.secondary, fontSize: 15 },
    pickerChevron: { color: t.text.secondary, fontSize: 12 },

    dropdown: {
      backgroundColor: t.surface,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      marginTop: 4,
      overflow: 'hidden',
    },
    dropdownItem: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    dropdownItemActive: { backgroundColor: t.accent + '11' },
    dropdownItemText: { color: t.text.primary, fontSize: 15, fontWeight: '500' },
    dropdownItemSub: { color: t.text.secondary, fontSize: 12, marginTop: 2 },
    dropdownEmpty: {
      color: t.text.secondary,
      fontSize: 13,
      padding: Spacing.md,
      textAlign: 'center',
    },

    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surface,
      borderRadius: 14,
      padding: Spacing.md,
      marginTop: Spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
    },
    toggleInfo: { flex: 1 },
    toggleLabel: { color: t.text.primary, fontSize: 15, fontWeight: '600' },
    toggleSub: { color: t.text.secondary, fontSize: 12, marginTop: 2 },

    saveBtn: {
      marginTop: Spacing.xl,
      backgroundColor: t.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      shadowColor: t.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 6,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
