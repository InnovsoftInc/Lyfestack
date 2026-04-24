import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, ScrollView, useColorScheme,
} from 'react-native';
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOpenClawStore } from '../../../../../stores/openclaw.store';
import type { ChatAttachment } from '../../../../../stores/openclaw.store';
import { openclawApi } from '../../../../../services/openclaw.api';
import { approvalsApi } from '../../../../../services/openclaw-extras.api';
import type { AllowlistEntry } from '../../../../../services/openclaw-extras.api';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemeStore } from '../../../../../stores/theme.store';
import { useChatEngine } from '../../../../../hooks/useChatEngine';
import { Spacing } from '../../../../../theme';
import type { Theme } from '../../../../../theme';
import { AgentAvatar } from '../index';
import { ContextWarningBanner } from '../../../../../components/ContextWarningBanner';
import { SessionPickerSheet } from '../../../../../components/SessionPickerSheet';
import { CustomPopover, PopoverOption, PopoverSection, ProgressRing, LiquidGlassButton } from '../../../../../components/ui';
import { ChatView, ChatComposer } from '../../../../../components/chat';
import type { ChatViewHandle } from '../../../../../components/chat';

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

export default function AgentChatScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const theme = useTheme();
  const isDark = useThemeStore((s) => s.isDark);
  const colorScheme = (useColorScheme() ?? 'dark') as 'light' | 'dark';
  const s = styles(theme);
  const insets = useSafeAreaInsets();

  const {
    messages, isStreaming, loadingHistory, compactionToast, warningDismissedRef,
    send, abort, loadSession, loadOlder, rolloverThread, sessions: agentSessions, currentSession,
    newSession, deleteSession, loadAgentSessions,
  } = useChatEngine(name);

  const { agents } = useOpenClawStore();
  const agent = agents.find((a) => a.name === name);

  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  // Model picker state
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showComposerMenu, setShowComposerMenu] = useState(false);
  const [currentModel, setCurrentModel] = useState('');
  const [fallbackModels, setFallbackModels] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableModelDetails, setAvailableModelDetails] = useState<ModelDetail[]>([]);
  const [modelTier, setModelTier] = useState<ModelTier>('all');
  const [changingModel, setChangingModel] = useState(false);

  // Session picker state
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  // File picker state
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<Array<{ filename: string; preview: string }>>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Permissions modal state
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [approvalDefaults, setApprovalDefaults] = useState<ApprovalDefaults>({ security: 'full', ask: 'off', askFallback: 'full' });
  const [allowlistEntries, setAllowlistEntries] = useState<AllowlistEntry[]>([]);
  const [allowlistInput, setAllowlistInput] = useState('');
  const [savingPermissions, setSavingPermissions] = useState(false);

  const chatViewRef = useRef<ChatViewHandle>(null);
  const composerMenuAnchorRef = useRef<any>(null);
  const modelAnchorRef = useRef<any>(null);

  useEffect(() => {
    openclawApi.getAgent(name).then((res: any) => {
      setCurrentModel(res.data?.model ?? '');
      setFallbackModels(res.data?.fallbackModels ?? []);
      setIsConnected(true);
    }).catch(() => { setIsConnected(false); });
    openclawApi.getConfig().then((res: any) => {
      const models: string[] = res.data?.availableModels ?? [];
      if (models.length) setAvailableModels(models);
      const details: ModelDetail[] = res.data?.availableModelDetails ?? [];
      if (details.length) setAvailableModelDetails(details);
    }).catch(() => {});
  }, [name]);

  const currentModelMeta = useMemo(
    () => availableModelDetails.find((d) => d.id === currentModel),
    [availableModelDetails, currentModel],
  );

  const filteredModels = useMemo(
    () => availableModels.filter((model) => {
      if (modelTier === 'all') return true;
      const detail = availableModelDetails.find((e) => e.id === model);
      return modelTier === 'deep' ? Boolean(detail?.reasoning) : !detail?.reasoning;
    }),
    [availableModels, availableModelDetails, modelTier],
  );

  const openModelPicker = useCallback(() => {
    setModelTier(currentModelMeta ? (currentModelMeta.reasoning ? 'deep' : 'fast') : 'all');
    setShowComposerMenu(false);
    setShowModelPicker(true);
  }, [currentModelMeta]);

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
    const candidates = availableModelDetails.filter((d) =>
      tier === 'deep' ? Boolean(d.reasoning) : !d.reasoning);
    const preferred = candidates.find((d) => d.id.startsWith(`${currentProvider}/`)) ?? candidates[0];
    if (preferred?.id && preferred.id !== currentModel) {
      await handleModelChange(preferred.id, { close: false });
    }
  }, [availableModelDetails, currentModel]);

  const openSessionPicker = useCallback(async () => {
    setShowComposerMenu(false);
    setShowSessionPicker(true);
    setLoadingSessions(true);
    try { await loadAgentSessions(name); } finally { setLoadingSessions(false); }
  }, [name, loadAgentSessions]);

  const handleSelectSession = useCallback(async (key: string) => {
    setShowSessionPicker(false);
    if (currentSession?.key === key) return;
    await loadSession(key);
    chatViewRef.current?.scrollToBottom(false);
  }, [loadSession, currentSession]);

  // "New session" is now a thread rollover: the visible thread stays, the
  // backend runtime session is replaced. Preserves continuous history.
  const handleNewSession = useCallback(async () => {
    setShowSessionPicker(false);
    await rolloverThread();
    chatViewRef.current?.scrollToBottom(false);
  }, [rolloverThread]);

  const handleDeleteSession = useCallback(async (key: string) => {
    const [agentId, sessionId] = key.split('/');
    if (!agentId || !sessionId) return;
    setDeletingKey(key);
    const wasActive = currentSession?.key === key;
    const ok = await deleteSession(agentId, sessionId);
    setDeletingKey(null);
    if (!ok) return;
    if (wasActive) {
      const remaining = useOpenClawStore.getState().agentSessions;
      const fallbackKey = remaining.find((sess) => sess.key !== key)?.key ?? null;
      if (fallbackKey) {
        await loadSession(fallbackKey);
      } else {
        const created = await newSession(name);
        if (created) await loadSession(created.key);
      }
    }
  }, [deleteSession, newSession, loadSession, name, currentSession]);

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
    setApprovalDefaults({ ...prev, [field]: value });
    setSavingPermissions(true);
    try {
      await approvalsApi.setDefaults({ [field]: value });
    } catch { setApprovalDefaults(prev); }
    finally { setSavingPermissions(false); }
  }, [approvalDefaults]);

  const addAllowlistEntry = useCallback(async () => {
    const pattern = allowlistInput.trim();
    if (!pattern) return;
    setSavingPermissions(true);
    try {
      const entry = await approvalsApi.addEntry(name, pattern, 'mobile');
      setAllowlistEntries((prev) => [entry, ...prev.filter((item) => item.id !== entry.id)]);
      setAllowlistInput('');
    } catch { /* ignore */ } finally { setSavingPermissions(false); }
  }, [allowlistInput, name]);

  const removeAllowlistEntry = useCallback(async (id: string) => {
    const prev = allowlistEntries;
    setAllowlistEntries((entries) => entries.filter((e) => e.id !== id));
    setSavingPermissions(true);
    try {
      await approvalsApi.removeEntry(name, id);
    } catch { setAllowlistEntries(prev); }
    finally { setSavingPermissions(false); }
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
    if (pendingAttachments.find((a) => a.name === filename)) { setShowFilePicker(false); return; }
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
    { key: 'new', label: 'New session', hint: 'Roll over to a fresh backend session (thread stays)', run: handleNewSession },
    { key: 'model', label: 'Model', hint: 'Change model and intelligence', run: openModelPicker },
    { key: 'permissions', label: 'Permissions', hint: 'Edit approvals and allowlist', run: openPermissions },
    { key: 'files', label: 'Files', hint: 'Attach a workspace file', run: openFilePicker },
    { key: 'sessions', label: 'Sessions', hint: 'Advanced: inspect backend sessions', run: openSessionPicker },
  ]), [handleNewSession, openSessionPicker, openModelPicker, openPermissions, openFilePicker]);

  const slashQuery = input.startsWith('/') ? input.slice(1).trim().toLowerCase() : '';
  const slashMatches = input.startsWith('/')
    ? slashActions.filter((a) => a.key.includes(slashQuery) || a.label.toLowerCase().includes(slashQuery))
    : [];

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    if (trimmed.startsWith('/')) {
      const command = slashActions.find((a) => `/${a.key}` === trimmed.toLowerCase());
      if (command) { setInput(''); await command.run(); }
      return;
    }
    const msg = input;
    const attachments = [...pendingAttachments];
    setInput('');
    setPendingAttachments([]);
    chatViewRef.current?.pinToBottom();
    await send(msg, attachments);
    setTimeout(() => chatViewRef.current?.scrollToBottom(true), 100);
  }, [input, isStreaming, pendingAttachments, send, slashActions]);

  // Compute usage ring progress
  const usagePct = currentSession && currentSession.contextWindow > 0
    ? currentSession.usage.contextUsedTokens / currentSession.contextWindow
    : 0;
  const ringColor = usagePct >= 0.9 ? theme.error : usagePct >= 0.7 ? theme.warning : theme.success;

  const composerFooter = (
    <>
      <TouchableOpacity
        ref={composerMenuAnchorRef}
        onPress={() => { setShowModelPicker(false); setShowComposerMenu((v) => !v); }}
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
        onPress={() => { setShowComposerMenu(false); openModelPicker(); }}
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
      {currentSession && currentSession.contextWindow > 0 && (
        <TouchableOpacity onPress={openSessionPicker} hitSlop={6} activeOpacity={0.7}>
          <ProgressRing
            progress={usagePct}
            size={28}
            strokeWidth={3}
            color={ringColor}
          />
        </TouchableOpacity>
      )}
    </>
  );

  // Floating header height for content offset
  const headerHeight = insets.top + 68;
  const statusOnline = isConnected === true;
  const statusLabel = isConnected === null ? '' : isConnected ? 'Online' : 'Offline';

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={20}
    >
      {/* Messages */}
      <ChatView
        ref={chatViewRef}
        messages={messages}
        agentName={name}
        isLoading={loadingHistory}
        theme={theme}
        colorScheme={colorScheme}
        attachmentCount={pendingAttachments.length}
        onScrollNearTop={loadOlder}
        contentTopPadding={headerHeight}
        avatarSlot={(size) => <AgentAvatar name={name} size={size} />}
        emptyStateContent={
          <View style={s.emptyWrap}>
            <AgentAvatar name={name} size={56} />
            <Text style={s.emptyTitle}>Chat with {name}</Text>
            <Text style={s.emptySubtitle}>Send a message to start the conversation.</Text>
          </View>
        }
      />

      {/* Floating transparent header — no background */}
      <View style={[s.floatingHeader, { paddingTop: insets.top }]} pointerEvents="box-none">
        <View style={s.headerBar} pointerEvents="box-none">
          {/* Left: sessions/menu glass button */}
          <View pointerEvents="auto">
            <LiquidGlassButton
              icon="☰"
              isDark={isDark}
              onPress={openSessionPicker}
              size={38}
            />
          </View>

          {/* Center: agent name + status */}
          <View style={s.headerCenter} pointerEvents="none">
            <Text style={s.agentTitle} numberOfLines={1}>{name}</Text>
            {statusLabel ? (
              <View style={s.statusRow}>
                <View style={[s.statusDot, { backgroundColor: statusOnline ? theme.success : theme.error }]} />
                <Text style={[s.statusText, { color: statusOnline ? theme.success : theme.error }]}>
                  {statusLabel}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Right: close glass button */}
          <View pointerEvents="auto">
            <LiquidGlassButton
              icon="✕"
              isDark={isDark}
              onPress={() => router.back()}
              size={38}
              iconSize={14}
            />
          </View>
        </View>
      </View>

      {compactionToast && (
        <View style={{ marginHorizontal: Spacing.md, marginTop: Spacing.xs, padding: 10, borderRadius: 10, backgroundColor: theme.accent + '18', borderWidth: StyleSheet.hairlineWidth, borderColor: theme.accent + '55' }}>
          <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>↻ Session compacted — older messages summarized.</Text>
        </View>
      )}

      {/* Model picker popover — opens upward from composer button */}
      <CustomPopover
        visible={showModelPicker}
        anchorRef={modelAnchorRef}
        onClose={() => setShowModelPicker(false)}
        theme={theme}
        width={290}
        maxHeight={440}
        align="right"
        openUpward
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
              const meta = availableModelDetails.find((e) => e.id === model);
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

      {/* Permissions modal */}
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
                      <TouchableOpacity key={option} style={[s.permissionChip, approvalDefaults.security === option && s.permissionChipActive]} onPress={() => { void updateApprovalSetting('security', option); }} activeOpacity={0.7}>
                        <Text style={[s.permissionChipText, approvalDefaults.security === option && s.permissionChipTextActive]}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.permissionLabel}>Ask</Text>
                  <View style={s.permissionChips}>
                    {ASK_OPTIONS.map((option) => (
                      <TouchableOpacity key={option} style={[s.permissionChip, approvalDefaults.ask === option && s.permissionChipActive]} onPress={() => { void updateApprovalSetting('ask', option); }} activeOpacity={0.7}>
                        <Text style={[s.permissionChipText, approvalDefaults.ask === option && s.permissionChipTextActive]}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.permissionLabel}>Fallback</Text>
                  <View style={s.permissionChips}>
                    {SECURITY_OPTIONS.map((option) => (
                      <TouchableOpacity key={option} style={[s.permissionChip, approvalDefaults.askFallback === option && s.permissionChipActive]} onPress={() => { void updateApprovalSetting('askFallback', option); }} activeOpacity={0.7}>
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

      {/* Context warnings */}
      {(() => {
        if (!currentSession || currentSession.contextWindow <= 0) return null;
        const pct = (currentSession.usage.contextUsedTokens / currentSession.contextWindow) * 100;
        if (pct >= 95 && !warningDismissedRef.current.hard) return <ContextWarningBanner level="hard" theme={theme} />;
        if (pct >= 80 && !warningDismissedRef.current.soft) return <ContextWarningBanner level="soft" theme={theme} />;
        return null;
      })()}

      {/* Session picker sheet */}
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

      {/* Slash command menu */}
      {slashMatches.length > 0 && (
        <View style={[s.slashMenu, { bottom: insets.bottom + 78 + (pendingAttachments.length > 0 ? 40 : 0) }]}>
          {slashMatches.map((action) => (
            <TouchableOpacity key={action.key} style={s.slashRow} onPress={() => { setInput(''); void action.run(); }} activeOpacity={0.75}>
              <View style={{ flex: 1 }}>
                <Text style={s.slashTitle}>/{action.key}</Text>
                <Text style={s.slashHint}>{action.hint}</Text>
              </View>
              <Text style={s.slashLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Composer menu popover — opens upward from + button */}
      <CustomPopover
        visible={showComposerMenu}
        anchorRef={composerMenuAnchorRef}
        onClose={() => setShowComposerMenu(false)}
        theme={theme}
        width={258}
        maxHeight={340}
        align="left"
        openUpward
      >
        <PopoverSection theme={theme}>
          <PopoverOption theme={theme} label="Add photos & files" icon="📎" subtitle="Attach workspace context" onPress={() => { void openFilePicker(); }} />
          <PopoverOption theme={theme} label="Plan mode" icon="🪄" subtitle="Structured prompts and shortcuts" value="Soon" onPress={() => setShowComposerMenu(false)} />
          <PopoverOption theme={theme} label="Sessions" icon="☰" subtitle="Advanced · inspect backend sessions" onPress={() => { void openSessionPicker(); }} />
          <PopoverOption theme={theme} label="Permissions" icon="⚙" subtitle="Adjust approvals and allowlist" onPress={() => { void openPermissions(); }} />
        </PopoverSection>
      </CustomPopover>

      {/* Workspace file picker modal */}
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

      {/* Input composer */}
      <ChatComposer
        value={input}
        onChangeText={setInput}
        onSend={handleSend}
        isStreaming={isStreaming}
        onAbort={abort}
        placeholder={`Message ${name} or type / for shortcuts...`}
        theme={theme}
        insets={insets}
        attachments={pendingAttachments}
        onRemoveAttachment={removeAttachment}
        footerContent={composerFooter}
      />
    </KeyboardAvoidingView>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },

  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
  },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm + 4,
    minHeight: 56,
  },
  headerCenter: {
    flex: 1, alignItems: 'center', gap: 3,
  },
  agentTitle: { color: t.text.primary, fontSize: 17, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: t.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, maxHeight: '65%' },
  modalTitle: { color: t.text.primary, fontSize: 18, fontWeight: '700', marginBottom: Spacing.md },
  modelList: { maxHeight: 380 },
  modalClose: { marginTop: Spacing.md, paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: t.border },
  modalCloseText: { color: t.text.secondary, fontSize: 15, fontWeight: '600' },

  permissionCard: { backgroundColor: t.background, borderRadius: 14, padding: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, gap: 10, marginBottom: Spacing.md },
  permissionTitle: { color: t.text.primary, fontSize: 14, fontWeight: '700' },
  permissionHint: { color: t.text.secondary, fontSize: 12, lineHeight: 17 },
  permissionLabel: { color: t.text.secondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  permissionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  permissionChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, backgroundColor: t.surface },
  permissionChipActive: { backgroundColor: t.accent + '1f', borderColor: t.accent + '66' },
  permissionChipText: { color: t.text.secondary, fontSize: 12, fontWeight: '600' },
  permissionChipTextActive: { color: t.accent },
  allowlistComposer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  allowlistInput: { flex: 1, backgroundColor: t.surface, color: t.text.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  allowlistAddBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: t.accent },
  allowlistAddText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  allowlistRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  allowlistPattern: { color: t.text.primary, fontSize: 13, fontWeight: '600' },
  allowlistMeta: { color: t.text.secondary, fontSize: 11 },

  fileOption: { paddingVertical: 12, paddingHorizontal: Spacing.md, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  fileOptionName: { color: t.text.primary, fontSize: 14, fontWeight: '600' },
  fileOptionPreview: { color: t.text.secondary, fontSize: 12, marginTop: 1 },

  emptyWrap: { alignItems: 'center', gap: Spacing.sm, paddingTop: 80, paddingHorizontal: Spacing.xl },
  emptyTitle: { color: t.text.primary, fontSize: 18, fontWeight: '600', marginTop: Spacing.sm },
  emptySubtitle: { color: t.text.secondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  slashMenu: { position: 'absolute', left: Spacing.md, right: Spacing.md, backgroundColor: t.surface, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, overflow: 'hidden', zIndex: 20 },
  slashRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.md, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  slashTitle: { color: t.text.primary, fontSize: 13, fontWeight: '700' },
  slashHint: { color: t.text.secondary, fontSize: 11, marginTop: 2 },
  slashLabel: { color: t.accent, fontSize: 12, fontWeight: '600' },

  footerPill: { minHeight: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: t.background, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerWidePill: { flex: 1 },
  footerModelPill: { maxWidth: '42%' },
  footerPillIcon: { color: t.text.secondary, fontSize: 14, fontWeight: '700' },
  footerPillText: { color: t.text.secondary, fontSize: 13, fontWeight: '500', flexShrink: 1 },
  footerPillChevron: { color: t.text.secondary, fontSize: 10 },
});
