import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { useBriefStore } from '../../../../stores/brief.store';
import { useOpenClawStore } from '../../../../stores/openclaw.store';
import { AgentAvatar } from '../agents/index';
import type { BriefTask } from '../../../../services/briefs.api';

const TASK_TYPE_ICON: Record<string, string> = {
  HABIT: '🔁',
  TASK: '✅',
  REFLECTION: '💭',
  MILESTONE: '🏆',
  RESEARCH: '🔍',
  CONTENT: '✍️',
};

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.lg,
    },
    loadingText: {
      ...TextStyles.body,
      color: theme.text.secondary,
      lineHeight: 26,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    list: {
      paddingBottom: Spacing['2xl'],
    },
    header: {
      padding: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    greeting: {
      ...TextStyles.h2,
      color: theme.text.primary,
      marginBottom: Spacing.xs,
    },
    summary: {
      ...TextStyles.body,
      color: theme.text.secondary,
      marginBottom: Spacing.md,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    progressBar: {
      flex: 1,
      height: 6,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: Colors.accent,
      borderRadius: BorderRadius.full,
    },
    progressLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      minWidth: 60,
      textAlign: 'right',
    },
    insightsBox: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      gap: Spacing.xs,
    },
    insightText: {
      ...TextStyles.small,
      color: theme.text.secondary,
      lineHeight: 20,
    },
    sectionLabel: {
      ...TextStyles.bodyMedium,
      color: theme.text.secondary,
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    taskCard: {
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    taskCardDone: {
      opacity: 0.5,
    },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    taskIcon: {
      fontSize: 20,
      marginTop: 2,
      width: 28,
    },
    taskBody: {
      flex: 1,
    },
    taskTitle: {
      ...TextStyles.bodyMedium,
      color: theme.text.primary,
      marginBottom: 2,
    },
    taskTitleDone: {
      textDecorationLine: 'line-through',
      color: theme.text.secondary,
    },
    taskDesc: {
      ...TextStyles.small,
      color: theme.text.secondary,
      marginBottom: Spacing.xs,
    },
    taskMeta: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    metaChip: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      backgroundColor: theme.background,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    doneButton: {
      backgroundColor: Colors.accent,
      paddingVertical: 6,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.sm,
      alignSelf: 'flex-start',
    },
    doneButtonText: {
      ...TextStyles.caption,
      color: Colors.white,
      fontWeight: '600',
    },
    completedBadge: {
      width: 28,
      height: 28,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.success,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'flex-start',
    },
    completedText: {
      color: Colors.white,
      fontWeight: '700',
      fontSize: 14,
    },
    emptyTasks: {
      alignItems: 'center',
      padding: Spacing.xl,
      gap: Spacing.sm,
    },
    emptyEmoji: {
      fontSize: 40,
    },
    emptyTitle: {
      ...TextStyles.h3,
      color: theme.text.primary,
    },
    emptySubtitle: {
      ...TextStyles.body,
      color: theme.text.secondary,
    },
    retryButton: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    retryText: {
      ...TextStyles.button,
      color: theme.text.secondary,
    },
    errorText: {
      ...TextStyles.body,
      color: theme.error,
      textAlign: 'center',
    },
    chatIcon: {
      fontSize: 22,
      marginRight: Spacing.md,
    },
    // Chat modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    chatSheet: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'hidden',
      height: '85%',
    },
    handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border },
    chatHeader: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
    },
    chatHeaderInfo: { flex: 1 },
    chatAgentTitle: { color: theme.text.primary, fontSize: 16, fontWeight: '700' },
    chatAgentMeta: { color: theme.text.secondary, fontSize: 11, marginTop: 1 },
    closeBtn: { padding: Spacing.xs },
    closeIcon: { color: theme.text.secondary, fontSize: 16 },
    messages: { padding: Spacing.md, paddingBottom: Spacing.sm, flexGrow: 1 },
    bubble: {
      maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10,
      borderRadius: 20, marginBottom: Spacing.sm,
    },
    userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.accent, borderBottomRightRadius: 6 },
    agentBubble: {
      alignSelf: 'flex-start', backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, borderBottomLeftRadius: 6,
    },
    errorBubble: {
      alignSelf: 'flex-start', backgroundColor: (theme.error ?? '#EF4444') + '18',
      borderWidth: StyleSheet.hairlineWidth, borderColor: (theme.error ?? '#EF4444') + '55', borderBottomLeftRadius: 6,
    },
    bubbleText: { color: theme.text.primary, fontSize: 15, lineHeight: 21 },
    userText: { color: '#fff' },
    errorLabel: { color: theme.error ?? '#EF4444', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
    chatErrorText: { color: theme.error ?? '#EF4444' },
    chatEmptyWrap: { alignItems: 'center', gap: Spacing.sm, paddingTop: 60, paddingHorizontal: Spacing.xl },
    chatEmptyTitle: { color: theme.text.primary, fontSize: 18, fontWeight: '600', marginTop: Spacing.sm },
    chatEmptySubtitle: { color: theme.text.secondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    typingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
    typingBubble: {
      flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.surface,
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderBottomLeftRadius: 6,
      borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border,
    },
    typingText: { color: theme.text.secondary, fontSize: 13 },
    inputBar: {
      flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border,
      backgroundColor: theme.surface,
    },
    chatInput: {
      flex: 1, backgroundColor: theme.background, borderRadius: 22,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
      color: theme.text.primary, fontSize: 15, maxHeight: 110,
      borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border,
    },
    sendBtn: {
      width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.accent,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: Colors.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6,
      elevation: 4,
    },
    sendBtnOff: { backgroundColor: theme.surface, shadowOpacity: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
    sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: -1 },
    noAgentWrap: { alignItems: 'center', gap: Spacing.sm, paddingTop: 80, paddingHorizontal: Spacing.xl },
    noAgentText: { color: theme.text.secondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  });
}

