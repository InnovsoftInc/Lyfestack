import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Switch, FlatList, Modal, Alert,
} from 'react-native';
import { useState, useCallback, useRef } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useOpenClawStore } from '../../../../stores/openclaw.store';
import { openclawApi } from '../../../../services/openclaw.api';
import { useTheme } from '../../../../hooks/useTheme';
import { Spacing } from '../../../../theme';
import type { Theme } from '../../../../theme';
import { AgentAvatar } from './index';
import { GlassHeader } from '../../../../components/ui';

interface SkillInfo {
  name: string;
  description: string;
  size: number;
  modifiedAt: string;
}

const TRAITS = ['Analytical', 'Creative', 'Direct', 'Friendly', 'Precise', 'Witty', 'Empathetic', 'Strategic', 'Thorough', 'Bold'];
const TONES = ['Professional', 'Casual', 'Technical', 'Simple', 'Formal', 'Conversational'];

interface AgentFile {
  filename: string;
  type: 'identity' | 'shared';
  preview: string;
  size: number;
  modifiedAt: string;
}

interface AgentPersona {
  description?: string;
  scope?: string;
  traits?: string[];
  tone?: string;
}

interface AgentDetail {
  id: string;
  name: string;
  role: string;
  model: string;
  systemPrompt?: string;
  persona?: AgentPersona;
}

function buildSystemPrompt(role: string, persona: AgentPersona): string {
  const parts: string[] = [];
  if (persona.description) parts.push(`# About\n${persona.description}`);
  if (role) parts.push(`# Role\n${role}`);
  if (persona.scope) parts.push(`# Responsibilities\n${persona.scope}`);
  if (persona.traits?.length) parts.push(`# Personality Traits\n${persona.traits.join(', ')}`);
  if (persona.tone) parts.push(`# Communication Style\nCommunicate in a ${persona.tone.toLowerCase()} tone.`);
  return parts.join('\n\n');
}

