import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, useColorScheme } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import Marked from 'react-native-marked';
import { openclawApi } from '../../../../../services/openclaw.api';
import { useTheme } from '../../../../../hooks/useTheme';
import { Spacing, BorderRadius } from '../../../../../theme';
import type { Theme } from '../../../../../theme';

export default function AgentFileScreen() {
  const { name, filename } = useLocalSearchParams<{ name: string; filename: string }>();
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const s = styles(theme);

  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');

  useEffect(() => {
    if (!filename) return;
    setLoading(true);
    openclawApi.getAgentFile(name, filename)
      .then((res: any) => {
        setContent(res.data.content);
        setOriginal(res.data.content);
      })
      .catch((err: any) => setError(err.message ?? 'Failed to load file'))
      .finally(() => setLoading(false));
  }, [name, filename]);

  const isDirty = content !== original;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await openclawApi.updateAgentFile(name, filename, content);
      setOriginal(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn} hitSlop={12}>
          <Text style={s.closeText}>✕</Text>
        </TouchableOpacity>

        <View style={s.headerMid}>
          <Text style={s.filename} numberOfLines={1}>{filename}</Text>
          {isDirty && <View style={s.dirtyDot} />}
        </View>

        {/* Edit / Preview toggle */}
        <View style={s.toggle}>
          <TouchableOpacity
            style={[s.toggleBtn, mode === 'preview' && s.toggleBtnActive]}
            onPress={() => setMode('preview')}
          >
            <Text style={[s.toggleText, mode === 'preview' && s.toggleTextActive]}>Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, mode === 'edit' && s.toggleBtnActive]}
            onPress={() => setMode('edit')}
          >
            <Text style={[s.toggleText, mode === 'edit' && s.toggleTextActive]}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Save bar — only shown when dirty */}
      {isDirty && (
        <View style={s.saveBar}>
          <Text style={s.saveBarText}>Unsaved changes</Text>
          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color={theme.text.inverse} />
              : <Text style={s.saveBtnText}>{saved ? '✓ Saved' : 'Save'}</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {error ? (
        <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>
      ) : null}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : mode === 'edit' ? (
        <TextInput
          style={s.editor}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          scrollEnabled
        />
      ) : (
        <Marked
          value={content || '_Empty file_'}
          flatListProps={{
            contentContainerStyle: s.preview,
            style: { backgroundColor: theme.background },
          }}
          theme={{
            code: { backgroundColor: theme.surface, color: theme.text.primary, borderRadius: BorderRadius.sm, paddingHorizontal: 4 },
            codespan: { backgroundColor: theme.surface, color: theme.accent },
            heading1: { color: theme.text.primary, fontSize: 22, fontWeight: '700', marginTop: Spacing.md, marginBottom: Spacing.xs },
            heading2: { color: theme.text.primary, fontSize: 18, fontWeight: '700', marginTop: Spacing.md, marginBottom: Spacing.xs },
            heading3: { color: theme.text.primary, fontSize: 15, fontWeight: '700', marginTop: Spacing.sm, marginBottom: 2 },
            paragraph: { color: theme.text.primary, fontSize: 14, lineHeight: 22, marginBottom: Spacing.sm },
            strong: { color: theme.text.primary, fontWeight: '700' },
            em: { color: theme.text.primary, fontStyle: 'italic' },
            link: { color: theme.accent },
            blockquote: { backgroundColor: theme.surface, borderLeftColor: theme.accent, borderLeftWidth: 3, paddingLeft: Spacing.sm, paddingVertical: 2, marginVertical: Spacing.xs },
            hr: { backgroundColor: theme.border, height: StyleSheet.hairlineWidth, marginVertical: Spacing.md },
            li: { color: theme.text.primary, fontSize: 14, lineHeight: 22 },
            table: { borderColor: theme.border },
            th: { backgroundColor: theme.surface, color: theme.text.primary, fontWeight: '700', padding: Spacing.xs, fontSize: 13 },
            td: { color: theme.text.primary, padding: Spacing.xs, fontSize: 13 },
            image: {},
            text: { color: theme.text.primary },
          }}
          colorScheme={colorScheme ?? 'dark'}
        />
      )}
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: t.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border,
  },
  closeBtn: { width: 28 },
  closeText: { color: t.text.secondary, fontSize: 17 },
  headerMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  filename: { color: t.text.primary, fontSize: 13, fontWeight: '600', flex: 1 },
  dirtyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.accent },

  toggle: {
    flexDirection: 'row', backgroundColor: t.background,
    borderRadius: BorderRadius.sm, padding: 2,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  toggleBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm - 1 },
  toggleBtnActive: { backgroundColor: t.surface },
  toggleText: { color: t.text.secondary, fontSize: 12, fontWeight: '500' },
  toggleTextActive: { color: t.text.primary, fontWeight: '700' },

  saveBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    backgroundColor: t.accent + '18',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.accent + '55',
  },
  saveBarText: { color: t.accent, fontSize: 12 },
  saveBtn: { backgroundColor: t.accent, paddingHorizontal: Spacing.sm + 4, paddingVertical: 5, borderRadius: BorderRadius.sm },
  saveBtnText: { color: t.text.inverse, fontSize: 12, fontWeight: '700' },

  errorBox: {
    margin: Spacing.md, padding: Spacing.sm,
    backgroundColor: t.error + '18', borderRadius: BorderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.error + '55',
  },
  errorText: { color: t.error, fontSize: 13 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  preview: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, paddingBottom: 40,
  },

  editor: {
    flex: 1, padding: Spacing.md,
    color: t.text.primary, fontSize: 13, lineHeight: 20,
    fontFamily: 'Courier',
    textAlignVertical: 'top',
  },
});
