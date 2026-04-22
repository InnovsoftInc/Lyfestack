import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Switch,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useOpenClawStore } from '../../../../stores/openclaw.store';
import { useTheme } from '../../../../hooks/useTheme';
import { Spacing } from '../../../../theme';
import type { Theme } from '../../../../theme';
import { AgentAvatar } from './index';

const ROLES = ['Developer', 'Marketing', 'Research', 'PM', 'Writer', 'Analyst', 'Support', 'Custom'];
const TRAITS = ['Analytical', 'Creative', 'Direct', 'Friendly', 'Precise', 'Witty', 'Empathetic', 'Strategic', 'Thorough', 'Bold'];
const TONES = ['Professional', 'Casual', 'Technical', 'Simple', 'Formal', 'Conversational'];
const MODELS = ['openrouter/auto', 'anthropic/claude-sonnet-4-6', 'openai/gpt-4o', 'anthropic/claude-haiku-4-5', 'openai/gpt-4o-mini'];

const STEPS = ['Name & Role', 'Responsibilities', 'Personality', 'Review'];

function buildPrompt(role: string, desc: string, scope: string, traits: string[], tone: string): string {
  const parts: string[] = [];
  if (desc) parts.push(`# About\n${desc}`);
  if (role) parts.push(`# Role\n${role}`);
  if (scope) parts.push(`# Responsibilities\n${scope}`);
  if (traits.length) parts.push(`# Personality Traits\n${traits.join(', ')}`);
  if (tone) parts.push(`# Communication Style\nCommunicate in a ${tone.toLowerCase()} tone.`);
  return parts.join('\n\n');
}

