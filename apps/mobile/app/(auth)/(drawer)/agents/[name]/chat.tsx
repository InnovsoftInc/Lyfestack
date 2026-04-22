import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOpenClawStore } from '../../../../../stores/openclaw.store';
import { useTheme } from '../../../../../hooks/useTheme';
import { Spacing } from '../../../../../theme';
import type { Theme } from '../../../../../theme';
import { AgentAvatar } from '../index';

export default function AgentChatScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const theme = useTheme();
  const s = styles(theme);
  const { activeChat, openChat, sendMessage, agents } = useOpenClawStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const insets = useSafeAreaInsets();
  const agent = agents.find((a) => a.name === name);

  useEffect(() => { openChat(name); }, [name]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const msg = input;
    setInput('');
    await sendMessage(name, msg);
    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const messages = activeChat?.messages ?? [];

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={20}
    >
      {/* Modal drag handle */}
      <View style={s.handleWrap}>
        <View style={s.handle} />
      </View>

      {/* Header */}
      <View style={s.header}>
        <AgentAvatar name={name} size={40} />
        <View style={s.headerInfo}>
          <Text style={s.agentTitle}>{name}</Text>
          {agent && <Text style={s.agentMeta}>{agent.role}</Text>}
        </View>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn} hitSlop={10} activeOpacity={0.6}>
          <Text style={s.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.messages}
        renderItem={({ item }) => (
          <View style={[
            s.bubble,
            item.role === 'user' ? s.userBubble :
            item.isError ? s.errorBubble : s.agentBubble,
          ]}>
            {item.isError && <Text style={s.errorLabel}>Error</Text>}
            <Text style={[
              s.bubbleText,
              item.role === 'user' && s.userText,
              item.isError && s.errorText,
            ]}>
              {item.content}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <AgentAvatar name={name} size={56} />
            <Text style={s.emptyTitle}>Chat with {name}</Text>
            <Text style={s.emptySubtitle}>Send a message to start the conversation.</Text>
          </View>
        }
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Typing indicator */}
      {sending && (
        <View style={s.typingRow}>
          <AgentAvatar name={name} size={22} />
          <View style={s.typingBubble}>
            <ActivityIndicator size="small" color={theme.text.secondary} />
            <Text style={s.typingText}>thinking...</Text>
          </View>
        </View>
      )}

      {/* Input bar */}
      <View style={[s.inputBar, { paddingBottom: insets.bottom + Spacing.sm + 2 }]}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder={`Message ${name}...`}
          placeholderTextColor={theme.text.secondary}
          multiline
          editable={!sending}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnOff]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
          activeOpacity={0.8}
        >
          <Text style={s.sendIcon}>↑</Text>
        </TouchableOpacity>
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
  agentMeta: { color: t.text.secondary, fontSize: 11, marginTop: 1 },
  closeBtn: { padding: Spacing.xs },
  closeIcon: { color: t.text.secondary, fontSize: 16 },

  messages: { padding: Spacing.md, paddingBottom: Spacing.sm, flexGrow: 1 },

  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20,
    marginBottom: Spacing.sm,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: t.accent,
    borderBottomRightRadius: 6,
  },
  agentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: t.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
    borderBottomLeftRadius: 6,
  },
  errorBubble: {
    alignSelf: 'flex-start',
    backgroundColor: t.error + '18',
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.error + '55',
    borderBottomLeftRadius: 6,
  },
  bubbleText: { color: t.text.primary, fontSize: 15, lineHeight: 21 },
  userText: { color: '#fff' },
  errorLabel: { color: t.error, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  errorText: { color: t.error },

  emptyWrap: { alignItems: 'center', gap: Spacing.sm, paddingTop: 80, paddingHorizontal: Spacing.xl },
  emptyTitle: { color: t.text.primary, fontSize: 18, fontWeight: '600', marginTop: Spacing.sm },
  emptySubtitle: { color: t.text.secondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: t.surface, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  typingText: { color: t.text.secondary, fontSize: 13 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border,
    backgroundColor: t.surface,
  },
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
});
