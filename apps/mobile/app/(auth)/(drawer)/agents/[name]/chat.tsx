import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, ScrollView, useColorScheme, AppState,
} from 'react-native';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MarkedBase, { Renderer as MarkedRenderer } from 'react-native-marked';
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
import type { ChatErrorType, ChatAttachment, ChatMessage, SessionSummary, CurrentSession } from '../../../../../stores/openclaw.store';
import { openclawApi } from '../../../../../services/openclaw.api';
import { approvalsApi } from '../../../../../services/openclaw-extras.api';
import type { AllowlistEntry } from '../../../../../services/openclaw-extras.api';
import { useTheme } from '../../../../../hooks/useTheme';
import { Spacing, BorderRadius } from '../../../../../theme';
import type { Theme } from '../../../../../theme';
import { AgentAvatar } from '../index';
import { ContextUsageBadge } from '../../../../../components/ContextUsageBadge';
import { ContextWarningBanner } from '../../../../../components/ContextWarningBanner';
import { SessionPickerSheet } from '../../../../../components/SessionPickerSheet';
import { CustomPopover, PopoverOption, PopoverSection } from '../../../../../components/ui';


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

type ModelDetail = {
  id: string;
  reasoning?: boolean;
  contextWindow?: number;
};

type ModelTier = 'all' | 'fast' | 'deep';

type ApprovalDefaults = {
  security: string;
  ask: string;
  askFallback: string;
};

type SlashAction = {
  key: string;
  label: string;
  hint: string;
  run: () => Promise<void> | void;
};

const SECURITY_OPTIONS = ['deny', 'allowlist', 'full'];
const ASK_OPTIONS = ['off', 'on-miss', 'always'];

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

// Strip OpenClaw timestamp prefix like "[Thu 2026-04-23 13:42 MDT] "
const TIMESTAMP_RE = /^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+\w+\]\s*/;
function stripTimestamp(text: string): string {
  return text.replace(TIMESTAMP_RE, '');
}

