import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, ScrollView, useColorScheme,
} from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MarkedBase from 'react-native-marked';
import * as Clipboard from 'expo-clipboard';
const Marked = MarkedBase as any;

function CopyButton({ content, theme, variant = 'agent' }: { content: string; theme: Theme; variant?: 'agent' | 'user' }) {
  const [copied, setCopied] = useState(false);
  const onPress = async () => {
    await Clipboard.setStringAsync(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const color = variant === 'user' ? 'rgba(255,255,255,0.85)' : theme.text.secondary;
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={6}
      activeOpacity={0.6}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 4 }}
    >
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{copied ? '✓ Copied' : '⧉ Copy'}</Text>
    </TouchableOpacity>
  );
}
import { useOpenClawStore } from '../../../../../stores/openclaw.store';
import type { ChatErrorType, ChatAttachment, ChatMessage } from '../../../../../stores/openclaw.store';
import { openclawApi } from '../../../../../services/openclaw.api';
import { useTheme } from '../../../../../hooks/useTheme';
import { Spacing, BorderRadius } from '../../../../../theme';
import type { Theme } from '../../../../../theme';
import { AgentAvatar } from '../index';


const ERROR_META: Record<ChatErrorType, { icon: string; title: string; body: string }> = {
  billing: {
    icon: '💳',
    title: 'Out of Credits',
    body: 'Your API key has insufficient balance. Top up at openrouter.ai/settings/credits or switch to a different key in OpenClaw Settings.',
  },
  rate_limit: {
    icon: '⏱',
    title: 'Rate Limited',
    body: 'Too many requests to the free model tier. Wait a minute and try again, or switch to a paid model in the header above.',
  },
  all_failed: {
    icon: '🚫',
    title: 'All Models Failed',
    body: 'Every model in the fallback chain failed. Check your API keys and model configuration in OpenClaw Settings.',
  },
  generic: {
    icon: '⚠️',
    title: 'Agent Error',
    body: '',
  },
};

function ErrorBadge({ type, rawMessage, theme }: { type: ChatErrorType; rawMessage: string; theme: Theme }) {
  const meta = ERROR_META[type];
  const isKnown = type !== 'generic';
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth: '88%', marginBottom: 8 }}>
      <View style={{ backgroundColor: theme.error + '12', borderWidth: 1, borderColor: theme.error + '40', borderRadius: 14, borderBottomLeftRadius: 4, padding: 12, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 15 }}>{meta.icon}</Text>
          <Text style={{ color: theme.error, fontSize: 13, fontWeight: '700' }}>{meta.title}</Text>
        </View>
        {isKnown ? (
          <Text style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18 }}>{meta.body}</Text>
        ) : (
          <Text style={{ color: theme.text.secondary, fontSize: 12, lineHeight: 17, fontFamily: 'Courier' }} numberOfLines={4}>
            {rawMessage.split('\n')[0]}
          </Text>
        )}
      </View>
    </View>
  );
}

