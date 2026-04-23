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
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { useOpenAIStore } from '../../../../stores/openai.store';
import { OPENAI_FEATURES, type OpenAIFeature } from '../../../../services/openai.api';

const FEATURE_LABELS: Record<OpenAIFeature, { label: string; subtitle: string }> = {
  voice:        { label: 'Realtime voice',  subtitle: 'Hands-free console (gpt-4o-realtime)' },
  tts:          { label: 'Text-to-speech',   subtitle: 'Read briefs and replies aloud' },
  whisper:      { label: 'Speech-to-text',   subtitle: 'Voice memos → automation drafts' },
  vision:       { label: 'Vision',           subtitle: 'Analyze images, screenshots, media' },
  embeddings:   { label: 'Embeddings',       subtitle: 'Semantic search across sessions/skills' },
  moderation:   { label: 'Moderation',       subtitle: 'Pre-check input for unsafe content' },
  summary:      { label: 'Summaries',        subtitle: 'Brief AI summaries (logs, runs, pushes)' },
  orchestrator: { label: 'NL orchestrator',  subtitle: 'Function-calling over OpenClaw API' },
  batch:        { label: 'Nightly batch',    subtitle: 'Async daily report into your brief' },
};

function inferKind(modelId: string): OpenAIFeature[] {
  const id = modelId.toLowerCase();
  if (id.includes('whisper')) return ['whisper'];
  if (id.includes('tts') || id.includes('audio-')) return ['tts'];
  if (id.includes('realtime')) return ['voice'];
  if (id.includes('embedding')) return ['embeddings'];
  if (id.includes('moderation')) return ['moderation'];
  if (id.includes('vision') || id === 'gpt-4o' || id.startsWith('gpt-4o-mini') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('gpt-4.1') || id.startsWith('gpt-5'))
    return ['vision', 'summary', 'orchestrator', 'batch'];
  if (id.startsWith('gpt-')) return ['summary', 'orchestrator', 'batch'];
  return ['summary', 'orchestrator', 'batch'];
}

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
      minHeight: 60,
    },
    rowLeft: { flex: 1, gap: 2, paddingRight: Spacing.md },
    rowLabel: { ...TextStyles.bodyMedium, color: theme.text.primary },
    rowSub: { ...TextStyles.caption, color: theme.text.secondary },
    rowValue: { ...TextStyles.small, color: theme.text.secondary, maxWidth: 160, textAlign: 'right' },
    rowArrow: { ...TextStyles.h4, color: theme.text.secondary, marginLeft: Spacing.sm },
    divider: { height: 1, backgroundColor: theme.border, marginLeft: Spacing.md },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    statusRow: { flexDirection: 'row', alignItems: 'center' },
    inlineActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    testBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    testBtnLabel: { ...TextStyles.small, color: Colors.accent, fontWeight: '600' },
    testResult: { ...TextStyles.small, color: theme.text.secondary, marginTop: 4 },
    budgetInput: {
      width: 90,
      backgroundColor: theme.background,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      ...TextStyles.body,
      color: theme.text.primary,
      textAlign: 'right',
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 40,
      maxHeight: '80%',
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
    modalSearch: {
      marginHorizontal: Spacing.xl,
      backgroundColor: theme.background,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      ...TextStyles.body,
      color: theme.text.primary,
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
    loader: { padding: Spacing.xl },
  });
}

type ModalMode =
  | { type: 'none' }
  | { type: 'pickDefault' }
  | { type: 'pickFeature'; feature: OpenAIFeature };