function TaskCard({
  task,
  onComplete,
}: {
  task: BriefTask;
  onComplete: (id: string) => void;
}) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const isComplete = task.status === 'COMPLETED' || task.completedAt != null;

  return (
    <View style={[styles.taskCard, isComplete && styles.taskCardDone]}>
      <View style={styles.taskRow}>
        <Text style={styles.taskIcon}>{TASK_TYPE_ICON[task.type] ?? '•'}</Text>
        <View style={styles.taskBody}>
          <Text style={[styles.taskTitle, isComplete && styles.taskTitleDone]} numberOfLines={2}>
            {task.title}
          </Text>
          {task.description ? (
            <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text>
          ) : null}
          <View style={styles.taskMeta}>
            {task.estimatedMinutes ? (
              <Text style={styles.metaChip}>⏱ {task.estimatedMinutes}m</Text>
            ) : null}
            {task.priority != null ? (
              <Text style={styles.metaChip}>↑ {task.priority}</Text>
            ) : null}
          </View>
        </View>
        {!isComplete && (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => onComplete(task.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        )}
        {isComplete && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>✓</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ChatModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const { agents, connectionStatus, activeChat, openChat, sendMessage } = useOpenClawStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const mainAgent = agents[0] ?? null;
  const agentName = mainAgent?.name ?? '';

  useEffect(() => {
    if (visible && agentName) openChat(agentName);
  }, [visible, agentName]);

  const handleSend = async () => {
    if (!input.trim() || sending || !agentName) return;
    setSending(true);
    const msg = input;
    setInput('');
    await sendMessage(agentName, msg);
    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const messages = activeChat?.agentName === agentName ? (activeChat?.messages ?? []) : [];

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={styles.chatSheet}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={20}
        >
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          <View style={styles.chatHeader}>
            {agentName ? <AgentAvatar name={agentName} size={40} /> : null}
            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatAgentTitle}>{agentName || 'OpenClaw Agent'}</Text>
              {mainAgent && <Text style={styles.chatAgentMeta}>{mainAgent.role}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10} activeOpacity={0.6}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {connectionStatus !== 'connected' || !agentName ? (
            <View style={styles.noAgentWrap}>
              <Text style={styles.noAgentText}>
                {connectionStatus === 'connecting'
                  ? 'Connecting to OpenClaw...'
                  : connectionStatus === 'disconnected'
                  ? 'Not connected to OpenClaw.\nOpen the drawer and reconnect to chat.'
                  : 'No agents available.'}
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.messages, { flexGrow: 1 }]}
                renderItem={({ item }) => (
                  <View style={[
                    styles.bubble,
                    item.role === 'user' ? styles.userBubble :
                    item.isError ? styles.errorBubble : styles.agentBubble,
                  ]}>
                    {item.isError && <Text style={styles.errorLabel}>Error</Text>}
                    <Text style={[
                      styles.bubbleText,
                      item.role === 'user' && styles.userText,
                      item.isError && styles.chatErrorText,
                    ]}>
                      {item.content}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.chatEmptyWrap}>
                    {agentName ? <AgentAvatar name={agentName} size={56} /> : null}
                    <Text style={styles.chatEmptyTitle}>Chat with {agentName}</Text>
                    <Text style={styles.chatEmptySubtitle}>Send a message to start the conversation.</Text>
                  </View>
                }
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              />

              {sending && (
                <View style={styles.typingRow}>
                  <AgentAvatar name={agentName} size={22} />
                  <View style={styles.typingBubble}>
                    <ActivityIndicator size="small" color={theme.text.secondary} />
                    <Text style={styles.typingText}>thinking...</Text>
                  </View>
                </View>
              )}

              <View style={[styles.inputBar, { paddingBottom: insets.bottom + Spacing.sm + 2 }]}>
                <TextInput
                  style={styles.chatInput}
                  value={input}
                  onChangeText={setInput}
                  placeholder={`Message ${agentName}...`}
                  placeholderTextColor={theme.text.secondary}
                  multiline
                  editable={!sending}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnOff]}
                  onPress={handleSend}
                  disabled={!input.trim() || sending}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sendIcon}>↑</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function DashboardScreen() {
  const { brief, isLoading, error, fetchTodayBrief, completeTask } = useBriefStore();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const navigation = useNavigation();
  const [chatOpen, setChatOpen] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setChatOpen(true)} hitSlop={10} activeOpacity={0.7}>
          <Text style={styles.chatIcon}>💬</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, styles]);

  useEffect(() => {
    void fetchTodayBrief();
  }, [fetchTodayBrief]);

  const handleRefresh = useCallback(() => {
    void fetchTodayBrief();
  }, [fetchTodayBrief]);

  const handleComplete = useCallback(
    (taskId: string) => {
      if (!brief) return;
      void completeTask(brief.id, taskId);
    },
    [brief, completeTask],
  );

  if (isLoading && !brief) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading your brief...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !brief) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const completedCount = brief?.tasks.filter(
    (t) => t.status === 'COMPLETED' || t.completedAt != null,
  ).length ?? 0;
  const totalCount = brief?.tasks.length ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <ChatModal visible={chatOpen} onClose={() => setChatOpen(false)} />
      <FlatList
        data={brief?.tasks ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.greeting}>{brief?.greeting ?? 'Good morning'}</Text>
            <Text style={styles.summary}>{brief?.summary ?? 'Pull down to load your brief.'}</Text>

            {totalCount > 0 && (
              <View style={styles.progressRow}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressLabel}>
                  {completedCount}/{totalCount} done
                </Text>
              </View>
            )}

            {brief?.insights && brief.insights.length > 0 && (
              <View style={styles.insightsBox}>
                {brief.insights.map((insight, i) => (
                  <Text key={i} style={styles.insightText}>
                    💡 {insight}
                  </Text>
                ))}
              </View>
            )}

            {totalCount > 0 && (
              <Text style={styles.sectionLabel}>Today's Tasks</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TaskCard task={item} onComplete={handleComplete} />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyTasks}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyTitle}>All clear!</Text>
              <Text style={styles.emptySubtitle}>No tasks scheduled today.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