function AttachmentChip({ attachment, onRemove, theme }: { attachment: ChatAttachment; onRemove: () => void; theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.accent + '18', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, gap: 4, borderWidth: 1, borderColor: theme.accent + '40' }}>
      <Text style={{ fontSize: 12 }}>{attachment.type === 'image' ? '🖼' : '📄'}</Text>
      <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '600', maxWidth: 120 }} numberOfLines={1}>{attachment.name}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={6}>
        <Text style={{ color: theme.text.secondary, fontSize: 13 }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function ToolPill({ label, theme }: { label: string; theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: theme.accent + '18', borderRadius: 12, borderWidth: 1, borderColor: theme.accent + '40', paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6, gap: 4 }}>
      <ActivityIndicator size="small" color={theme.accent} style={{ width: 12, height: 12 }} />
      <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function AgentBubble({ content, streaming, toolActivity, theme, colorScheme }: { content: string; streaming?: boolean; toolActivity?: string | null; theme: Theme; colorScheme: 'light' | 'dark' }) {
  const markdownTheme = {
    code: { backgroundColor: theme.surface, color: theme.text.primary, borderRadius: 12, padding: 12, fontFamily: 'Courier', fontSize: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
    codespan: { backgroundColor: theme.surface, color: theme.accent, fontFamily: 'Courier', fontSize: 13 },
    heading1: { color: theme.text.primary, fontSize: 18, fontWeight: '700' as const, marginTop: 8, marginBottom: 4 },
    heading2: { color: theme.text.primary, fontSize: 15, fontWeight: '700' as const, marginTop: 6, marginBottom: 2 },
    heading3: { color: theme.text.primary, fontSize: 13, fontWeight: '700' as const, marginTop: 4 },
    paragraph: { color: theme.text.primary, fontSize: 15, lineHeight: 21, marginBottom: 4 },
    strong: { color: theme.text.primary, fontWeight: '700' as const },
    em: { color: theme.text.primary, fontStyle: 'italic' as const },
    link: { color: theme.accent },
    blockquote: { backgroundColor: theme.background, borderLeftColor: theme.accent, borderLeftWidth: 3, paddingLeft: Spacing.sm, paddingVertical: 2, marginVertical: 2 },
    hr: { backgroundColor: theme.border, height: StyleSheet.hairlineWidth, marginVertical: Spacing.sm },
    li: { color: theme.text.primary, fontSize: 15, lineHeight: 21 },
    table: { borderColor: theme.border },
    th: { backgroundColor: theme.background, color: theme.text.primary, fontWeight: '700' as const, padding: 4, fontSize: 13 },
    td: { color: theme.text.primary, padding: 4, fontSize: 13 },
    image: {},
    text: { color: theme.text.primary },
  };

  return (
    <View style={{ alignSelf: 'flex-start', maxWidth: '88%', marginBottom: Spacing.xs }}>
      {streaming && toolActivity && <ToolPill label={toolActivity} theme={theme} />}
      {streaming && content.length === 0 && !toolActivity ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}>
          <ActivityIndicator size="small" color={theme.text.secondary} />
          <Text style={{ color: theme.text.secondary, fontSize: 13 }}>thinking...</Text>
        </View>
      ) : content.length > 0 ? (
        <Marked
          value={content || ' '}
          flatListProps={{
            scrollEnabled: false,
            contentContainerStyle: { paddingTop: 4, paddingBottom: 4, paddingHorizontal: 0 },
            style: { backgroundColor: 'transparent' },
          } as any}
          theme={markdownTheme as any}
          colorScheme={colorScheme}
        />
      ) : null}
      {streaming && content.length > 0 && (
        <View style={{ width: 6, height: 14, backgroundColor: theme.accent, marginLeft: 2, marginBottom: 6, borderRadius: 1 }} />
      )}
    </View>
  );
}

