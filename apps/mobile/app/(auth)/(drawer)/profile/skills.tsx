import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { openclawApi } from '../../../../services/openclaw.api';
import { MarkdownEditorModal } from '../../../../components/ui/MarkdownEditorModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SkillInfo {
  name: string;
  description: string;
  size: number;
  modifiedAt: string;
}

interface SkillDetail {
  name: string;
  content: string;
}

type ViewMode = 'list' | 'create';

// ─── Templates ───────────────────────────────────────────────────────────────

const TEMPLATES: { id: string; label: string; content: (name: string) => string }[] = [
  {
    id: 'blank',
    label: 'Blank',
    content: (name) => `---
name: ${name}
description: "Describe what this skill does and when to use it."
metadata:
  {
    "openclaw": {
      "emoji": "⚡"
    }
  }
---

# ${name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ')} Skill

Describe the skill here.
`,
  },
  {
    id: 'coding',
    label: 'Coding',
    content: (name) => `---
name: ${name}
description: "Delegate coding tasks. Use when building features, fixing bugs, or refactoring code."
metadata:
  {
    "openclaw": {
      "emoji": "💻",
      "requires": { "bins": ["claude"] }
    }
  }
---

# ${name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ')} Skill

Delegate coding tasks using Claude Code CLI.

## Key Command Pattern

\`\`\`bash
bash workdir:/path/to/project command:"claude --permission-mode bypassPermissions --print 'Your task'"
\`\`\`

## Rules

1. Always set \`workdir\` to the project root.
2. Use \`--permission-mode bypassPermissions --print\` for non-interactive execution.
3. For long tasks, use \`background:true\` and monitor with \`process action:poll\`.
`,
  },
  {
    id: 'research',
    label: 'Research',
    content: (name) => `---
name: ${name}
description: "Research topics, summarize findings, and compile reports."
metadata:
  {
    "openclaw": {
      "emoji": "🔍"
    }
  }
---

# ${name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ')} Skill

Use this skill to research topics and compile findings.

## Approach

1. Search for authoritative sources.
2. Summarize key points concisely.
3. Highlight any conflicting information.
4. Provide a clear recommendation or conclusion.

## Output Format

- **Summary**: 2-3 sentence overview
- **Key Points**: Bulleted list
- **Sources**: Links or references
`,
  },
  {
    id: 'content',
    label: 'Content',
    content: (name) => `---
name: ${name}
description: "Write and edit content — emails, posts, docs, and more."
metadata:
  {
    "openclaw": {
      "emoji": "✍️"
    }
  }
---

# ${name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ')} Skill

Use this skill for writing and editing content.

## Guidelines

- Match the user's tone and voice.
- Keep writing clear and concise.
- Adapt format to the medium (email, post, doc, etc.).
- Proofread before delivering.
`,
  },
];

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { padding: Spacing.xl, paddingBottom: Spacing.md },
    backButton: { marginBottom: Spacing.md },
    backText: { ...TextStyles.bodyMedium, color: theme.text.secondary },
    heading: { ...TextStyles.h1, color: theme.text.primary },
    subheading: { ...TextStyles.small, color: theme.text.secondary, marginTop: 4 },
    scroll: { flex: 1 },
    section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing.xl * 2,
      gap: Spacing.md,
    },
    emptyIcon: { fontSize: 40 },
    emptyText: { ...TextStyles.bodyMedium, color: theme.text.secondary, textAlign: 'center' },
    emptyHint: { ...TextStyles.small, color: theme.text.secondary, textAlign: 'center', opacity: 0.7 },
    skillCard: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    skillCardRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    skillName: { ...TextStyles.h4, color: theme.text.primary, flex: 1 },
    skillDesc: { ...TextStyles.small, color: theme.text.secondary, marginTop: 4, lineHeight: 18 },
    skillMeta: { ...TextStyles.caption, color: theme.text.secondary, marginTop: 6, opacity: 0.7 },
    deleteBtn: { paddingLeft: Spacing.md, paddingTop: 2 },
    deleteBtnText: { color: Colors.error, fontSize: 18 },
    fab: {
      position: 'absolute',
      bottom: 32,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: Colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    fabText: { fontSize: 28, color: Colors.white, lineHeight: 30 },
    // Detail / create
    detailActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.md,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionBtnPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
    actionBtnDanger: { borderColor: Colors.error },
    actionBtnText: { ...TextStyles.bodyMedium, color: theme.text.secondary },
    actionBtnTextPrimary: { color: Colors.white },
    actionBtnTextDanger: { color: Colors.error },
    editor: {
      flex: 1,
      marginHorizontal: Spacing.xl,
      marginBottom: Spacing.md,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      ...TextStyles.small,
      color: theme.text.primary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
      lineHeight: 20,
      textAlignVertical: 'top',
    },
    readonlyContent: {
      flex: 1,
      marginHorizontal: Spacing.xl,
      marginBottom: Spacing.md,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
    },
    readonlyText: {
      ...TextStyles.small,
      color: theme.text.primary,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
      lineHeight: 20,
    },
    // Create form
    formSection: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
    formLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.sm,
    },
    nameInput: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      ...TextStyles.bodyMedium,
      color: theme.text.primary,
    },
    templateRow: { flexDirection: 'row', gap: Spacing.sm },
    templateChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    templateChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
    templateChipText: { ...TextStyles.small, color: theme.text.secondary },
    templateChipTextActive: { color: Colors.white, fontWeight: '600' },
    editorLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginHorizontal: Spacing.xl,
      marginBottom: Spacing.sm,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SkillsScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const [view, setView] = useState<ViewMode>('list');
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [modal, setModal] = useState<{ visible: boolean; skill: SkillDetail | null; loading: boolean }>({
    visible: false, skill: null, loading: false,
  });

  // Create state
  const [newName, setNewName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const defaultTemplate = TEMPLATES[0]!;
  const [createContent, setCreateContent] = useState(defaultTemplate.content('my-skill'));

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await openclawApi.listSkills();
      setSkills(((res as { data?: SkillInfo[] }).data) ?? []);
    } catch {
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  // ── Template selection updates the create editor ─────────────────────────
  const selectTemplate = (id: string) => {
    setSelectedTemplate(id);
    const tpl = TEMPLATES.find((t) => t.id === id) ?? defaultTemplate;
    const safeName = newName.trim().replace(/\s+/g, '-').toLowerCase() || 'my-skill';
    setCreateContent(tpl.content(safeName));
  };

  const updateNameAndContent = (name: string) => {
    setNewName(name);
    const tpl = TEMPLATES.find((t) => t.id === selectedTemplate) ?? defaultTemplate;
    const safeName = name.trim().replace(/\s+/g, '-').toLowerCase() || 'my-skill';
    setCreateContent(tpl.content(safeName));
  };

  // ── Open modal ────────────────────────────────────────────────────────────
  const openModal = async (name: string) => {
    setModal({ visible: true, skill: null, loading: true });
    try {
      const res = await openclawApi.getSkill(name);
      setModal({ visible: true, skill: (res as { data: SkillDetail }).data, loading: false });
    } catch {
      setModal({ visible: false, skill: null, loading: false });
      Alert.alert('Error', 'Could not load skill.');
    }
  };

  const closeModal = () => setModal({ visible: false, skill: null, loading: false });

  // ── Save via modal ────────────────────────────────────────────────────────
  const saveSkill = async (content: string) => {
    if (!modal.skill) return;
    setSaving(true);
    try {
      await openclawApi.updateSkill(modal.skill.name, content);
      setModal((m) => m.skill ? { ...m, skill: { ...m.skill, content } } : m);
      await loadSkills();
    } catch {
      Alert.alert('Error', 'Could not save skill.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const confirmDelete = (name: string) => {
    Alert.alert(
      'Delete Skill',
      `Are you sure you want to delete "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await openclawApi.deleteSkill(name);
              closeModal();
              await loadSkills();
            } catch {
              Alert.alert('Error', 'Could not delete skill.');
            }
          },
        },
      ]
    );
  };

  // ── Create ────────────────────────────────────────────────────────────────
  const createSkill = async () => {
    const safeName = newName.trim().replace(/\s+/g, '-').toLowerCase();
    if (!safeName) { Alert.alert('Error', 'Skill name is required.'); return; }
    setSaving(true);
    try {
      await openclawApi.createSkill(safeName, createContent);
      setNewName('');
      setSelectedTemplate('blank');
      setCreateContent(defaultTemplate.content('my-skill'));
      setView('list');
      await loadSkills();
    } catch (err: any) {
      Alert.alert('Error', err.message?.includes('already exists') ? `Skill "${safeName}" already exists.` : 'Could not create skill.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render: List ──────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.heading}>Skills</Text>
          <Text style={styles.subheading}>Manage your OpenClaw agent skills</Text>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={styles.section}>
              {skills.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🧩</Text>
                  <Text style={styles.emptyText}>No skills installed</Text>
                  <Text style={styles.emptyHint}>Tap + to create your first skill</Text>
                </View>
              ) : (
                skills.map((skill) => (
                  <TouchableOpacity
                    key={skill.name}
                    style={styles.skillCard}
                    onPress={() => openModal(skill.name)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.skillCardRow}>
                      <Text style={styles.skillName}>{skill.name}</Text>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => confirmDelete(skill.name)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.deleteBtnText}>×</Text>
                      </TouchableOpacity>
                    </View>
                    {skill.description ? (
                      <Text style={styles.skillDesc} numberOfLines={2}>{skill.description}</Text>
                    ) : null}
                    {skill.modifiedAt ? (
                      <Text style={styles.skillMeta}>Modified {formatDate(skill.modifiedAt)}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>
        )}

        <TouchableOpacity style={styles.fab} onPress={() => setView('create')} activeOpacity={0.85}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>

        <MarkdownEditorModal
          visible={modal.visible}
          title={modal.skill?.name ?? ''}
          initialContent={modal.skill?.content ?? ''}
          loading={modal.loading}
          saving={saving}
          onSave={saveSkill}
          onClose={closeModal}
        />
      </View>
    );
  }

  // ── Render: Create ────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => setView('list')}>
          <Text style={styles.backText}>← Skills</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>New Skill</Text>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.formLabel}>Skill Name</Text>
        <TextInput
          style={styles.nameInput}
          value={newName}
          onChangeText={updateNameAndContent}
          placeholder="e.g. my-skill"
          placeholderTextColor={theme.text.secondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.formLabel}>Template</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.templateRow}>
            {TEMPLATES.map((tpl) => (
              <TouchableOpacity
                key={tpl.id}
                style={[styles.templateChip, selectedTemplate === tpl.id && styles.templateChipActive]}
                onPress={() => selectTemplate(tpl.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.templateChipText, selectedTemplate === tpl.id && styles.templateChipTextActive]}>
                  {tpl.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <Text style={styles.editorLabel}>SKILL.md</Text>
      <TextInput
        style={[styles.editor, { flex: 1 }]}
        value={createContent}
        onChangeText={setCreateContent}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        scrollEnabled
      />

      <View style={[styles.detailActions, { paddingBottom: 24 }]}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={createSkill}
          disabled={saving || !newName.trim()}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Create Skill</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setView('list')} activeOpacity={0.85}>
          <Text style={styles.actionBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