function buildServerMessageId(message: any): string {
  if (message.id) return `msg-${message.id}`;
  if (typeof message.index === 'number') return `msg-${message.index}-${message.role}`;
  const normalized = `${message.role}:${stripTimestamp(String(message.content ?? '')).trim().slice(0, 80)}`;
  const base = `${message.timestamp ?? 'na'}:${normalized}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0;
  }
  return `msg-fallback-${Math.abs(hash)}`;
}

function ToolPill({ label, active, theme }: { label: string; active?: boolean; theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 1.5 }}>
      <Text style={{ color: active ? theme.accent : theme.text.secondary, fontSize: 8, lineHeight: 12 }}>{active ? '●' : '✓'}</Text>
      <Text style={{ color: active ? theme.accent : theme.text.secondary, fontSize: 12, fontWeight: active ? '600' : '400' }}>{label}</Text>
    </View>
  );
}

function ToolActivityList({ tools, currentTool, theme }: { tools: string[]; currentTool?: string | null | undefined; theme: Theme }) {
  if (!tools.length && !currentTool) return null;
  // Dedupe while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of tools) {
    if (!seen.has(t)) { seen.add(t); unique.push(t); }
  }
  // If there's a current tool not yet in history, add it
  if (currentTool && !seen.has(currentTool)) {
    unique.push(currentTool);
  }
  return (
    <View style={{ marginBottom: 6, gap: 0 }}>
      {unique.map((tool, i) => {
        const isActive = currentTool === tool;
        return <ToolPill key={`${tool}-${i}`} label={tool} active={isActive} theme={theme} />;
      })}
    </View>
  );
}

function CodeBlockWithCopy({ code, language, theme }: { code: string; language?: string; theme: Theme }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <View style={{ marginVertical: 4, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.border + '30' }}>
        <Text style={{ color: theme.text.secondary, fontSize: 10, fontWeight: '600' }}>{language || 'code'}</Text>
        <TouchableOpacity onPress={onCopy} hitSlop={6} activeOpacity={0.6}>
          <Text style={{ color: theme.text.secondary, fontSize: 10, fontWeight: '600' }}>{copied ? '✓ Copied' : '⧉ Copy'}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: theme.surface, padding: 10 }}>
        <Text style={{ color: theme.text.primary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, lineHeight: 18 }}>{code}</Text>
      </ScrollView>
    </View>
  );
}

class CustomMarkdownRenderer extends MarkedRenderer {
  private theme: Theme;
  constructor(theme: Theme) {
    super();
    this.theme = theme;
  }
  code(text: string, language?: string) {
    return <CodeBlockWithCopy key={text.slice(0, 20)} code={text} {...(language ? { language } : {})} theme={this.theme} />;
  }
}

function AgentBubble({ content, streaming, toolActivity, toolHistory, theme, colorScheme }: { content: string; streaming?: boolean; toolActivity?: string | null; toolHistory?: string[]; theme: Theme; colorScheme: 'light' | 'dark' }) {
  const rendererRef = useRef<CustomMarkdownRenderer | null>(null);
  if (!rendererRef.current) rendererRef.current = new CustomMarkdownRenderer(theme);
  const markdownTheme = {
    code: { backgroundColor: theme.surface, color: theme.text.primary, borderRadius: 10, padding: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, overflow: 'scroll' as any },
    codespan: { backgroundColor: theme.surface, color: theme.accent, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
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
      {(toolHistory?.length || toolActivity) && (
        <ToolActivityList tools={toolHistory ?? []} currentTool={streaming ? toolActivity : null} theme={theme} />
      )}
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
          renderer={rendererRef.current}
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
  const {
    activeChat, openChat, sendMessageStream, abortStream, streamAbort, agents,
    currentSession, agentSessions,
    setCurrentSession, updateSessionUsage,
    loadAgentSessions, newSession, deleteSession,
  } = useOpenClawStore();
  const [input, setInput] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showComposerMenu, setShowComposerMenu] = useState(false);
  const [modelPickerAnchor, setModelPickerAnchor] = useState<'header' | 'composer'>('header');
  const [currentModel, setCurrentModel] = useState('');
  const [fallbackModels, setFallbackModels] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableModelDetails, setAvailableModelDetails] = useState<ModelDetail[]>([]);
  const [modelTier, setModelTier] = useState<ModelTier>('all');
  const [changingModel, setChangingModel] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<Array<{ filename: string; preview: string }>>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [compactionToast, setCompactionToast] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [approvalDefaults, setApprovalDefaults] = useState<ApprovalDefaults>({ security: 'full', ask: 'off', askFallback: 'full' });
  const [allowlistEntries, setAllowlistEntries] = useState<AllowlistEntry[]>([]);
  const [allowlistInput, setAllowlistInput] = useState('');
  const [savingPermissions, setSavingPermissions] = useState(false);
  const listRef = useRef<FlatList>(null);
  const headerModelAnchorRef = useRef<any>(null);
  const composerMenuAnchorRef = useRef<any>(null);
  const modelAnchorRef = useRef<any>(null);
  const pinnedRef = useRef(true);
  const sessionRef = useRef<{ key: string; oldestIndex: number; newestIndex: number; total: number; compactionCount: number } | null>(null);
  const loadingOlderRef = useRef(false);
  const warningDismissedRef = useRef<{ soft: boolean; hard: boolean }>({ soft: false, hard: false });

  const PAGE_SIZE = 50;

  const jumpToLatest = useCallback((animated = false) => {
    pinnedRef.current = true;
    setPinnedToBottom(true);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
  }, []);

  const mapMessage = (m: any): ChatMessage => ({
    id: buildServerMessageId(m),
    role: m.role === 'user' ? 'user' : 'agent',
    content: m.content,
    timestamp: m.timestamp ?? new Date().toISOString(),
  });
  const insets = useSafeAreaInsets();
  const agent = agents.find((a) => a.name === name);
  const isStreaming = !!streamAbort;
  const currentModelMeta = useMemo(
    () => availableModelDetails.find((detail) => detail.id === currentModel),
    [availableModelDetails, currentModel],
  );
  const filteredModels = useMemo(
    () => availableModels.filter((model) => {
      if (modelTier === 'all') return true;
      const detail = availableModelDetails.find((entry) => entry.id === model);
      return modelTier === 'deep' ? Boolean(detail?.reasoning) : !detail?.reasoning;
    }),
    [availableModels, availableModelDetails, modelTier],
  );

  const openModelPicker = useCallback((anchor: 'header' | 'composer' = 'header') => {
    setModelTier(currentModelMeta ? (currentModelMeta.reasoning ? 'deep' : 'fast') : 'all');
    setModelPickerAnchor(anchor);
    setShowComposerMenu(false);
    setShowModelPicker(true);
  }, [currentModelMeta]);

  const loadSession = useCallback(async (key: string, opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoadingHistory(true);
    try {
      const sessionRes: any = await openclawApi.getSession(key, { limit: PAGE_SIZE });
      const data = sessionRes.data ?? {};
      const messages: ChatMessage[] = (data.messages ?? []).map(mapMessage);
      const [agentId] = key.split('/');
      const sessionId = key.slice((agentId?.length ?? 0) + 1);
      sessionRef.current = {
        key,
        oldestIndex: data.firstIndex ?? -1,
        newestIndex: data.lastIndex ?? -1,
        total: data.total ?? messages.length,
        compactionCount: data.compactionCount ?? 0,
      };
      warningDismissedRef.current = { soft: false, hard: false };
      const store = useOpenClawStore.getState();
      store.setCurrentSession({
        key,
        agentId: agentId ?? name,
        sessionId,
        model: data.model ?? '',
        contextWindow: data.contextWindow ?? 0,
        usage: data.usage ?? { totalTokens: 0, lastInputTokens: 0, lastOutputTokens: 0, lastCacheReadTokens: 0, contextUsedTokens: 0, totalTokensFresh: false },
        compactionCount: data.compactionCount ?? 0,
      });
      // Replace active chat history with messages from the newly selected session.
      useOpenClawStore.setState({
        activeChat: { agentName: name, sessionKey: key, messages },
      });
      jumpToLatest(false);
    } catch { /* ignore — next poll will retry */ }
    finally { if (!opts.silent) setLoadingHistory(false); }
  }, [jumpToLatest, name]);

  useEffect(() => {
    openChat(name);
    openclawApi.getAgent(name).then((res: any) => {
      setCurrentModel(res.data?.model ?? '');
      setFallbackModels(res.data?.fallbackModels ?? []);
    }).catch(() => {});
    openclawApi.getConfig().then((res: any) => {
      const models: string[] = res.data?.availableModels ?? [];
      if (models.length) setAvailableModels(models);
      const details: ModelDetail[] = res.data?.availableModelDetails ?? [];
      if (details.length) setAvailableModelDetails(details);
    }).catch(() => {});

    let cancelled = false;
    sessionRef.current = null;

    // Track app foreground/background state to pause polling when backgrounded.
    let appIsActive = AppState.currentState === 'active';
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      appIsActive = nextState === 'active';
    });

    const initial = async () => {
      try {
        const sessions = await useOpenClawStore.getState().loadAgentSessions(name);
        if (cancelled) return;
        let key = sessions[0]?.key ?? null;
        if (!key) {
          const created = await useOpenClawStore.getState().newSession(name);
          key = created?.key ?? null;
        }
        if (!key || cancelled) { setLoadingHistory(false); return; }
        await loadSession(key);
      } catch { setLoadingHistory(false); }
    };

    const syncTail = async () => {
      if (!appIsActive) return;
      const sref = sessionRef.current;
      if (!sref) return;
      const storeState = useOpenClawStore.getState();
      if (storeState.streamAbort || storeState.resumeAbort) return;
      try {
        const res: any = await openclawApi.getSession(sref.key, { afterIndex: sref.newestIndex });
        if (cancelled) return;
        const data = res.data ?? {};
        const messages: ChatMessage[] = (data.messages ?? []).map(mapMessage);
        if (messages.length) {
          sref.newestIndex = data.lastIndex ?? sref.newestIndex;
          sref.total = data.total ?? sref.total;
          useOpenClawStore.getState().appendChatMessages(name, sref.key, messages);
        }
        // Update usage + detect compaction on every tick, not only when new messages arrive.
        const store = useOpenClawStore.getState();
        if (store.currentSession?.key === sref.key) {
          store.updateSessionUsage({
            usage: data.usage ?? store.currentSession.usage,
            compactionCount: data.compactionCount ?? store.currentSession.compactionCount,
            model: data.model ?? store.currentSession.model,
            contextWindow: data.contextWindow ?? store.currentSession.contextWindow,
          });
        }
        if ((data.compactionCount ?? 0) > sref.compactionCount) {
          sref.compactionCount = data.compactionCount;
          warningDismissedRef.current = { soft: false, hard: false };
          setCompactionToast(true);
          setTimeout(() => setCompactionToast(false), 4500);
        }
      } catch { /* next tick */ }
    };

    initial();

    const interval = setInterval(syncTail, 3000);

    // Resume any in-flight stream for this agent that was started before the screen mounted.
    const store = useOpenClawStore.getState();
    if (store.hasResumableStream(name) && !store.streamAbort && !store.resumeAbort) {
      void store.resumeActiveStream();
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [name, loadSession, openChat]);

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
        useOpenClawStore.getState().prependChatMessages(name, sref.key, messages);
      } else {
        sref.oldestIndex = 0;
      }
    } catch { /* retry on next scroll */ }
    finally {
      loadingOlderRef.current = false;
    }
  }, [name]);

  const openSessionPicker = useCallback(async () => {
    setShowComposerMenu(false);
    setShowSessionPicker(true);
    setLoadingSessions(true);
    try { await loadAgentSessions(name); } finally { setLoadingSessions(false); }
  }, [name, loadAgentSessions]);

  const handleSelectSession = useCallback(async (key: string) => {
    setShowSessionPicker(false);
    if (sessionRef.current?.key === key) return;
    sessionRef.current = null;
    await loadSession(key);
  }, [loadSession]);

  const handleNewSession = useCallback(async () => {
    const created = await newSession(name);
    if (!created) return;
    setShowSessionPicker(false);
    sessionRef.current = null;
    await loadSession(created.key);
  }, [name, newSession, loadSession]);

  const handleDeleteSession = useCallback(async (key: string) => {
    const [agentId, sessionId] = key.split('/');
    if (!agentId || !sessionId) return;
    setDeletingKey(key);
    const wasActive = sessionRef.current?.key === key;
    const ok = await deleteSession(agentId, sessionId);
    setDeletingKey(null);
    if (!ok) return;
    if (wasActive) {
      sessionRef.current = null;
      const remaining = useOpenClawStore.getState().agentSessions;
      const fallbackKey = remaining.find((sess) => sess.key !== key)?.key ?? null;
      if (fallbackKey) {
        await loadSession(fallbackKey);
      } else {
        const created = await newSession(name);
        if (created) await loadSession(created.key);
      }
    }
  }, [deleteSession, newSession, loadSession, name]);

  const handleModelChange = async (model: string, opts: { close?: boolean } = {}) => {
    setChangingModel(true);
    try {
      await openclawApi.updateAgent(name, { model });
      setCurrentModel(model);
      if (opts.close !== false) setShowModelPicker(false);
    } catch {} finally { setChangingModel(false); }
  };

  const applyModelTier = useCallback(async (tier: ModelTier) => {
    setModelTier(tier);
    if (tier === 'all') return;
    const currentProvider = currentModel.split('/')[0] ?? '';
    const candidates = availableModelDetails.filter((detail) =>
      (tier === 'deep' ? Boolean(detail.reasoning) : !detail.reasoning));
    const preferred = candidates.find((detail) => detail.id.startsWith(`${currentProvider}/`)) ?? candidates[0];
    if (preferred?.id && preferred.id !== currentModel) {
      await handleModelChange(preferred.id, { close: false });
    }
  }, [availableModelDetails, currentModel]);

  const openPermissions = useCallback(async () => {
    setShowComposerMenu(false);
    setShowPermissionsModal(true);
    setPermissionsLoading(true);
    try {
      const [config, allowlist] = await Promise.all([
        approvalsApi.getConfig(),
        approvalsApi.listAllowlist(name),
      ]);
      setApprovalDefaults(config.defaults);
      setAllowlistEntries(allowlist[name] ?? []);
    } catch { /* ignore */ } finally {
      setPermissionsLoading(false);
    }
  }, [name]);

  const updateApprovalSetting = useCallback(async (field: keyof ApprovalDefaults, value: string) => {
    const prev = approvalDefaults;
    const next = { ...prev, [field]: value };
    setApprovalDefaults(next);
    setSavingPermissions(true);
    try {
      await approvalsApi.setDefaults({ [field]: value });
    } catch {
      setApprovalDefaults(prev);
    } finally {
      setSavingPermissions(false);
    }
  }, [approvalDefaults]);

  const addAllowlistEntry = useCallback(async () => {
    const pattern = allowlistInput.trim();
    if (!pattern) return;
    setSavingPermissions(true);
    try {
      const entry = await approvalsApi.addEntry(name, pattern, 'mobile');
      setAllowlistEntries((prev) => [entry, ...prev.filter((item) => item.id !== entry.id)]);
      setAllowlistInput('');
    } catch { /* ignore */ } finally {
      setSavingPermissions(false);
    }
  }, [allowlistInput, name]);

  const removeAllowlistEntry = useCallback(async (id: string) => {
    const prev = allowlistEntries;
    setAllowlistEntries((entries) => entries.filter((entry) => entry.id !== id));
    setSavingPermissions(true);
    try {
      await approvalsApi.removeEntry(name, id);
    } catch {
      setAllowlistEntries(prev);
    } finally {
      setSavingPermissions(false);
    }
  }, [allowlistEntries, name]);

  const openFilePicker = useCallback(async () => {
    setShowComposerMenu(false);
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

  const slashActions = useMemo<SlashAction[]>(() => ([
    { key: 'new', label: 'New session', hint: 'Start a fresh chat session', run: handleNewSession },
    { key: 'sessions', label: 'Sessions', hint: 'Open session history', run: openSessionPicker },
    { key: 'model', label: 'Model', hint: 'Change model and intelligence', run: openModelPicker },
    { key: 'permissions', label: 'Permissions', hint: 'Edit approvals and allowlist', run: openPermissions },
    { key: 'files', label: 'Files', hint: 'Attach a workspace file', run: openFilePicker },
  ]), [handleNewSession, openSessionPicker, openModelPicker, openPermissions, openFilePicker]);

  const slashQuery = input.startsWith('/') ? input.slice(1).trim().toLowerCase() : '';
  const slashMatches = input.startsWith('/')
    ? slashActions.filter((action) => action.key.includes(slashQuery) || action.label.toLowerCase().includes(slashQuery))
    : [];

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    if (trimmed.startsWith('/')) {
      const command = slashActions.find((action) => `/${action.key}` === trimmed.toLowerCase());
      if (command) {
        setInput('');
        await command.run();
      }
      return;
    }
    const msg = input;
    const attachments = [...pendingAttachments];
    setInput('');
    setPendingAttachments([]);
    pinnedRef.current = true;
    setPinnedToBottom(true);
    await sendMessageStream(name, msg, attachments);
    setTimeout(() => jumpToLatest(true), 100);
  }, [input, isStreaming, pendingAttachments, name, sendMessageStream, jumpToLatest, slashActions]);

  const scrollToBottom = useCallback(() => {
    jumpToLatest(true);
  }, [jumpToLatest]);

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
      <View style={[s.handleWrap, { paddingTop: insets.top + 10 }]}><View style={s.handle} /></View>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.push(`/(auth)/(drawer)/agents/${name}` as any)} activeOpacity={0.8} hitSlop={8}>
          <AgentAvatar name={name} size={40} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.agentTitle}>{name}</Text>
          <TouchableOpacity ref={headerModelAnchorRef} onPress={() => openModelPicker('header')} activeOpacity={0.7} style={s.modelRow}>
            <Text style={s.modelText}>
              {currentModel ? currentModel.split('/').pop() : agent?.model ?? '...'}
              {currentModelMeta ? ` · ${currentModelMeta.reasoning ? 'Deep' : 'Fast'}` : ''}
            </Text>
            <Text style={s.modelArrow}>▾</Text>
          </TouchableOpacity>
          {fallbackModels.length > 0 && (
            <Text style={s.fallbackText}>Fallbacks: {fallbackModels.map((m) => m.split('/').pop()).join(', ')}</Text>
          )}
        </View>
        {currentSession && currentSession.contextWindow > 0 && (
          <ContextUsageBadge
            used={currentSession.usage.contextUsedTokens}
            contextWindow={currentSession.contextWindow}
            compactionCount={currentSession.compactionCount}
            theme={theme}
            onPress={openSessionPicker}
          />
        )}
        <TouchableOpacity onPress={openSessionPicker} style={s.closeBtn} hitSlop={10} activeOpacity={0.6}>
          <Text style={s.closeIcon}>☰</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openPermissions} style={s.closeBtn} hitSlop={10} activeOpacity={0.6}>
          <Text style={s.closeIcon}>⚙</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn} hitSlop={10} activeOpacity={0.6}>
          <Text style={s.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {compactionToast && (
        <View style={{ marginHorizontal: Spacing.md, marginTop: Spacing.xs, padding: 10, borderRadius: 10, backgroundColor: theme.accent + '18', borderWidth: StyleSheet.hairlineWidth, borderColor: theme.accent + '55' }}>
          <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>↻ Session compacted — older messages summarized.</Text>
        </View>
      )}

      <CustomPopover
        visible={showModelPicker}
        anchorRef={modelPickerAnchor === 'composer' ? modelAnchorRef : headerModelAnchorRef}
        onClose={() => setShowModelPicker(false)}
        theme={theme}
        width={290}
        maxHeight={440}
        align="right"
      >
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <PopoverSection title="Intelligence" theme={theme}>
            {([
              { key: 'fast', label: 'Low', subtitle: 'Quick replies' },
              { key: 'all', label: 'Medium', subtitle: 'Balanced default' },
              { key: 'deep', label: 'High', subtitle: 'Reasoning first' },
            ] as const).map((tier) => (
              <PopoverOption
                key={tier.key}
                theme={theme}
                label={tier.label}
                subtitle={tier.subtitle}
                active={modelTier === tier.key}
                compact
                onPress={() => { void applyModelTier(tier.key); }}
              />
            ))}
          </PopoverSection>
          <PopoverSection title="Models" theme={theme}>
            {filteredModels.length === 0 ? (
              availableModels.length === 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm }}>
                  <ActivityIndicator size="small" color={theme.text.secondary} />
                  <Text style={{ color: theme.text.secondary, fontSize: 13 }}>Loading models...</Text>
                </View>
              ) : (
                <Text style={{ color: theme.text.secondary, fontSize: 13, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm }}>
                  No models match this tier yet.
                </Text>
              )
            ) : filteredModels.map((model) => {
              const meta = availableModelDetails.find((entry) => entry.id === model);
              return (
                <PopoverOption
                  key={model}
                  theme={theme}
                  label={model.split('/').pop() ?? model}
                  subtitle={`${meta?.reasoning ? 'Deep reasoning' : 'Fast response'}${meta?.contextWindow ? ` · ${(meta.contextWindow / 1000).toFixed(meta.contextWindow >= 100000 ? 0 : 1)}k ctx` : ''}`}
                  {...(model.includes('/') ? { value: model.split('/')[0] ?? '' } : {})}
                  active={currentModel === model}
                  onPress={() => { void handleModelChange(model); }}
                />
              );
            })}
          </PopoverSection>
        </ScrollView>
      </CustomPopover>

      <Modal visible={showPermissionsModal} transparent animationType="slide" onRequestClose={() => setShowPermissionsModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Permissions</Text>
            {permissionsLoading ? (
              <ActivityIndicator color={theme.accent} style={{ marginVertical: Spacing.lg }} />
            ) : (
              <ScrollView style={s.modelList} keyboardShouldPersistTaps="handled">
                <View style={s.permissionCard}>
                  <Text style={s.permissionTitle}>Global approval defaults</Text>
                  <Text style={s.permissionHint}>These settings affect how commands are approved across agents.</Text>

                  <Text style={s.permissionLabel}>Security</Text>
                  <View style={s.permissionChips}>
                    {SECURITY_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[s.permissionChip, approvalDefaults.security === option && s.permissionChipActive]}
                        onPress={() => { void updateApprovalSetting('security', option); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.permissionChipText, approvalDefaults.security === option && s.permissionChipTextActive]}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.permissionLabel}>Ask</Text>
                  <View style={s.permissionChips}>
                    {ASK_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[s.permissionChip, approvalDefaults.ask === option && s.permissionChipActive]}
                        onPress={() => { void updateApprovalSetting('ask', option); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.permissionChipText, approvalDefaults.ask === option && s.permissionChipTextActive]}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.permissionLabel}>Fallback</Text>
                  <View style={s.permissionChips}>
                    {SECURITY_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[s.permissionChip, approvalDefaults.askFallback === option && s.permissionChipActive]}
                        onPress={() => { void updateApprovalSetting('askFallback', option); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.permissionChipText, approvalDefaults.askFallback === option && s.permissionChipTextActive]}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={s.permissionCard}>
                  <Text style={s.permissionTitle}>{name} allowlist</Text>
                  <Text style={s.permissionHint}>Store command patterns this agent can run without another approval.</Text>
                  <View style={s.allowlistComposer}>
                    <TextInput
                      style={s.allowlistInput}
                      value={allowlistInput}
                      onChangeText={setAllowlistInput}
                      placeholder="/bin/ls"
                      placeholderTextColor={theme.text.secondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity style={s.allowlistAddBtn} onPress={() => { void addAllowlistEntry(); }} activeOpacity={0.8} disabled={!allowlistInput.trim() || savingPermissions}>
                      <Text style={s.allowlistAddText}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  {allowlistEntries.length === 0 ? (
                    <Text style={s.permissionHint}>No saved command patterns for this agent yet.</Text>
                  ) : allowlistEntries.map((entry) => (
                    <View key={entry.id} style={s.allowlistRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={s.allowlistPattern} numberOfLines={1}>{entry.pattern}</Text>
                        {entry.lastUsedCommand ? <Text style={s.allowlistMeta} numberOfLines={1}>{entry.lastUsedCommand}</Text> : null}
                      </View>
                      <TouchableOpacity onPress={() => { void removeAllowlistEntry(entry.id); }} hitSlop={8}>
                        <Text style={{ color: theme.error, fontSize: 16 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
            <TouchableOpacity style={s.modalClose} onPress={() => setShowPermissionsModal(false)}>
              <Text style={s.modalCloseText}>{savingPermissions ? 'Saving…' : 'Close'}</Text>
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

      {/* Context warnings */}
      {(() => {
        if (!currentSession || currentSession.contextWindow <= 0) return null;
        const pct = (currentSession.usage.contextUsedTokens / currentSession.contextWindow) * 100;
        if (pct >= 95 && !warningDismissedRef.current.hard) return <ContextWarningBanner level="hard" theme={theme} />;
        if (pct >= 80 && !warningDismissedRef.current.soft) return <ContextWarningBanner level="soft" theme={theme} />;
        return null;
      })()}

      {/* Session Picker Sheet */}
      <SessionPickerSheet
        visible={showSessionPicker}
        sessions={agentSessions}
        activeKey={currentSession?.key ?? null}
        loading={loadingSessions}
        busyKey={deletingKey}
        theme={theme}
        initialAgentId={name}
        onClose={() => setShowSessionPicker(false)}
        onSelect={handleSelectSession}
        onNew={handleNewSession}
        onDelete={handleDeleteSession}
      />

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
                <AgentBubble content={item.content} streaming={item.streaming} toolActivity={item.toolActivity} toolHistory={item.toolHistory} theme={theme} colorScheme={colorScheme} />
                {!item.streaming && item.content.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <AgentAvatar name={name} size={24} />
                    <CopyButton content={item.content} theme={theme} variant="agent" />
                  </View>
                )}
                {!item.streaming && item.content.length === 0 && <AgentAvatar name={name} size={24} />}
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
                <Text style={[s.bubbleText, s.userText]}>{stripTimestamp(item.content)}</Text>
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

      {/* Input bar */}
      {slashMatches.length > 0 && (
        <View style={[s.slashMenu, { bottom: insets.bottom + 78 + (pendingAttachments.length > 0 ? 40 : 0) }]}>
          {slashMatches.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={s.slashRow}
              onPress={() => {
                setInput('');
                void action.run();
              }}
              activeOpacity={0.75}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.slashTitle}>/{action.key}</Text>
                <Text style={s.slashHint}>{action.hint}</Text>
              </View>
              <Text style={s.slashLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <CustomPopover
        visible={showComposerMenu}
        anchorRef={composerMenuAnchorRef}
        onClose={() => setShowComposerMenu(false)}
        theme={theme}
        width={258}
        maxHeight={340}
        align="left"
      >
        <PopoverSection theme={theme}>
          <PopoverOption theme={theme} label="Add photos & files" icon="📎" subtitle="Attach workspace context" onPress={() => { void openFilePicker(); }} />
          <PopoverOption
            theme={theme}
            label="Plan mode"
            icon="🪄"
            subtitle="Structured prompts and shortcuts"
            value="Soon"
            onPress={() => setShowComposerMenu(false)}
          />
          <PopoverOption theme={theme} label="Sessions" icon="☰" subtitle="Switch or start a new thread" onPress={() => { void openSessionPicker(); }} />
          <PopoverOption theme={theme} label="Permissions" icon="⚙" subtitle="Adjust approvals and allowlist" onPress={() => { void openPermissions(); }} />
        </PopoverSection>
      </CustomPopover>
      <View style={[s.inputBar, { paddingBottom: insets.bottom + Spacing.sm + 2 }]}>
        <View style={s.composerShell}>
          {pendingAttachments.length > 0 && (
            <View style={s.composerAttachments}>
              {pendingAttachments.map((a) => (
                <AttachmentChip key={a.id} attachment={a} onRemove={() => removeAttachment(a.id)} theme={theme} />
              ))}
            </View>
          )}
          <View style={s.composerMainRow}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder={`Message ${name} or type / for shortcuts...`}
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
          <View style={s.composerFooter}>
            <TouchableOpacity
              ref={composerMenuAnchorRef}
              onPress={() => {
                setShowModelPicker(false);
                setShowComposerMenu((visible) => !visible);
              }}
              style={s.footerPill}
              hitSlop={6}
              activeOpacity={0.7}
            >
              <Text style={s.footerPillIcon}>＋</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openPermissions} style={[s.footerPill, s.footerWidePill]} hitSlop={6} activeOpacity={0.7}>
              <Text style={s.footerPillIcon}>☝︎</Text>
              <Text style={s.footerPillText}>Default permissions</Text>
              <Text style={s.footerPillChevron}>▾</Text>
            </TouchableOpacity>
            <TouchableOpacity
              ref={modelAnchorRef}
              onPress={() => {
                setShowComposerMenu(false);
                openModelPicker('composer');
              }}
              style={[s.footerPill, s.footerModelPill]}
              hitSlop={6}
              activeOpacity={0.7}
            >
              <Text style={s.footerPillText}>
                {currentModel ? currentModel.split('/').pop() : 'Model'}
                {currentModelMeta ? ` ${currentModelMeta.reasoning ? 'High' : 'Medium'}` : ''}
              </Text>
              <Text style={s.footerPillChevron}>▾</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  tierRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  tierChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, backgroundColor: t.background,
  },
  tierChipActive: { backgroundColor: t.accent + '1f', borderColor: t.accent + '66' },
  tierChipText: { color: t.text.secondary, fontSize: 12, fontWeight: '600' },
  tierChipTextActive: { color: t.accent },
  modelList: { maxHeight: 380 },
  modelOption: { paddingVertical: 14, paddingHorizontal: Spacing.md, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modelOptionActive: { backgroundColor: t.accent + '15' },
  modelOptionText: { color: t.text.primary, fontSize: 15 },
  modelOptionTextActive: { color: t.accent, fontWeight: '600' },
  modelCheck: { color: t.accent, fontSize: 16, fontWeight: '700' },
  modalClose: { marginTop: Spacing.md, paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: t.border },
  modalCloseText: { color: t.text.secondary, fontSize: 15, fontWeight: '600' },
  permissionCard: {
    backgroundColor: t.background,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    gap: 10,
    marginBottom: Spacing.md,
  },
  permissionTitle: { color: t.text.primary, fontSize: 14, fontWeight: '700' },
  permissionHint: { color: t.text.secondary, fontSize: 12, lineHeight: 17 },
  permissionLabel: { color: t.text.secondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  permissionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  permissionChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, backgroundColor: t.surface,
  },
  permissionChipActive: { backgroundColor: t.accent + '1f', borderColor: t.accent + '66' },
  permissionChipText: { color: t.text.secondary, fontSize: 12, fontWeight: '600' },
  permissionChipTextActive: { color: t.accent },
  allowlistComposer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  allowlistInput: {
    flex: 1, backgroundColor: t.surface, color: t.text.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  allowlistAddBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: t.accent },
  allowlistAddText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  allowlistRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border,
  },
  allowlistPattern: { color: t.text.primary, fontSize: 13, fontWeight: '600' },
  allowlistMeta: { color: t.text.secondary, fontSize: 11 },

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
  slashMenu: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: t.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    overflow: 'hidden',
    zIndex: 20,
  },
  slashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.border,
  },
  slashTitle: { color: t.text.primary, fontSize: 13, fontWeight: '700' },
  slashHint: { color: t.text.secondary, fontSize: 11, marginTop: 2 },
  slashLabel: { color: t.accent, fontSize: 12, fontWeight: '600' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    backgroundColor: t.background,
  },
  composerShell: {
    flex: 1,
    backgroundColor: t.surface,
    borderRadius: 28,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  composerAttachments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: Spacing.xs,
  },
  composerMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  footerPill: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: t.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerWidePill: {
    flex: 1,
  },
  footerModelPill: {
    maxWidth: '42%',
  },
  footerPillIcon: {
    color: t.text.secondary,
    fontSize: 14,
    fontWeight: '700',
  },
  footerPillText: {
    color: t.text.secondary,
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  footerPillChevron: {
    color: t.text.secondary,
    fontSize: 10,
  },
  input: {
    flex: 1,
    minHeight: 54,
    backgroundColor: 'transparent',
    borderRadius: 22,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    color: t.text.primary, fontSize: 15,
    maxHeight: 110,
    textAlignVertical: 'top',
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