export default function AgentChatScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const theme = useTheme();
  const colorScheme = (useColorScheme() ?? 'dark') as 'light' | 'dark';
  const s = styles(theme);
  const { activeChat, openChat, sendMessageStream, abortStream, streamAbort, agents } = useOpenClawStore();
  const [input, setInput] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [currentModel, setCurrentModel] = useState('');
  const [fallbackModels, setFallbackModels] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [changingModel, setChangingModel] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<Array<{ filename: string; preview: string }>>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const listRef = useRef<FlatList>(null);
  const pinnedRef = useRef(true);
  const sessionRef = useRef<{ key: string; oldestIndex: number; newestIndex: number; total: number } | null>(null);
  const loadingOlderRef = useRef(false);

  const PAGE_SIZE = 50;

  const mapMessage = (m: any): ChatMessage => ({
    id: `msg-${m.index}-${m.role}`,
    role: m.role === 'user' ? 'user' : 'agent',
    content: m.content,
    timestamp: m.timestamp ?? new Date().toISOString(),
  });
  const insets = useSafeAreaInsets();
  const agent = agents.find((a) => a.name === name);
  const isStreaming = !!streamAbort;

  useEffect(() => {
    openChat(name);
    openclawApi.getAgent(name).then((res: any) => {
      setCurrentModel(res.data?.model ?? 'openrouter/auto');
      setFallbackModels(res.data?.fallbackModels ?? []);
    }).catch(() => {});
    openclawApi.getConfig().then((res: any) => {
      const models: string[] = res.data?.availableModels ?? [];
      if (models.length) setAvailableModels(models);
    }).catch(() => {});

    let cancelled = false;
    sessionRef.current = null;
    setLoadingHistory(true);

    const initial = async () => {
      try {
        const res: any = await openclawApi.listSessions(20);
        const agentSessions = (res.data ?? []).filter((s: any) => s.agentId === name || s.label?.includes(name));
        if (!agentSessions.length) return;
        const key = agentSessions[0].key;
        const sessionRes: any = await openclawApi.getSession(key, { limit: PAGE_SIZE });
        if (cancelled) return;
        const data = sessionRes.data ?? {};
        const messages: ChatMessage[] = (data.messages ?? []).map(mapMessage);
        sessionRef.current = {
          key,
          oldestIndex: data.firstIndex ?? -1,
          newestIndex: data.lastIndex ?? -1,
          total: data.total ?? messages.length,
        };
        if (messages.length) useOpenClawStore.getState().loadChatHistory(name, messages);
      } catch { /* next tick */ }
    };

    const syncTail = async () => {
      const sref = sessionRef.current;
      if (!sref) return;
      if (useOpenClawStore.getState().streamAbort) return;
      try {
        const res: any = await openclawApi.getSession(sref.key, { afterIndex: sref.newestIndex });
        if (cancelled) return;
        const data = res.data ?? {};
        const messages: ChatMessage[] = (data.messages ?? []).map(mapMessage);
        if (!messages.length) return;
        sref.newestIndex = data.lastIndex ?? sref.newestIndex;
        sref.total = data.total ?? sref.total;
        useOpenClawStore.getState().appendChatMessages(name, messages);
      } catch { /* next tick */ }
    };

    initial().finally(() => { if (!cancelled) setLoadingHistory(false); });

    const interval = setInterval(syncTail, 3000);

    return () => { cancelled = true; clearInterval(interval); };
  }, [name]);

  const loadOlder = useCallback(async () => {
    const sref = sessionRef.current;
    if (!sref || loadingOlderRef.current) return;
    if (sref.oldestIndex <= 0) return;
    loadingOlderRef.current = true;
    try {
      const res: any = await openclawApi.getSession(sref.key, {
        beforeIndex: sref.oldestIndex,
        limit: PAGE_SIZE,
      });
      const data = res.data ?? {};
      const messages: ChatMessage[] = (data.messages ?? []).map(mapMessage);
      if (messages.length) {
        sref.oldestIndex = data.firstIndex ?? sref.oldestIndex;
        useOpenClawStore.getState().prependChatMessages(name, messages);
      } else {
        sref.oldestIndex = 0;
      }
    } catch { /* retry on next scroll */ }
    finally {
      loadingOlderRef.current = false;
    }
  }, [name]);

  const handleModelChange = async (model: string) => {
    setChangingModel(true);
    try {
      await openclawApi.updateAgent(name, { model });
      setCurrentModel(model);
      setShowModelPicker(false);
    } catch {} finally { setChangingModel(false); }
  };

  const openFilePicker = useCallback(async () => {
    setLoadingFiles(true);
    setShowFilePicker(true);
    try {
      const res = await openclawApi.listAgentFiles(name) as any;
      setWorkspaceFiles(res.data ?? []);
    } catch {} finally { setLoadingFiles(false); }
  }, [name]);

  const attachFile = useCallback(async (filename: string) => {
    if (pendingAttachments.find((a) => a.name === filename)) {
      setShowFilePicker(false);
      return;
    }
    try {
      const res = await openclawApi.getAgentFile(name, filename) as any;
      const content: string = res.data?.content ?? '';
      setPendingAttachments((prev) => [
        ...prev,
        { id: Date.now().toString(), name: filename, type: 'text', uri: content, mimeType: 'text/markdown', size: content.length },
      ]);
    } catch {} finally { setShowFilePicker(false); }
  }, [name, pendingAttachments]);

  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const msg = input;
    const attachments = [...pendingAttachments];
    setInput('');
    setPendingAttachments([]);
    pinnedRef.current = true;
    setPinnedToBottom(true);
    await sendMessageStream(name, msg, attachments);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [input, isStreaming, pendingAttachments, name, sendMessageStream]);

  const scrollToBottom = useCallback(() => {
    pinnedRef.current = true;
    setPinnedToBottom(true);
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  const handleScroll = useCallback((e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    const atBottom = distanceFromBottom < 80;
    if (atBottom !== pinnedRef.current) {
      pinnedRef.current = atBottom;
      setPinnedToBottom(atBottom);
    }
    if (contentOffset.y < 600) loadOlder();
  }, [loadOlder]);

  const messages = activeChat?.messages ?? [];

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={20}
    >
      <View style={s.handleWrap}><View style={s.handle} /></View>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.push(`/(auth)/(drawer)/agents/${name}` as any)} activeOpacity={0.8} hitSlop={8}>
          <AgentAvatar name={name} size={40} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.agentTitle}>{name}</Text>
          <TouchableOpacity onPress={() => setShowModelPicker(true)} activeOpacity={0.7} style={s.modelRow}>
            <Text style={s.modelText}>{currentModel ? currentModel.split('/').pop() : agent?.model ?? '...'}</Text>
            <Text style={s.modelArrow}>▾</Text>
          </TouchableOpacity>
          {fallbackModels.length > 0 && (
            <Text style={s.fallbackText}>Fallbacks: {fallbackModels.map((m) => m.split('/').pop()).join(', ')}</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn} hitSlop={10} activeOpacity={0.6}>
          <Text style={s.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Model Picker Modal */}
      <Modal visible={showModelPicker} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Select Model</Text>
            <ScrollView style={s.modelList}>
              {availableModels.length === 0 && (
                <Text style={{ color: theme.text.secondary, fontSize: 14, textAlign: 'center', paddingVertical: Spacing.md }}>
                  Loading models...
                </Text>
              )}
              {availableModels.map((model) => (
                <TouchableOpacity key={model} style={[s.modelOption, currentModel === model && s.modelOptionActive]} onPress={() => handleModelChange(model)} disabled={changingModel} activeOpacity={0.7}>
                  <Text style={[s.modelOptionText, currentModel === model && s.modelOptionTextActive]}>{model}</Text>
                  {currentModel === model && <Text style={s.modelCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.modalClose} onPress={() => setShowModelPicker(false)}>
              <Text style={s.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Workspace File Picker Modal */}
      <Modal visible={showFilePicker} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Attach Workspace File</Text>
            {loadingFiles ? (
              <ActivityIndicator color={theme.accent} style={{ marginVertical: Spacing.lg }} />
            ) : (
              <ScrollView style={s.modelList}>
                {workspaceFiles.length === 0 && (
                  <Text style={{ color: theme.text.secondary, fontSize: 14, textAlign: 'center', paddingVertical: Spacing.md }}>No workspace files found</Text>
                )}
                {workspaceFiles.map((file) => (
                  <TouchableOpacity key={file.filename} style={s.fileOption} onPress={() => attachFile(file.filename)} activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.fileOptionName}>{file.filename}</Text>
                      {file.preview ? <Text style={s.fileOptionPreview} numberOfLines={1}>{file.preview}</Text> : null}
                    </View>
                    {pendingAttachments.find((a) => a.name === file.filename) && (
                      <Text style={{ color: theme.accent, fontSize: 14 }}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={s.modalClose} onPress={() => setShowFilePicker(false)}>
              <Text style={s.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.messages}
        renderItem={({ item }) => {
          if (item.isError && item.errorType) {
            return <ErrorBadge type={item.errorType} rawMessage={item.content} theme={theme} />;
          }
          if (item.role === 'agent') {
            return (
              <View style={{ marginBottom: Spacing.sm }}>
                <AgentBubble content={item.content} streaming={item.streaming} toolActivity={item.toolActivity} theme={theme} colorScheme={colorScheme} />
                {!item.streaming && <AgentAvatar name={name} size={24} />}
              </View>
            );
          }
          return (
            <View>
              {item.attachments && item.attachments.length > 0 && (
                <View style={{ alignSelf: 'flex-end', flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4, maxWidth: '80%' }}>
                  {item.attachments.map((a: ChatAttachment) => (
                    <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.accent + '18', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, gap: 3 }}>
                      <Text style={{ fontSize: 11 }}>📄</Text>
                      <Text style={{ color: theme.accent, fontSize: 11 }} numberOfLines={1}>{a.name}</Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={[s.bubble, s.userBubble]}>
                <Text style={[s.bubbleText, s.userText]}>{item.content}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          loadingHistory ? (
            <View style={s.emptyWrap}><ActivityIndicator color={theme.accent} /></View>
          ) : (
            <View style={s.emptyWrap}>
              <AgentAvatar name={name} size={56} />
              <Text style={s.emptyTitle}>Chat with {name}</Text>
              <Text style={s.emptySubtitle}>Send a message to start the conversation.</Text>
            </View>
          )
        }
        onScroll={handleScroll}
        scrollEventThrottle={50}
        onContentSizeChange={() => { if (pinnedRef.current) listRef.current?.scrollToEnd({ animated: false }); }}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />

      {!pinnedToBottom && messages.length > 0 && (
        <TouchableOpacity
          style={[s.scrollFab, { bottom: insets.bottom + 90 + (pendingAttachments.length > 0 ? 40 : 0) }]}
          onPress={scrollToBottom}
          activeOpacity={0.8}
          hitSlop={6}
        >
          <Text style={s.scrollFabIcon}>↓</Text>
        </TouchableOpacity>
      )}

      {/* Pending attachments row */}
      {pendingAttachments.length > 0 && (
        <View style={s.attachmentsRow}>
          {pendingAttachments.map((a) => (
            <AttachmentChip key={a.id} attachment={a} onRemove={() => removeAttachment(a.id)} theme={theme} />
          ))}
        </View>
      )}

      {/* Input bar */}
      <View style={[s.inputBar, { paddingBottom: insets.bottom + Spacing.sm + 2 }]}>
        <TouchableOpacity onPress={openFilePicker} style={s.attachBtn} hitSlop={6} activeOpacity={0.7}>
          <Text style={s.attachIcon}>📎</Text>
        </TouchableOpacity>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder={`Message ${name}...`}
          placeholderTextColor={theme.text.secondary}
          multiline
          editable={!isStreaming}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        {isStreaming ? (
          <TouchableOpacity style={s.stopBtn} onPress={abortStream} activeOpacity={0.8}>
            <Text style={s.stopIcon}>■</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.sendBtn, !input.trim() && s.sendBtnOff]}
            onPress={handleSend}
            disabled={!input.trim()}
            activeOpacity={0.8}
          >
            <Text style={s.sendIcon}>↑</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },

  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: t.border },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border,
  },
  headerInfo: { flex: 1 },
  agentTitle: { color: t.text.primary, fontSize: 16, fontWeight: '700' },
  modelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  modelText: { color: t.accent, fontSize: 11, fontWeight: '600' },
  modelArrow: { color: t.accent, fontSize: 8 },
  fallbackText: { color: t.text.secondary, fontSize: 9, marginTop: 1, opacity: 0.7 },
  closeBtn: { padding: Spacing.xs },
  closeIcon: { color: t.text.secondary, fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: t.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, maxHeight: '65%' },
  modalTitle: { color: t.text.primary, fontSize: 18, fontWeight: '700', marginBottom: Spacing.md },
  modelList: { maxHeight: 380 },
  modelOption: { paddingVertical: 14, paddingHorizontal: Spacing.md, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modelOptionActive: { backgroundColor: t.accent + '15' },
  modelOptionText: { color: t.text.primary, fontSize: 15 },
  modelOptionTextActive: { color: t.accent, fontWeight: '600' },
  modelCheck: { color: t.accent, fontSize: 16, fontWeight: '700' },
  modalClose: { marginTop: Spacing.md, paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: t.border },
  modalCloseText: { color: t.text.secondary, fontSize: 15, fontWeight: '600' },

  fileOption: { paddingVertical: 12, paddingHorizontal: Spacing.md, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  fileOptionName: { color: t.text.primary, fontSize: 14, fontWeight: '600' },
  fileOptionPreview: { color: t.text.secondary, fontSize: 12, marginTop: 1 },

  messages: { padding: Spacing.md, paddingBottom: Spacing.sm, flexGrow: 1 },

  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, marginBottom: Spacing.sm },
  userBubble: { alignSelf: 'flex-end', backgroundColor: t.accent, borderBottomRightRadius: 6 },
  bubbleText: { color: t.text.primary, fontSize: 15, lineHeight: 21 },
  userText: { color: '#fff' },

  emptyWrap: { alignItems: 'center', gap: Spacing.sm, paddingTop: 80, paddingHorizontal: Spacing.xl },
  emptyTitle: { color: t.text.primary, fontSize: 18, fontWeight: '600', marginTop: Spacing.sm },
  emptySubtitle: { color: t.text.secondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  attachmentsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border,
  },

  scrollFab: {
    position: 'absolute',
    right: Spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  scrollFabIcon: { color: t.text.primary, fontSize: 18, fontWeight: '700' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border,
    backgroundColor: t.surface,
  },
  attachBtn: { paddingBottom: 6 },
  attachIcon: { fontSize: 22 },
  input: {
    flex: 1,
    backgroundColor: t.background,
    borderRadius: 22,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    color: t.text.primary, fontSize: 15,
    maxHeight: 110,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: t.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: t.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6,
    elevation: 4,
  },
  sendBtnOff: { backgroundColor: t.surface, shadowOpacity: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: -1 },
  stopBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: t.error + 'cc',
    alignItems: 'center', justifyContent: 'center',
  },
  stopIcon: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