export default function AgentProfileScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const theme = useTheme();
  const s = styles(theme);
  const { deleteAgent } = useOpenClawStore();

  const [tab, setTab] = useState<'profile' | 'skills' | 'files'>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [allSkills, setAllSkills] = useState<SkillInfo[]>([]);
  const [assignedSkills, setAssignedSkills] = useState<string[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const skillsTogglingRef = useRef<Set<string>>(new Set());

  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState('');
  const [traits, setTraits] = useState<string[]>([]);
  const [tone, setTone] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [displayName, setDisplayName] = useState(name);

  const loadAgent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await openclawApi.getAgent(name) as { data: AgentDetail };
      const d = res.data;
      setDisplayName(d.name ?? name);
      setRole(d.role ?? '');
      setDescription(d.persona?.description ?? '');
      setScope(d.persona?.scope ?? '');
      setTraits(d.persona?.traits ?? []);
      setTone(d.persona?.tone ?? '');
      setSystemPrompt(d.systemPrompt ?? '');
    } catch { /* use defaults */ } finally {
      setLoading(false);
    }
    setFilesLoading(true);
    openclawApi.listAgentFiles(name)
      .then((res: any) => setFiles(res.data ?? []))
      .catch(() => {})
      .finally(() => setFilesLoading(false));

    setSkillsLoading(true);
    Promise.all([
      openclawApi.listSkills() as Promise<{ data: SkillInfo[] }>,
      openclawApi.getAgentSkills(name) as Promise<{ data: string[] }>,
    ])
      .then(([skillsRes, assignedRes]) => {
        setAllSkills((skillsRes as any).data ?? []);
        setAssignedSkills((assignedRes as any).data ?? []);
      })
      .catch(() => {})
      .finally(() => setSkillsLoading(false));
  }, [name]);

  useFocusEffect(useCallback(() => { loadAgent(); }, [loadAgent]));

  const toggleTrait = (t: string) =>
    setTraits((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const toggleSkill = async (skillName: string) => {
    if (skillsTogglingRef.current.has(skillName)) return;
    skillsTogglingRef.current.add(skillName);
    const next = assignedSkills.includes(skillName)
      ? assignedSkills.filter((s) => s !== skillName)
      : [...assignedSkills, skillName];
    setAssignedSkills(next);
    try {
      await openclawApi.setAgentSkills(name, next);
    } catch {
      setAssignedSkills(assignedSkills); // revert
    } finally {
      skillsTogglingRef.current.delete(skillName);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const persona: AgentPersona = { description, scope, traits, tone };
      const prompt = advancedMode ? systemPrompt : buildSystemPrompt(role, persona);
      await openclawApi.updateAgent(name, { role, systemPrompt: prompt, persona: { ...persona } });
      setSystemPrompt(prompt);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete agent',
      `Permanently delete "${name}"? This removes the agent directory, config and workspace files prefixed with this name.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try { await deleteAgent(name); router.back(); }
            finally { setDeleting(false); }
          },
        },
      ],
    );
  };

  const openRename = () => {
    setRenameValue(displayName);
    setRenameError(null);
    setRenameOpen(true);
  };

  const validateName = (v: string) => v.trim().length >= 1 && v.trim().length <= 48;

  const confirmRename = async () => {
    const next = renameValue.trim();
    if (!validateName(next)) {
      setRenameError('Enter a display name between 1 and 48 characters.');
      return;
    }
    if (next === displayName) { setRenameOpen(false); return; }

    Alert.alert(
      'Rename agent',
      `Change the display name from "${displayName}" to "${next}"? The agent identity and workspace slug will stay the same.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            setRenameSaving(true);
            setRenameError(null);
            try {
              await openclawApi.updateAgent(name, { displayName: next });
              setDisplayName(next);
              setRenameOpen(false);
            } catch (err: any) {
              setRenameError(err?.message ?? 'Rename failed');
            } finally {
              setRenameSaving(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <GlassHeader title={displayName} />

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['profile', 'skills', 'files'] as const).map((t) => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)} activeOpacity={0.7}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'profile' ? 'Overview' : t === 'skills' ? `Skills${allSkills.length ? ` (${assignedSkills.length}/${allSkills.length})` : ''}` : `Files${files.length ? ` (${files.length})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'skills' ? (
        skillsLoading ? (
          <View style={s.center}><ActivityIndicator color={theme.accent} size="large" /></View>
        ) : (
          <FlatList
            data={allSkills}
            keyExtractor={(item) => item.name}
            contentContainerStyle={s.filesList}
            ListEmptyComponent={
              <View style={s.center}><Text style={s.emptyText}>No skills available</Text></View>
            }
            renderItem={({ item }) => (
              <View style={s.skillCard}>
                <View style={s.skillInfo}>
                  <Text style={s.skillName}>{item.name}</Text>
                  {item.description ? (
                    <Text style={s.skillDesc} numberOfLines={2}>{item.description}</Text>
                  ) : null}
                </View>
                <Switch
                  value={assignedSkills.includes(item.name)}
                  onValueChange={() => toggleSkill(item.name)}
                  trackColor={{ false: theme.border, true: theme.accent + '99' }}
                  thumbColor={assignedSkills.includes(item.name) ? theme.accent : theme.text.secondary}
                />
              </View>
            )}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          />
        )
      ) : tab === 'files' ? (
        <FlatList
          data={files}
          keyExtractor={(item) => item.filename}
          contentContainerStyle={s.filesList}
          ListEmptyComponent={
            filesLoading
              ? <View style={s.center}><ActivityIndicator color={theme.accent} /></View>
              : <View style={s.center}><Text style={s.emptyText}>No markdown files found</Text></View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.fileCard}
              onPress={() => router.push(`/(auth)/(drawer)/agents/${name}/file?filename=${encodeURIComponent(item.filename)}` as any)}
              activeOpacity={0.65}
            >
              <View style={s.fileIcon}>
                <Text style={s.fileIconText}>{item.type === 'shared' ? '🌐' : '📄'}</Text>
              </View>
              <View style={s.fileInfo}>
                <Text style={s.fileName}>{item.filename}</Text>
                <Text style={s.filePreview} numberOfLines={2}>{item.preview}</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={s.hero}>
            <AgentAvatar name={displayName} size={88} />
            <TouchableOpacity
              onPress={openRename}
              activeOpacity={0.7}
              style={s.heroNameRow}
              hitSlop={8}
            >
              <Text style={s.heroName}>{displayName}</Text>
              <Text style={s.heroNameEdit}>✎</Text>
            </TouchableOpacity>
            <Text style={s.heroRole}>{role || 'No role set'}</Text>

            <TouchableOpacity
              style={s.chatBtn}
              onPress={() => router.push(`/(auth)/(drawer)/agents/${name}/chat` as any)}
              activeOpacity={0.85}
            >
              <Text style={s.chatBtnText}>💬  Chat with {displayName}</Text>
            </TouchableOpacity>
          </View>

          {/* Advanced toggle */}
          <View style={s.card}>
            <View style={s.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardLabel}>Advanced editing</Text>
                <Text style={s.cardHint}>Edit the raw system prompt directly</Text>
              </View>
              <Switch
                value={advancedMode}
                onValueChange={setAdvancedMode}
                trackColor={{ false: theme.border, true: theme.accent + '99' }}
                thumbColor={advancedMode ? theme.accent : theme.text.secondary}
              />
            </View>
          </View>

          {advancedMode ? (
            <View style={s.card}>
              <Text style={s.sectionLabel}>System Prompt</Text>
              <TextInput
                style={[s.input, s.promptEditor]}
                value={systemPrompt}
                onChangeText={setSystemPrompt}
                placeholder="# Role&#10;You are a..."
                placeholderTextColor={theme.text.secondary}
                multiline
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ) : (
            <>
              <View style={s.card}>
                <Text style={s.sectionLabel}>About</Text>
                <TextInput
                  style={[s.input, s.textarea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={`A brief description of ${displayName}...`}
                  placeholderTextColor={theme.text.secondary}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <View style={s.card}>
                <Text style={s.sectionLabel}>Responsibilities</Text>
                <TextInput
                  style={[s.input, s.textarea]}
                  value={scope}
                  onChangeText={setScope}
                  placeholder="What does this agent own and do?"
                  placeholderTextColor={theme.text.secondary}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <View style={s.card}>
                <Text style={s.sectionLabel}>Personality Traits</Text>
                <View style={s.chips}>
                  {TRAITS.map((t) => (
                    <TouchableOpacity key={t} style={[s.chip, traits.includes(t) && s.chipActive]} onPress={() => toggleTrait(t)} activeOpacity={0.7}>
                      <Text style={[s.chipText, traits.includes(t) && s.chipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={s.card}>
                <Text style={s.sectionLabel}>Communication Tone</Text>
                <View style={s.chips}>
                  {TONES.map((t) => (
                    <TouchableOpacity key={t} style={[s.chip, tone === t && s.chipActive]} onPress={() => setTone(tone === t ? '' : t)} activeOpacity={0.7}>
                      <Text style={[s.chipText, tone === t && s.chipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* Save */}
          <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.saveBtnText}>{saved ? '✓ Saved' : 'Save Changes'}</Text>}
          </TouchableOpacity>

          {/* Delete */}
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete} disabled={deleting} activeOpacity={0.7}>
            {deleting
              ? <ActivityIndicator size="small" color={theme.error} />
              : <Text style={s.deleteBtnText}>Delete Agent</Text>}
          </TouchableOpacity>

          <View style={{ height: 48 }} />
        </ScrollView>
      )}

      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Rename display name</Text>
            <Text style={s.modalHint}>
              This changes the human-readable agent name only. The underlying agent identity, folder, and sessions stay the same.
            </Text>
            <TextInput
              style={s.modalInput}
              value={renameValue}
              onChangeText={(v) => { setRenameValue(v); if (renameError) setRenameError(null); }}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Agent display name"
              placeholderTextColor={theme.text.secondary}
            />
            {renameError ? <Text style={s.modalError}>{renameError}</Text> : null}
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnCancel]}
                onPress={() => setRenameOpen(false)}
                disabled={renameSaving}
                activeOpacity={0.7}
              >
                <Text style={s.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnPrimary, renameSaving && { opacity: 0.6 }]}
                onPress={confirmRename}
                disabled={renameSaving}
                activeOpacity={0.85}
              >
                {renameSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.modalBtnPrimaryText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    backgroundColor: t.surface,
    borderRadius: 12,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  tab: {
    flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10,
  },
  tabActive: { backgroundColor: t.background, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  tabText: { color: t.text.secondary, fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: t.text.primary, fontWeight: '700' },

  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },

  hero: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  heroNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: Spacing.xs,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: t.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  heroName: { color: t.text.primary, fontSize: 24, fontWeight: '700' },
  heroNameEdit: { color: t.text.secondary, fontSize: 14 },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    backgroundColor: t.background,
    borderRadius: 20,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  modalTitle: { color: t.text.primary, fontSize: 18, fontWeight: '700' },
  modalHint: { color: t.text.secondary, fontSize: 13, lineHeight: 18 },
  modalInput: {
    backgroundColor: t.surface,
    borderRadius: 12,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    color: t.text.primary, fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  modalError: { color: t.error, fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  modalBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBtnCancel: { backgroundColor: t.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  modalBtnPrimary: { backgroundColor: t.accent },
  modalBtnCancelText: { color: t.text.primary, fontWeight: '600' },
  modalBtnPrimaryText: { color: '#fff', fontWeight: '700' },
  heroRole: { color: t.text.secondary, fontSize: 15 },

  chatBtn: {
    marginTop: Spacing.sm,
    backgroundColor: t.accent,
    paddingHorizontal: 28, paddingVertical: 13,
    borderRadius: 30,
    shadowColor: t.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10,
    elevation: 6,
  },
  chatBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  card: {
    backgroundColor: t.surface,
    borderRadius: 18,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
    gap: Spacing.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardLabel: { color: t.text.primary, fontSize: 15, fontWeight: '600' },
  cardHint: { color: t.text.secondary, fontSize: 12, marginTop: 2 },

  sectionLabel: { color: t.text.secondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  input: {
    backgroundColor: t.background,
    borderRadius: 12, padding: Spacing.sm + 4,
    color: t.text.primary, fontSize: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top', lineHeight: 20 },
  promptEditor: { minHeight: 180, fontSize: 13, lineHeight: 20, textAlignVertical: 'top' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm - 2 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: t.background,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  chipActive: { backgroundColor: t.accent + '20', borderColor: t.accent },
  chipText: { color: t.text.secondary, fontSize: 13 },
  chipTextActive: { color: t.accent, fontWeight: '600' },

  saveBtn: {
    backgroundColor: t.accent,
    borderRadius: 16, paddingVertical: 15,
    alignItems: 'center',
    shadowColor: t.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8,
    elevation: 5,
  },
  saveBtnDisabled: { opacity: 0.6, shadowOpacity: 0 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  deleteBtn: {
    borderRadius: 16, paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1, borderColor: t.error + '55',
    backgroundColor: t.error + '0e',
  },
  deleteBtnText: { color: t.error, fontSize: 15, fontWeight: '600' },

  filesList: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  fileCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: t.surface,
    borderRadius: 16, padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  fileIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: t.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  fileIconText: { fontSize: 20 },
  fileInfo: { flex: 1, gap: 3 },
  fileName: { color: t.text.primary, fontSize: 14, fontWeight: '600' },
  filePreview: { color: t.text.secondary, fontSize: 12, lineHeight: 16 },
  chevron: { color: t.border, fontSize: 22 },
  emptyText: { color: t.text.secondary, fontSize: 15 },

  skillCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: t.surface,
    borderRadius: 16, padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  skillInfo: { flex: 1, gap: 3 },
  skillName: { color: t.text.primary, fontSize: 14, fontWeight: '600' },
  skillDesc: { color: t.text.secondary, fontSize: 12, lineHeight: 16 },
});
