import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { DarkTheme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { useOpenClawStore } from '../../../../stores/openclaw.store';
import * as api from '../../../../services/openclaw.api';

const ROLES = ['developer', 'marketing', 'research', 'pm', 'custom'] as const;
type Role = (typeof ROLES)[number];

const MODELS = [
  { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'openrouter/auto', label: 'Auto (best available)' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
] as const;

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CreateAgentScreen() {
  const { fetchAgents } = useOpenClawStore();

  const [agentId, setAgentId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('developer');
  const [model, setModel] = useState(MODELS[0].id);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const idError =
    agentId && !/^[a-z0-9-]+$/.test(agentId)
      ? 'Lowercase letters, numbers, and hyphens only'
      : null;

  const handleCreate = async () => {
    if (!agentId.trim() || idError) return;
    setIsCreating(true);
    try {
      await api.createAgent({
        id: agentId.trim(),
        name: name.trim() || agentId.trim(),
        role,
        systemPrompt: systemPrompt.trim() || undefined,
      });
      await fetchAgents();
      router.back();
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Text style={styles.label}>Agent ID *</Text>
          <TextInput
            style={[styles.input, idError ? styles.inputError : null]}
            value={agentId}
            onChangeText={(t) => setAgentId(t.toLowerCase())}
            placeholder="e.g. my-developer"
            placeholderTextColor={DarkTheme.text.secondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {idError && <Text style={styles.fieldError}>{idError}</Text>}
          <Text style={styles.hint}>Used to identify the agent — cannot be changed later</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. My Developer"
            placeholderTextColor={DarkTheme.text.secondary}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Role</Text>
          <View style={styles.chipRow}>
            {ROLES.map((r) => (
              <Chip
                key={r}
                label={r.charAt(0).toUpperCase() + r.slice(1)}
                selected={role === r}
                onPress={() => setRole(r)}
              />
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Model</Text>
          {MODELS.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.modelRow, model === m.id && styles.modelRowSelected]}
              onPress={() => setModel(m.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.radio, model === m.id && styles.radioSelected]} />
              <Text style={styles.modelLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>System Prompt</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={systemPrompt}
            onChangeText={setSystemPrompt}
            placeholder="Describe what this agent should do…"
            placeholderTextColor={DarkTheme.text.secondary}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.createBtn, (!agentId.trim() || !!idError || isCreating) && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!agentId.trim() || !!idError || isCreating}
          activeOpacity={0.8}
        >
          {isCreating ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.createBtnText}>Create Agent</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DarkTheme.background },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: 40 },
  field: { gap: Spacing.sm },
  label: { ...TextStyles.bodyMedium, color: DarkTheme.text.primary, fontWeight: '600' },
  hint: { ...TextStyles.caption, color: DarkTheme.text.secondary },
  input: {
    ...TextStyles.body,
    color: DarkTheme.text.primary,
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  inputError: { borderColor: Colors.error },
  fieldError: { ...TextStyles.caption, color: Colors.error },
  textarea: { height: 120, paddingTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: DarkTheme.surface,
    borderWidth: 1,
    borderColor: DarkTheme.border,
  },
  chipSelected: { backgroundColor: 'rgba(99,102,241,0.15)', borderColor: Colors.accent },
  chipText: { ...TextStyles.small, color: DarkTheme.text.secondary },
  chipTextSelected: { color: Colors.accent, fontWeight: '600' },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    backgroundColor: DarkTheme.surface,
  },
  modelRowSelected: { borderColor: Colors.accent, backgroundColor: 'rgba(99,102,241,0.08)' },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: DarkTheme.border,
  },
  radioSelected: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  modelLabel: { ...TextStyles.body, color: DarkTheme.text.primary },
  createBtn: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { ...TextStyles.bodyMedium, color: Colors.white, fontWeight: '700' },
});