export default function CreateAgentScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = styles(theme);
  const { createAgent } = useOpenClawStore();

  const [advancedMode, setAdvancedMode] = useState(false);
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [model, setModel] = useState('openrouter/auto');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState('');
  const [traits, setTraits] = useState<string[]>([]);
  const [tone, setTone] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');

  const slugName = name.trim().toLowerCase().replace(/\s+/g, '-');
  const toggleTrait = (t: string) =>
    setTraits((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const canNext = step === 0 ? name.trim().length > 0 && role.length > 0 : true;

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const prompt = advancedMode ? systemPrompt : buildPrompt(role, description, scope, traits, tone);
      await createAgent({ name: slugName, role, model, systemPrompt: prompt });
      router.back();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create agent');
      setCreating(false);
    }
  };

  return (
    <View style={s.container}>
      {/* Modal handle */}
      <View style={s.handleWrap}>
        <View style={s.handle} />
      </View>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6}>
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>New Agent</Text>
        <View style={s.modeToggleWrap}>
          <Text style={s.modeToggleLabel}>Advanced</Text>
          <Switch
            value={advancedMode}
            onValueChange={setAdvancedMode}
            trackColor={{ false: theme.border, true: theme.accent + '99' }}
            thumbColor={advancedMode ? theme.accent : theme.text.secondary}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>
      </View>

      {advancedMode ? (
        /* ── Advanced mode ─────────────────────────── */
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <Text style={s.fieldLabel}>Agent Name</Text>
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. content-writer" placeholderTextColor={theme.text.secondary} autoCapitalize="none" />
          </View>

          <View style={s.card}>
            <Text style={s.fieldLabel}>Role</Text>
            <View style={s.chips}>
              {ROLES.map((r) => (
                <TouchableOpacity key={r} style={[s.chip, role === r && s.chipActive]} onPress={() => setRole(r)} activeOpacity={0.7}>
                  <Text style={[s.chipText, role === r && s.chipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.fieldLabel}>Model</Text>
            <View style={s.chips}>
              {MODELS.map((m) => (
                <TouchableOpacity key={m} style={[s.chip, model === m && s.chipActive]} onPress={() => setModel(m)} activeOpacity={0.7}>
                  <Text style={[s.chipText, model === m && s.chipTextActive]}>{m.split('/')[1]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.fieldLabel}>System Prompt</Text>
            <TextInput style={[s.input, s.promptEditor]} value={systemPrompt} onChangeText={setSystemPrompt} placeholder={'# Role\nYou are a...'} placeholderTextColor={theme.text.secondary} multiline textAlignVertical="top" autoCapitalize="none" autoCorrect={false} />
          </View>

          {error ? <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View> : null}

          <TouchableOpacity style={[s.primaryBtn, (!name.trim() || !role || creating) && s.primaryBtnOff]} onPress={handleCreate} disabled={!name.trim() || !role || creating} activeOpacity={0.85}>
            {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryBtnText}>Create Agent</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        /* ── Wizard mode ───────────────────────────── */
        <View style={{ flex: 1 }}>
          {/* Step indicator */}
          <View style={s.stepBar}>
            {STEPS.map((label, i) => (
              <View key={label} style={s.stepItem}>
                <View style={[s.stepDot, i < step && s.stepDone, i === step && s.stepCurrent]}>
                  <Text style={[s.stepDotText, i <= step && s.stepDotTextActive]}>{i < step ? '✓' : String(i + 1)}</Text>
                </View>
                <Text style={[s.stepLabel, i === step && s.stepLabelActive]}>{label}</Text>
              </View>
            ))}
            <View style={s.stepLine} />
          </View>

          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            {/* Step 0 */}
            {step === 0 && (
              <View style={s.stepSection}>
                <Text style={s.stepHeading}>Let's create your agent</Text>
                <Text style={s.stepSubheading}>Give them a name and pick their role.</Text>

                {name.trim() && (
                  <View style={s.previewAvatar}>
                    <AgentAvatar name={slugName || 'agent'} size={72} />
                    <Text style={s.previewSlug}>{slugName || 'agent'}</Text>
                  </View>
                )}

                <View style={s.card}>
                  <Text style={s.fieldLabel}>Agent Name</Text>
                  <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. content-writer, sales-bot" placeholderTextColor={theme.text.secondary} autoCapitalize="none" />
                  <Text style={s.fieldHint}>Lowercase with dashes. This is their unique ID.</Text>
                </View>

                <View style={s.card}>
                  <Text style={s.fieldLabel}>Role</Text>
                  <View style={s.chips}>
                    {ROLES.map((r) => (
                      <TouchableOpacity key={r} style={[s.chip, role === r && s.chipActive]} onPress={() => setRole(r)} activeOpacity={0.7}>
                        <Text style={[s.chipText, role === r && s.chipTextActive]}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={s.card}>
                  <Text style={s.fieldLabel}>Model</Text>
                  <View style={s.chips}>
                    {MODELS.map((m) => (
                      <TouchableOpacity key={m} style={[s.chip, model === m && s.chipActive]} onPress={() => setModel(m)} activeOpacity={0.7}>
                        <Text style={[s.chipText, model === m && s.chipTextActive]}>{m.split('/')[1]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Step 1 */}
            {step === 1 && (
              <View style={s.stepSection}>
                <Text style={s.stepHeading}>What will {name || 'this agent'} do?</Text>
                <Text style={s.stepSubheading}>Define their scope so they know exactly what's in their domain.</Text>

                <View style={s.card}>
                  <Text style={s.fieldLabel}>Brief description</Text>
                  <TextInput style={[s.input, s.textarea]} value={description} onChangeText={setDescription} placeholder={`A quick intro for ${name || 'this agent'}...`} placeholderTextColor={theme.text.secondary} multiline textAlignVertical="top" />
                </View>

                <View style={s.card}>
                  <Text style={s.fieldLabel}>Responsibilities & Scope</Text>
                  <Text style={s.fieldHint}>The more specific, the better the agent performs.</Text>
                  <TextInput style={[s.input, s.textarea]} value={scope} onChangeText={setScope} placeholder={`• Review pull requests\n• Write documentation\n• Debug production issues`} placeholderTextColor={theme.text.secondary} multiline textAlignVertical="top" />
                </View>
              </View>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <View style={s.stepSection}>
                <Text style={s.stepHeading}>Shape {name || 'their'}'s character</Text>
                <Text style={s.stepSubheading}>Traits and tone influence how they communicate.</Text>

                <View style={s.card}>
                  <Text style={s.fieldLabel}>Personality Traits</Text>
                  <View style={s.chips}>
                    {TRAITS.map((t) => (
                      <TouchableOpacity key={t} style={[s.chip, traits.includes(t) && s.chipActive]} onPress={() => toggleTrait(t)} activeOpacity={0.7}>
                        <Text style={[s.chipText, traits.includes(t) && s.chipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={s.card}>
                  <Text style={s.fieldLabel}>Communication Tone</Text>
                  <View style={s.chips}>
                    {TONES.map((t) => (
                      <TouchableOpacity key={t} style={[s.chip, tone === t && s.chipActive]} onPress={() => setTone(tone === t ? '' : t)} activeOpacity={0.7}>
                        <Text style={[s.chipText, tone === t && s.chipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <View style={s.stepSection}>
                <View style={s.reviewHero}>
                  <AgentAvatar name={slugName || 'agent'} size={80} />
                  <Text style={s.reviewName}>{slugName || 'agent'}</Text>
                  <Text style={s.reviewRole}>{role}</Text>
                </View>

                <View style={s.card}>
                  <Text style={s.fieldLabel}>Generated System Prompt</Text>
                  <View style={s.promptPreview}>
                    <Text style={s.promptPreviewText}>
                      {buildPrompt(role, description, scope, traits, tone) || 'No details provided — agent will use defaults.'}
                    </Text>
                  </View>
                </View>

                {error ? <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View> : null}

                <TouchableOpacity style={[s.primaryBtn, creating && s.primaryBtnOff]} onPress={handleCreate} disabled={creating} activeOpacity={0.85}>
                  {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryBtnText}>Create {name || 'Agent'}</Text>}
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Nav row */}
          <View style={s.navRow}>
            <TouchableOpacity style={s.navBackBtn} onPress={step > 0 ? () => setStep((p) => p - 1) : () => router.back()} activeOpacity={0.7}>
              <Text style={s.navBackText}>{step > 0 ? '← Back' : 'Cancel'}</Text>
            </TouchableOpacity>
            {step < STEPS.length - 1 && (
              <TouchableOpacity style={[s.navNextBtn, !canNext && s.navNextOff]} onPress={() => setStep((p) => p + 1)} disabled={!canNext} activeOpacity={0.85}>
                <Text style={[s.navNextText, !canNext && s.navNextTextOff]}>Next →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },

  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: t.border },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border,
  },
  cancelText: { color: t.accent, fontSize: 16 },
  headerTitle: { color: t.text.primary, fontSize: 17, fontWeight: '700' },
  modeToggleWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modeToggleLabel: { color: t.text.secondary, fontSize: 12 },

  stepBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border,
    position: 'relative',
  },
  stepLine: { position: 'absolute', top: Spacing.md + 12, left: Spacing.xl + 16, right: Spacing.xl + 16, height: 1, backgroundColor: t.border, zIndex: 0 },
  stepItem: { alignItems: 'center', gap: 4, zIndex: 1 },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: t.surface, borderWidth: 1.5, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: t.accent, borderColor: t.accent },
  stepCurrent: { backgroundColor: t.background, borderColor: t.accent },
  stepDotText: { color: t.text.secondary, fontSize: 11, fontWeight: '700' },
  stepDotTextActive: { color: t.accent },
  stepLabel: { color: t.text.secondary, fontSize: 10, fontWeight: '500' },
  stepLabelActive: { color: t.accent, fontWeight: '700' },

  scroll: { padding: Spacing.lg, gap: Spacing.md },

  stepSection: { gap: Spacing.md },
  stepHeading: { color: t.text.primary, fontSize: 22, fontWeight: '700' },
  stepSubheading: { color: t.text.secondary, fontSize: 14, lineHeight: 20 },

  previewAvatar: { alignItems: 'center', paddingVertical: Spacing.md, gap: 6 },
  previewSlug: { color: t.text.secondary, fontSize: 13 },

  card: {
    backgroundColor: t.surface, borderRadius: 18, padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, gap: Spacing.sm,
  },

  fieldLabel: { color: t.text.secondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  fieldHint: { color: t.text.secondary, fontSize: 12, lineHeight: 16 },

  input: {
    backgroundColor: t.background, borderRadius: 12,
    paddingHorizontal: Spacing.sm + 6, paddingVertical: Spacing.sm + 2,
    color: t.text.primary, fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  textarea: { minHeight: 100, textAlignVertical: 'top', lineHeight: 20 },
  promptEditor: { minHeight: 200, fontSize: 13, lineHeight: 20, textAlignVertical: 'top' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm - 2 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: t.background,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  chipActive: { backgroundColor: t.accent + '20', borderColor: t.accent },
  chipText: { color: t.text.secondary, fontSize: 13 },
  chipTextActive: { color: t.accent, fontWeight: '600' },

  reviewHero: { alignItems: 'center', paddingVertical: Spacing.md, gap: 6 },
  reviewName: { color: t.text.primary, fontSize: 22, fontWeight: '700', marginTop: Spacing.xs },
  reviewRole: { color: t.text.secondary, fontSize: 14 },

  promptPreview: {
    backgroundColor: t.background, borderRadius: 12,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  promptPreviewText: { color: t.text.secondary, fontSize: 12, lineHeight: 18 },

  errorBox: { padding: Spacing.md, backgroundColor: t.error + '18', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: t.error + '55' },
  errorText: { color: t.error, fontSize: 13 },

  primaryBtn: {
    backgroundColor: t.accent, borderRadius: 16, paddingVertical: 15, alignItems: 'center',
    shadowColor: t.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  primaryBtnOff: { backgroundColor: t.surface, shadowOpacity: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  navRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border,
    backgroundColor: t.surface,
  },
  navBackBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  navBackText: { color: t.text.secondary, fontSize: 15 },
  navNextBtn: { backgroundColor: t.accent, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm + 2, borderRadius: 20 },
  navNextOff: { backgroundColor: t.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  navNextText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  navNextTextOff: { color: t.text.secondary },
});
