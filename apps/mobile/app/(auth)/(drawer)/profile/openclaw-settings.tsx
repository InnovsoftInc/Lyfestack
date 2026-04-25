import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { openclawApi } from '../../../../services/openclaw.api';

interface OpenClawConfig {
  gateway: { port: number; mode: string; bind: string };
  agentDefaults: { primaryModel: string; fallbackModels: string[] };
  codingTool: string;
}

interface AuthProfile {
  name: string;
  provider: string;
  mode: string;
  maskedKey?: string;
  envVar?: string;
}

const PRESET_MODELS = [
  { id: 'openai-codex/gpt-5.2-codex', label: 'GPT-5.2 Codex' },
  { id: 'openai/gpt-5.2', label: 'GPT-5.2' },
  { id: 'openrouter/auto', label: 'OpenRouter Auto' },
  { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { id: 'anthropic/claude-opus-4-5', label: 'Claude Opus 4.5' },
  { id: 'openrouter/google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'openrouter/meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)' },
  { id: 'ollama/llama3.2:latest', label: 'Ollama Llama 3.2' },
  { id: 'ollama/mistral:latest', label: 'Ollama Mistral' },
];

const CODING_TOOLS = [
  { id: 'auto', label: 'Auto' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
];

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.lg,
      gap: Spacing.md,
    },
    backBtn: { padding: 4 },
    backArrow: { ...TextStyles.h2, color: theme.text.primary, lineHeight: 28 },
    heading: { ...TextStyles.h2, color: theme.text.primary },
    scroll: { flex: 1 },
    section: { marginBottom: Spacing.xl, paddingHorizontal: Spacing.xl },
    sectionLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.md,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      minHeight: 52,
    },
    rowLeft: { flex: 1, gap: 2 },
    rowLabel: { ...TextStyles.bodyMedium, color: theme.text.primary },
    rowSub: { ...TextStyles.caption, color: theme.text.secondary },
    rowValue: { ...TextStyles.small, color: theme.text.secondary, maxWidth: 180, textAlign: 'right' },
    rowArrow: { ...TextStyles.h4, color: theme.text.secondary, marginLeft: Spacing.sm },
    divider: { height: 1, backgroundColor: theme.border, marginLeft: Spacing.md },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center' },
    // Segmented control
    segmented: {
      flexDirection: 'row',
      backgroundColor: theme.border,
      borderRadius: BorderRadius.md,
      padding: 2,
    },
    segment: {
      flex: 1,
      paddingVertical: 7,
      alignItems: 'center',
      borderRadius: BorderRadius.sm,
    },
    segmentActive: { backgroundColor: theme.surface },
    segmentLabel: { ...TextStyles.small, color: theme.text.secondary },
    segmentLabelActive: { color: theme.text.primary, fontWeight: '600' },
    // Tag list (fallback models)
    tagRow: { flexWrap: 'wrap', flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.border,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 5,
      gap: 6,
    },
    tagLabel: { ...TextStyles.small, color: theme.text.primary },
    tagRemove: { ...TextStyles.small, color: theme.text.secondary },
    addTag: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 5,
      gap: 4,
    },
    addTagLabel: { ...TextStyles.small, color: Colors.accent },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 40,
      maxHeight: '70%',
    },
    modalHandle: {
      width: 36,
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    modalTitle: {
      ...TextStyles.h4,
      color: theme.text.primary,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
    },
    modalItem: {
      paddingHorizontal: Spacing.xl,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    modalItemLabel: { ...TextStyles.body, color: theme.text.primary },
    modalItemCheck: { ...TextStyles.body, color: Colors.accent },
    modalDivider: { height: 1, backgroundColor: theme.border, marginLeft: Spacing.xl },
    // Key edit modal
    keyModalContent: { padding: Spacing.xl, gap: Spacing.md },
    keyInput: {
      backgroundColor: theme.background,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      ...TextStyles.body,
      color: theme.text.primary,
      fontFamily: 'monospace',
    },
    keyModalBtns: { flexDirection: 'row', gap: Spacing.md },
    keyModalBtn: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    keyModalBtnPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
    keyModalBtnLabel: { ...TextStyles.bodyMedium, color: theme.text.secondary },
    keyModalBtnLabelPrimary: { color: Colors.white },
    loader: { padding: Spacing.xl },
  });
}

type ModalMode =
  | { type: 'none' }
  | { type: 'primaryModel' }
  | { type: 'addFallback' }
  | { type: 'editKey'; profile: AuthProfile };

