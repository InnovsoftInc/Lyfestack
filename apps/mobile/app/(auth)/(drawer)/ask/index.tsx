import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useRef, useState } from 'react';
import { Buffer } from 'buffer';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { streamOrchestrator, type OrchestratorEvent } from '../../../../services/openai.api';
import type { ChatAttachment } from '../../../../stores/openclaw.store';

type Turn =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'assistant'; text: string; streaming?: boolean; tools: Array<{ id: string; name: string; status: 'pending' | 'done' | 'error'; error?: string }> }
  | { id: string; kind: 'system'; text: string };

const SUGGESTIONS = [
  'What did the leadgen agent do today?',
  'Show me yesterday\'s spend.',
  'Are any automations failing?',
  'Tail gateway.log for the last 100 lines.',
  'List pending exec approvals.',
];

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function isTextLikeAttachment(mimeType: string, name: string): boolean {
  const lowerMime = mimeType.toLowerCase();
  return lowerMime.startsWith('text/')
    || lowerMime.includes('json')
    || lowerMime.includes('xml')
    || lowerMime.includes('yaml')
    || lowerMime.includes('csv')
    || /\.(txt|md|mdx|json|ya?ml|csv|ts|tsx|js|jsx|html|css|xml|log)$/i.test(name.toLowerCase());
}

