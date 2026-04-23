import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useRef, useState } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { streamOrchestrator, type OrchestratorEvent } from '../../../../services/openai.api';

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
    inputBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.background },
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
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const ask = useCallback(async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setInput('');

    const userId = `u_${Date.now()}`;
    const assistantId = `a_${Date.now() + 1}`;
    setTurns((prev) => [
      ...prev,
      { id: userId, kind: 'user', text },
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
  }, [busy, turns]);

  const stop = () => { abortRef.current?.abort(); };

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
        <View style={styles.inputBar}>
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
            <TouchableOpacity style={styles.send} onPress={() => ask(input)} disabled={!input.trim()}>
              <Text style={styles.sendLabel}>Send</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
