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

const PRESET_PATHS = ['gmail', 'calendly', 'stripe', 'slack', 'github', 'typeform'];

const MODEL_OPTIONS = [
  { label: 'Gemini Flash Lite', value: 'openrouter/google/gemini-2.5-flash-lite' },
  { label: 'Mistral (local)', value: 'ollama/mistral:latest' },
  { label: 'Llama 3.3 70B', value: 'openrouter/meta-llama/llama-3.3-70b-instruct:free' },
  { label: 'Claude Haiku', value: 'anthropic/claude-haiku-4-5-20251001' },
];

const CHANNEL_OPTIONS = [
  { label: '📱 Telegram', value: 'telegram' },
  { label: '💬 Slack', value: 'slack' },
];

const TEMPLATE_MESSAGES = [
  'Check if this is a lead reply. If yes, alert here and add a follow-up task.',
  'Generate a pre-call research brief for this booking.',
  'Summarize this event and determine if any action is needed.',
  'Log this event and create a task if follow-up is required.',
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
  });
}

export default function CreateHookScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { create } = useAutomationsStore();
  const { agents } = useOpenClawStore();

  const [name, setName] = useState('');
  const [triggerPath, setTriggerPath] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.name ?? '');
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS[0]!.value);
  const [selectedChannel, setSelectedChannel] = useState<'telegram' | 'slack'>('telegram');
  const [deliver, setDeliver] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSave = name.trim().length > 0 && triggerPath.trim().length > 0 && messageTemplate.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await create({
        name: name.trim(),
        triggerPath: triggerPath.trim(),
        messageTemplate: messageTemplate.trim(),
        agentName: selectedAgent || undefined,
        model: selectedModel,
        channel: selectedChannel,
        deliver,
      });
      router.back();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create hook');
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
        <Text style={styles.headerTitle}>New Hook</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Hooks trigger your agent when OpenClaw receives a webhook — e.g. a new Gmail email, Calendly booking, or Stripe payment.
          </Text>
        </View>

        {/* Name */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Hook Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Gmail Lead Reply"
            placeholderTextColor={theme.text.secondary}
          />
        </View>

        {/* Trigger Path */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Trigger Path</Text>
          <Text style={styles.fieldHint}>Webhook path that activates this hook (e.g. "gmail", "stripe")</Text>
          <TextInput
            style={styles.input}
            value={triggerPath}
            onChangeText={(t) => setTriggerPath(t.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            placeholder="e.g. gmail"
            placeholderTextColor={theme.text.secondary}
            autoCapitalize="none"
          />
          <View style={styles.chips}>
            {PRESET_PATHS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, triggerPath === p && styles.chipActive]}
                onPress={() => setTriggerPath(p)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, triggerPath === p && styles.chipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Message Template */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Message Template</Text>
          <Text style={styles.fieldHint}>What the agent receives when this hook fires. Use {'{{payload.field}}'} for dynamic values.</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={messageTemplate}
            onChangeText={setMessageTemplate}
            placeholder="e.g. Check if this is a lead reply. If yes, alert here and add a follow-up task."
            placeholderTextColor={theme.text.secondary}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.fieldLabel}>Quick templates</Text>
          <View style={styles.chips}>
            {TEMPLATE_MESSAGES.map((t) => (
              <TouchableOpacity
                key={t}
                style={styles.templateBtn}
                onPress={() => setMessageTemplate(t)}
                activeOpacity={0.7}
              >
                <Text style={styles.templateBtnText}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Agent (optional) */}
        {agents.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Agent (optional)</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, !selectedAgent && styles.chipActive]}
                onPress={() => setSelectedAgent('')}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, !selectedAgent && styles.chipTextActive]}>Default</Text>
              </TouchableOpacity>
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
          </View>
        )}

        {/* Model */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Model</Text>
          <View style={styles.chips}>
            {MODEL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, selectedModel === opt.value && styles.chipActive]}
                onPress={() => setSelectedModel(opt.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selectedModel === opt.value && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Channel */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Deliver to Channel</Text>
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
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Send response to channel</Text>
            <Switch
              value={deliver}
              onValueChange={setDeliver}
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
              Create Hook
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