async function readUriAsBase64(uri: string): Promise<string> {
  const res = await fetch(uri);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

async function buildAttachmentFromAsset(asset: {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
  type?: 'text' | 'image' | 'file';
}): Promise<ChatAttachment> {
  const base64 = await readUriAsBase64(asset.uri);
  const mimeType = asset.mimeType || 'application/octet-stream';
  const name = asset.name || asset.uri.split('/').pop() || 'attachment';
  const size = Number(asset.size ?? Math.ceil((base64.length * 3) / 4)) || 0;
  if (size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${name} is larger than 8MB`);
  }
  const textContent = isTextLikeAttachment(mimeType, name)
    ? Buffer.from(base64, 'base64').toString('utf-8')
    : undefined;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    type: asset.type ?? (mimeType.startsWith('image/') ? 'image' : textContent ? 'text' : 'file'),
    uri: asset.uri,
    mimeType,
    size,
    ...(textContent ? { textContent } : {}),
    dataBase64: base64,
  };
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { padding: Spacing.xl, paddingBottom: Spacing.md },
    heading: { ...TextStyles.h1, color: theme.text.primary },
    sub: { ...TextStyles.small, color: theme.text.secondary, marginTop: 4 },
    suggestions: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { backgroundColor: theme.surface, borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: theme.border },
    chipLabel: { ...TextStyles.caption, color: theme.text.primary },
    list: { paddingHorizontal: Spacing.xl, paddingBottom: 100, gap: 10 },
    bubbleUser: { alignSelf: 'flex-end', backgroundColor: Colors.accent, borderRadius: BorderRadius.lg, borderBottomRightRadius: 4, padding: 10, maxWidth: '85%' },
    bubbleUserLabel: { ...TextStyles.body, color: Colors.white },
    bubbleAssistant: { alignSelf: 'flex-start', backgroundColor: theme.surface, borderRadius: BorderRadius.lg, borderBottomLeftRadius: 4, padding: 10, maxWidth: '95%', borderWidth: 1, borderColor: theme.border, gap: 6 },
    assistantText: { ...TextStyles.body, color: theme.text.primary },
    bubbleSystem: { alignSelf: 'center', backgroundColor: theme.background, borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: theme.border },
    bubbleSystemLabel: { ...TextStyles.caption, color: theme.text.secondary },
    toolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    toolDot: { fontSize: 8 },
    toolLabel: { ...TextStyles.caption },
    attachmentsBar: { paddingHorizontal: Spacing.md, paddingTop: Spacing.xs, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    attachmentChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accent + '18', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.accent + '40' },
    attachmentChipLabel: { color: Colors.accent, fontSize: 11, fontWeight: '600', maxWidth: 140 },
    attachmentChipRemove: { color: theme.text.secondary, fontSize: 13 },
    inputBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.background },
    attachBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
    attachBtnLabel: { fontSize: 18 },
    input: { flex: 1, backgroundColor: theme.surface, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, ...TextStyles.body, color: theme.text.primary, borderWidth: 1, borderColor: theme.border, maxHeight: 120 },
    send: { backgroundColor: Colors.accent, borderRadius: BorderRadius.md, paddingHorizontal: 14, paddingVertical: 10 },
    sendLabel: { ...TextStyles.bodyMedium, color: Colors.white, fontWeight: '600' },
    stop: { backgroundColor: Colors.error, borderRadius: BorderRadius.md, paddingHorizontal: 14, paddingVertical: 10 },
  });
}

function ToolPill({ name, status, theme }: { name: string; status: 'pending' | 'done' | 'error'; theme: Theme }) {
  const styles = makeStyles(theme);
  const color = status === 'pending' ? Colors.accent : status === 'error' ? theme.error : theme.text.secondary;
  return (
    <View style={styles.toolRow}>
      <Text style={[styles.toolDot, { color }]}>{status === 'pending' ? '●' : status === 'error' ? '✗' : '✓'}</Text>
      <Text style={[styles.toolLabel, { color }]}>{name}</Text>
    </View>
  );
}

export default function AskScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const pickDeviceFiles = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: ['*/*'],
      });
      if (result.canceled) return;
      const next = await Promise.all(result.assets.map((asset) => buildAttachmentFromAsset({
        uri: asset.uri,
        name: asset.name,
        ...(asset.mimeType !== undefined && { mimeType: asset.mimeType }),
        ...(asset.size !== undefined && { size: asset.size }),
      })));
      setPendingAttachments((prev) => [...prev, ...next.filter((attachment) => !prev.some((existing) => existing.name === attachment.name && existing.size === attachment.size))]);
    } catch (err: any) {
      Alert.alert('Could not attach file', err?.message ?? 'Please try again.');
    }
  }, []);

  const pickMedia = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photos access needed', 'Please allow photo library access to attach media.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 1,
      });
      if (result.canceled) return;
      const next = await Promise.all(result.assets.map((asset) => buildAttachmentFromAsset({
        uri: asset.uri,
        ...(asset.fileName !== undefined && { name: asset.fileName }),
        ...(asset.mimeType !== undefined && { mimeType: asset.mimeType }),
        ...(asset.fileSize !== undefined && { size: asset.fileSize }),
        type: asset.type === 'image' ? 'image' : 'file',
      })));
      setPendingAttachments((prev) => [...prev, ...next.filter((attachment) => !prev.some((existing) => existing.name === attachment.name && existing.size === attachment.size))]);
    } catch (err: any) {
      Alert.alert('Could not attach media', err?.message ?? 'Please try again.');
    }
  }, []);

  const showAttachmentMenu = useCallback(() => {
    Alert.alert('Attach', undefined, [
      { text: 'Photos/Videos', onPress: () => { void pickMedia(); } },
      { text: 'Documents', onPress: () => { void pickDeviceFiles(); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [pickMedia, pickDeviceFiles]);

  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const ask = useCallback(async (text: string) => {
    if ((!text.trim() && pendingAttachments.length === 0) || busy) return;
    setBusy(true);
    setInput('');
    const attachments = pendingAttachments;
    setPendingAttachments([]);

    const userId = `u_${Date.now()}`;
    const assistantId = `a_${Date.now() + 1}`;
    const userText = text.trim() || (attachments.length ? `(${attachments.length} attachment${attachments.length === 1 ? '' : 's'})` : '');
    setTurns((prev) => [
      ...prev,
      { id: userId, kind: 'user', text: userText },
      { id: assistantId, kind: 'assistant', text: '', streaming: true, tools: [] },
    ]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    const history: Array<{ role: 'user' | 'assistant'; content: string }> = turns
      .filter((t): t is Extract<Turn, { kind: 'user' | 'assistant' }> => t.kind === 'user' || t.kind === 'assistant')
      .map((t) => ({ role: t.kind, content: t.text }));

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      await streamOrchestrator({
        prompt: text,
        history,
        ...(attachments.length ? {
          attachments: attachments.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            mimeType: a.mimeType,
            size: a.size,
            ...(a.textContent ? { textContent: a.textContent } : {}),
            ...(a.dataBase64 ? { dataBase64: a.dataBase64 } : {}),
          })),
        } : {}),
        signal: abort.signal,
        onEvent: (ev: OrchestratorEvent) => {
          setTurns((prev) => prev.map((t) => {
            if (t.id !== assistantId || t.kind !== 'assistant') return t;
            switch (ev.type) {
              case 'tool_call':
                return { ...t, tools: [...t.tools, { id: ev.id, name: ev.name, status: 'pending' as const }] };
              case 'tool_result':
                return {
                  ...t,
                  tools: t.tools.map((tool) =>
                    tool.id === ev.id
                      ? { ...tool, status: ev.error ? ('error' as const) : ('done' as const), ...(ev.error ? { error: ev.error } : {}) }
                      : tool,
                  ),
                };
              case 'delta':
                return { ...t, text: t.text + ev.text };
              case 'done':
                return { ...t, text: ev.response || t.text, streaming: false };
              case 'error':
                return { ...t, text: t.text || ev.message, streaming: false };
              default:
                return t;
            }
          }));
          if (ev.type === 'delta' || ev.type === 'done') {
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
          }
        },
      });
    } catch (err: any) {
      setTurns((prev) => prev.map((t) =>
        t.id === assistantId && t.kind === 'assistant'
          ? { ...t, text: err?.message ?? 'request failed', streaming: false }
          : t,
      ));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }, [busy, turns, pendingAttachments]);

  const stop = () => { abortRef.current?.abort(); };

  const canSend = Boolean(input.trim() || pendingAttachments.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>🎙 Ask OpenClaw</Text>
        <Text style={styles.sub}>Natural-language control. The model can call any read-only tool, run automations, or toggle them.</Text>
      </View>
      {turns.length === 0 ? (
        <View style={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <TouchableOpacity key={s} style={styles.chip} onPress={() => ask(s)} activeOpacity={0.7}>
              <Text style={styles.chipLabel}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <ScrollView ref={scrollRef} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {turns.map((t) => {
          if (t.kind === 'user') {
            return <View key={t.id} style={styles.bubbleUser}><Text style={styles.bubbleUserLabel}>{t.text}</Text></View>;
          }
          if (t.kind === 'system') {
            return <View key={t.id} style={styles.bubbleSystem}><Text style={styles.bubbleSystemLabel}>{t.text}</Text></View>;
          }
          return (
            <View key={t.id} style={styles.bubbleAssistant}>
              {t.tools.length > 0 ? (
                <View style={{ gap: 2, marginBottom: t.text ? 4 : 0 }}>
                  {t.tools.map((tool) => <ToolPill key={tool.id} name={tool.name} status={tool.status} theme={theme} />)}
                </View>
              ) : null}
              {t.text ? <Text style={styles.assistantText}>{t.text}</Text> : null}
              {t.streaming && !t.text ? <ActivityIndicator size="small" color={Colors.accent} /> : null}
            </View>
          );
        })}
      </ScrollView>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {pendingAttachments.length > 0 && (
          <View style={styles.attachmentsBar}>
            {pendingAttachments.map((a) => (
              <View key={a.id} style={styles.attachmentChip}>
                <Text style={{ fontSize: 12 }}>{a.type === 'image' ? '🖼' : '📄'}</Text>
                <Text style={styles.attachmentChipLabel} numberOfLines={1}>{a.name}</Text>
                <TouchableOpacity onPress={() => removeAttachment(a.id)} hitSlop={6}>
                  <Text style={styles.attachmentChipRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.attachBtn} onPress={showAttachmentMenu} activeOpacity={0.7}>
            <Text style={styles.attachBtnLabel}>📎</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything…"
            placeholderTextColor={theme.text.secondary}
            multiline
            onSubmitEditing={() => ask(input)}
            blurOnSubmit
            returnKeyType="send"
          />
          {busy ? (
            <TouchableOpacity style={styles.stop} onPress={stop}><Text style={styles.sendLabel}>Stop</Text></TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.send} onPress={() => ask(input)} disabled={!canSend}>
              <Text style={styles.sendLabel}>Send</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