export default function OpenAISettingsScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const { config, models, loading, saving, error, testResults, load, reloadModels, patch, test } =
    useOpenAIStore();

  const [modal, setModal] = useState<ModalMode>({ type: 'none' });
  const [search, setSearch] = useState('');
  const [budgetDraft, setBudgetDraft] = useState<{ daily: string; monthly: string }>({ daily: '', monthly: '' });

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (config) {
      setBudgetDraft({
        daily: String(config.budget.dailyUsd),
        monthly: String(config.budget.monthlyUsd),
      });
    }
  }, [config?.budget.dailyUsd, config?.budget.monthlyUsd]);

  const filteredModels = useMemo(() => {
    if (modal.type === 'none') return [];
    const q = search.trim().toLowerCase();
    const matchesFeature = modal.type === 'pickFeature'
      ? (id: string) => inferKind(id).includes(modal.feature)
      : () => true;
    return models
      .filter((m) => matchesFeature(m.id))
      .filter((m) => !q || m.id.toLowerCase().includes(q));
  }, [models, modal, search]);

  function openPickFeature(feature: OpenAIFeature) {
    setSearch('');
    setModal({ type: 'pickFeature', feature });
  }
  function openPickDefault() {
    setSearch('');
    setModal({ type: 'pickDefault' });
  }
  function close() { setModal({ type: 'none' }); }

  async function selectModel(modelId: string) {
    if (!config) return;
    try {
      if (modal.type === 'pickDefault') {
        await patch({ defaultModel: modelId });
      } else if (modal.type === 'pickFeature') {
        await patch({ features: { [modal.feature]: { model: modelId } } });
      }
      close();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Could not save model selection.');
    }
  }

  async function saveBudget() {
    const daily = Number(budgetDraft.daily);
    const monthly = Number(budgetDraft.monthly);
    if (Number.isNaN(daily) || daily < 0 || Number.isNaN(monthly) || monthly < 0) {
      Alert.alert('Invalid budget', 'Daily and monthly limits must be non-negative numbers.');
      return;
    }
    try {
      await patch({ budget: { dailyUsd: daily, monthlyUsd: monthly } });
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Could not save budget.');
    }
  }

  async function toggleHardStop(value: boolean) {
    try { await patch({ budget: { hardStop: value } }); }
    catch (err: any) { Alert.alert('Save failed', err?.message ?? 'Could not toggle hard stop.'); }
  }

  if (loading || !config) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
          <Text style={styles.heading}>OpenAI Settings</Text>
        </View>
        <ActivityIndicator style={styles.loader} color={Colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
        <Text style={styles.heading}>OpenAI Settings</Text>
        {saving ? <ActivityIndicator color={Colors.accent} /> : null}
      </View>

      {error ? (
        <View style={[styles.section]}>
          <Text style={{ color: theme.error }}>{error}</Text>
        </View>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Connection</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>API key</Text>
                <Text style={styles.rowSub}>{config.apiKeySource}</Text>
              </View>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: config.hasApiKey ? '#22C55E' : '#EF4444' }]} />
                <Text style={styles.rowValue}>{config.hasApiKey ? 'Connected' : 'Missing'}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={openPickDefault} activeOpacity={0.7}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>Global default model</Text>
                <Text style={styles.rowSub}>Used as fallback for any feature without an override</Text>
              </View>
              <Text style={styles.rowValue} numberOfLines={1}>{config.defaultModel}</Text>
              <Text style={styles.rowArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={() => reloadModels(true)} activeOpacity={0.7}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>Refresh model catalogue</Text>
                <Text style={styles.rowSub}>{models.length} models cached</Text>
              </View>
              <Text style={styles.rowArrow}>↻</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Per-feature models</Text>
          <View style={styles.card}>
            {OPENAI_FEATURES.map((feature, idx) => {
              const cfg = config.features[feature];
              const labelInfo = FEATURE_LABELS[feature];
              const last = testResults[feature];
              return (
                <View key={feature}>
                  {idx > 0 ? <View style={styles.divider} /> : null}
                  <View style={styles.row}>
                    <View style={styles.rowLeft}>
                      <Text style={styles.rowLabel}>{labelInfo.label}</Text>
                      <Text style={styles.rowSub}>{labelInfo.subtitle}</Text>
                      {last?.error ? <Text style={[styles.testResult, { color: theme.error }]}>✗ {last.error}</Text> : null}
                      {last?.result ? (
                        <Text style={styles.testResult}>
                          ✓ {last.result.model}
                          {last.result.sample ? ` · "${last.result.sample.slice(0, 30)}"` : ''}
                          {last.result.dimensions ? ` · ${last.result.dimensions}d` : ''}
                          {last.result.note ? ` · ${last.result.note}` : ''}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.inlineActions}>
                      <TouchableOpacity onPress={() => test(feature)} style={styles.testBtn} activeOpacity={0.6}>
                        <Text style={styles.testBtnLabel}>Test</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => openPickFeature(feature)} activeOpacity={0.6} style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.rowValue, { maxWidth: 140 }]} numberOfLines={1}>{cfg.model}</Text>
                        {cfg.voice ? <Text style={styles.rowSub}>voice: {cfg.voice}</Text> : null}
                      </TouchableOpacity>
                      <Text style={styles.rowArrow}>›</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Budget</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>Daily limit (USD)</Text>
                <Text style={styles.rowSub}>0 = unlimited</Text>
              </View>
              <TextInput
                style={styles.budgetInput}
                value={budgetDraft.daily}
                onChangeText={(t) => setBudgetDraft((d) => ({ ...d, daily: t }))}
                onBlur={saveBudget}
                keyboardType="decimal-pad"
                placeholder="5"
                placeholderTextColor={theme.text.secondary}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>Monthly limit (USD)</Text>
                <Text style={styles.rowSub}>0 = unlimited</Text>
              </View>
              <TextInput
                style={styles.budgetInput}
                value={budgetDraft.monthly}
                onChangeText={(t) => setBudgetDraft((d) => ({ ...d, monthly: t }))}
                onBlur={saveBudget}
                keyboardType="decimal-pad"
                placeholder="50"
                placeholderTextColor={theme.text.secondary}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>Hard stop when exceeded</Text>
                <Text style={styles.rowSub}>Block new requests instead of warning</Text>
              </View>
              <Switch value={config.budget.hardStop} onValueChange={toggleHardStop} />
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={modal.type !== 'none'} transparent animationType="slide" onRequestClose={close}>
        <TouchableOpacity activeOpacity={1} style={styles.modalOverlay} onPress={close}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {modal.type === 'pickDefault' ? 'Default model' : modal.type === 'pickFeature' ? `Model for ${FEATURE_LABELS[modal.feature].label}` : ''}
            </Text>
            <TextInput
              style={styles.modalSearch}
              placeholder="Search models…"
              placeholderTextColor={theme.text.secondary}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <FlatList
              data={filteredModels}
              keyExtractor={(m) => m.id}
              ItemSeparatorComponent={() => <View style={styles.modalDivider} />}
              renderItem={({ item }) => {
                const currentModel = modal.type === 'pickDefault'
                  ? config.defaultModel
                  : modal.type === 'pickFeature' ? config.features[modal.feature].model : '';
                const selected = item.id === currentModel;
                return (
                  <TouchableOpacity style={styles.modalItem} onPress={() => selectModel(item.id)} activeOpacity={0.6}>
                    <Text style={styles.modalItemLabel}>{item.id}</Text>
                    {selected ? <Text style={styles.modalItemCheck}>✓</Text> : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                  <Text style={{ color: theme.text.secondary }}>
                    {models.length === 0 ? 'No models cached yet — tap Refresh on the previous screen.' : 'No matches.'}
                  </Text>
                </View>
              }
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