export default function OpenClawSettingsScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const [config, setConfig] = useState<OpenClawConfig | null>(null);
  const [profiles, setProfiles] = useState<AuthProfile[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalMode>({ type: 'none' });
  const [keyInput, setKeyInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, profRes, statusRes] = await Promise.all([
        openclawApi.getConfig() as Promise<{ data: OpenClawConfig }>,
        openclawApi.getAuthProfiles() as Promise<{ data: AuthProfile[] }>,
        openclawApi.getStatus() as Promise<{ data: { running: boolean } }>,
      ]);
      setConfig(cfgRes.data);
      setProfiles(profRes.data);
      setConnected(statusRes.data.running);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function patchConfig(updates: Partial<Parameters<typeof openclawApi.updateConfig>[0]>) {
    if (!config) return;
    setSaving(true);
    try {
      await openclawApi.updateConfig(updates);
      const res = await openclawApi.getConfig() as { data: OpenClawConfig };
      setConfig(res.data);
    } catch {
      Alert.alert('Error', 'Failed to save setting.');
    } finally {
      setSaving(false);
    }
  }

  async function saveKey(profile: AuthProfile, key: string) {
    setSaving(true);
    try {
      await openclawApi.updateAuthProfile(profile.name, key);
      const res = await openclawApi.getAuthProfiles() as { data: AuthProfile[] };
      setProfiles(res.data);
    } catch {
      Alert.alert('Error', 'Failed to update API key.');
    } finally {
      setSaving(false);
      setModal({ type: 'none' });
    }
  }

  function removeFallback(model: string) {
    if (!config) return;
    const fallbacks = config.agentDefaults.fallbackModels.filter((m) => m !== model);
    void patchConfig({ agentDefaults: { fallbackModels: fallbacks } });
  }

  function addFallback(model: string) {
    if (!config) return;
    if (config.agentDefaults.fallbackModels.includes(model)) return;
    const fallbacks = [...config.agentDefaults.fallbackModels, model];
    void patchConfig({ agentDefaults: { fallbackModels: fallbacks } });
    setModal({ type: 'none' });
  }

  const gatewayUrl = config
    ? `http://localhost:${config.gateway.port}`
    : '—';

  const primaryModelLabel =
    PRESET_MODELS.find((m) => m.id === config?.agentDefaults.primaryModel)?.label ??
    config?.agentDefaults.primaryModel ??
    '—';

  const availableFallbacks = PRESET_MODELS.filter(
    (m) =>
      m.id !== config?.agentDefaults.primaryModel &&
      !config?.agentDefaults.fallbackModels.includes(m.id),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>OpenClaw Settings</Text>
        {saving && <ActivityIndicator size="small" color={Colors.accent} />}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={styles.loader} />
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* CONNECTION */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CONNECTION</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowLabel}>Gateway URL</Text>
                </View>
                <Text style={styles.rowValue}>{gatewayUrl}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowLabel}>Mode</Text>
                </View>
                <Text style={styles.rowValue}>{config?.gateway.mode ?? '—'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowLabel}>Status</Text>
                </View>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: connected ? Colors.accent : Colors.error },
                    ]}
                  />
                  <Text style={styles.rowValue}>
                    {connected === null ? 'Checking…' : connected ? 'Connected' : 'Offline'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* DEFAULT MODEL */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DEFAULT MODEL</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => setModal({ type: 'primaryModel' })}
                activeOpacity={0.7}
              >
                <View style={styles.rowLeft}>
                  <Text style={styles.rowLabel}>Primary Model</Text>
                  <Text style={styles.rowSub}>Used for new agents and tasks</Text>
                </View>
                <Text style={styles.rowValue} numberOfLines={1}>{primaryModelLabel}</Text>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* FALLBACK MODELS */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FALLBACK MODELS</Text>
            <View style={styles.card}>
              <View style={styles.tagRow}>
                {config?.agentDefaults.fallbackModels.map((model) => (
                  <View key={model} style={styles.tag}>
                    <Text style={styles.tagLabel} numberOfLines={1}>
                      {PRESET_MODELS.find((m) => m.id === model)?.label ?? model}
                    </Text>
                    <TouchableOpacity onPress={() => removeFallback(model)} hitSlop={8}>
                      <Text style={styles.tagRemove}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {availableFallbacks.length > 0 && (
                  <TouchableOpacity
                    style={styles.addTag}
                    onPress={() => setModal({ type: 'addFallback' })}
                  >
                    <Text style={styles.addTagLabel}>+ Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* CODING TOOL */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CODING TOOL</Text>
            <View style={styles.card}>
              <View style={[styles.row, { paddingVertical: Spacing.md }]}>
                <View style={styles.segmented}>
                  {CODING_TOOLS.map((tool) => {
                    const active = (config?.codingTool ?? 'auto') === tool.id;
                    return (
                      <TouchableOpacity
                        key={tool.id}
                        style={[styles.segment, active && styles.segmentActive]}
                        onPress={() => void patchConfig({ codingTool: tool.id })}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                          {tool.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

          {/* API KEYS */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>API KEYS</Text>
            <View style={styles.card}>
              {profiles.length === 0 ? (
                <View style={styles.row}>
                  <Text style={styles.rowValue}>No profiles configured</Text>
                </View>
              ) : (
                profiles.map((profile, idx) => (
                  <View key={profile.name}>
                    {idx > 0 && <View style={styles.divider} />}
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => {
                        setKeyInput('');
                        setModal({ type: 'editKey', profile });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.rowLeft}>
                        <Text style={styles.rowLabel}>
                          {profile.provider.charAt(0).toUpperCase() + profile.provider.slice(1)}
                        </Text>
                        <Text style={styles.rowSub}>{profile.name}</Text>
                      </View>
                      <Text style={styles.rowValue} numberOfLines={1}>
                        {profile.maskedKey ?? (profile.mode === 'token' ? 'OAuth token' : 'Not set')}
                      </Text>
                      <Text style={styles.rowArrow}>›</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
              <View style={styles.divider} />
              {/* Add missing providers */}
              {!profiles.find(p => p.name === 'openai:default') && (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    setKeyInput('');
                    setModal({ type: 'editKey', profile: { name: 'openai:default', provider: 'openai', mode: 'api_key' } });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowLeft}>
                    <Text style={[styles.rowLabel, { color: Colors.accent }]}>+ Add OpenAI Key</Text>
                  </View>
                  <Text style={styles.rowValue}>Not configured</Text>
                  <Text style={styles.rowArrow}>›</Text>
                </TouchableOpacity>
              )}
              {!profiles.find(p => p.name === 'openrouter:default') && (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    setKeyInput('');
                    setModal({ type: 'editKey', profile: { name: 'openrouter:default', provider: 'openrouter', mode: 'api_key' } });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowLeft}>
                    <Text style={[styles.rowLabel, { color: Colors.accent }]}>+ Add OpenRouter Key</Text>
                  </View>
                  <Text style={styles.rowValue}>Not configured</Text>
                  <Text style={styles.rowArrow}>›</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* AGENT DEFAULTS */}
          <View style={[styles.section, { marginBottom: 60 }]}>
            <Text style={styles.sectionLabel}>AGENT DEFAULTS</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowLabel}>Default Model</Text>
                </View>
                <Text style={styles.rowValue} numberOfLines={1}>{primaryModelLabel}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowLabel}>Fallback Count</Text>
                </View>
                <Text style={styles.rowValue}>
                  {config?.agentDefaults.fallbackModels.length ?? 0} model
                  {config?.agentDefaults.fallbackModels.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>

        </ScrollView>
      )}

      {/* PRIMARY MODEL PICKER */}
      <Modal
        visible={modal.type === 'primaryModel'}
        transparent
        animationType="slide"
        onRequestClose={() => setModal({ type: 'none' })}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModal({ type: 'none' })}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Primary Model</Text>
            <FlatList
              data={PRESET_MODELS}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={styles.modalDivider} />}
              renderItem={({ item }) => {
                const selected = config?.agentDefaults.primaryModel === item.id;
                return (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      void patchConfig({ agentDefaults: { primaryModel: item.id } });
                      setModal({ type: 'none' });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalItemLabel}>{item.label}</Text>
                    {selected && <Text style={styles.modalItemCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ADD FALLBACK PICKER */}
      <Modal
        visible={modal.type === 'addFallback'}
        transparent
        animationType="slide"
        onRequestClose={() => setModal({ type: 'none' })}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModal({ type: 'none' })}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Fallback Model</Text>
            <FlatList
              data={availableFallbacks}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={styles.modalDivider} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => addFallback(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalItemLabel}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* EDIT API KEY */}
      <Modal
        visible={modal.type === 'editKey'}
        transparent
        animationType="slide"
        onRequestClose={() => setModal({ type: 'none' })}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModal({ type: 'none' })}
        >
          <View style={[styles.modalSheet, { paddingBottom: 60 }]}>
            <View style={styles.modalHandle} />
            {modal.type === 'editKey' && (
              <>
                <Text style={styles.modalTitle}>
                  Update {modal.profile.provider.charAt(0).toUpperCase() + modal.profile.provider.slice(1)} Key
                </Text>
                <View style={styles.keyModalContent}>
                  <TextInput
                    style={styles.keyInput}
                    value={keyInput}
                    onChangeText={setKeyInput}
                    placeholder={modal.profile.maskedKey ?? 'Paste API key…'}
                    placeholderTextColor={theme.text.secondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                  />
                  <View style={styles.keyModalBtns}>
                    <TouchableOpacity
                      style={styles.keyModalBtn}
                      onPress={() => setModal({ type: 'none' })}
                    >
                      <Text style={styles.keyModalBtnLabel}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.keyModalBtn, styles.keyModalBtnPrimary]}
                      onPress={() => {
                        if (keyInput.trim()) void saveKey(modal.profile, keyInput.trim());
                      }}
                      disabled={!keyInput.trim() || saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color={Colors.white} />
                      ) : (
                        <Text style={styles.keyModalBtnLabelPrimary}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
