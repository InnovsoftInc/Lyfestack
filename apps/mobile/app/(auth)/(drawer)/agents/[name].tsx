import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useOpenClawStore } from '../../../../stores/openclaw.store';
import { useTheme } from '../../../../hooks/useTheme';
import { Spacing, BorderRadius } from '../../../../theme';
import type { Theme } from '../../../../theme';
import { AgentAvatar } from './index';

export default function AgentChatScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const theme = useTheme();
  const s = styles(theme);
  const { activeChat, openChat, sendMessage, agents } = useOpenClawStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

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
      keyboardVerticalOffset={90}
    >
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <AgentAvatar name={name} size={40} />
        <View style={s.headerInfo}>
          <Text style={s.agentTitle}>{name}</Text>
          {agent && <Text style={s.agentMeta}>{agent.role}</Text>}
        </View>
      </View>

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
        ListEmptyComponent={<Text style={s.emptyChat}>Send a message to start</Text>}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {sending && (
        <View style={s.typingRow}>
          <AgentAvatar name={name} size={24} />
          <ActivityIndicator size="small" color={theme.text.secondary} />
          <Text style={s.typingText}>{name} is thinking...</Text>
        </View>
      )}

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Message agent..."
          placeholderTextColor={theme.text.secondary}
          multiline
          editable={!sending}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color={theme.text.inverse} />
            : <Text style={[s.sendText, (!input.trim() || sending) && s.sendTextDisabled]}>Send</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    backgroundColor: t.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border,
  },
  backBtn: { paddingRight: Spacing.xs },
  backIcon: { color: t.text.primary, fontSize: 32, lineHeight: 36, fontWeight: '300' },
  headerInfo: { flex: 1 },
  agentTitle: { color: t.text.primary, fontSize: 17, fontWeight: '700' },
  agentMeta: { color: t.text.secondary, fontSize: 12, marginTop: 1 },

  messages: { padding: Spacing.md, paddingBottom: Spacing.sm },

  bubble: { maxWidth: '80%', padding: Spacing.sm + 4, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  userBubble: { alignSelf: 'flex-end', backgroundColor: t.accent },
  agentBubble: {
    alignSelf: 'flex-start', backgroundColor: t.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  errorBubble: {
    alignSelf: 'flex-start', backgroundColor: t.error + '18',
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.error + '55',
  },
  bubbleText: { color: t.text.primary, fontSize: 14, lineHeight: 20 },
  userText: { color: t.text.inverse },
  errorLabel: { color: t.error, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  errorText: { color: t.error },

  emptyChat: { color: t.text.secondary, textAlign: 'center', paddingTop: 80, fontSize: 15 },

  typingRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  typingText: { color: t.text.secondary, fontSize: 13 },

  inputRow: {
    flexDirection: 'row', padding: Spacing.sm + 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border,
    backgroundColor: t.surface, alignItems: 'flex-end',
  },
  input: {
    flex: 1, backgroundColor: t.background,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md - 2,
    paddingVertical: Spacing.sm + 2, color: t.text.primary, fontSize: 15,
    maxHeight: 100, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border,
  },
  sendBtn: {
    marginLeft: Spacing.sm, backgroundColor: t.accent,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md, minWidth: 60, alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: t.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  sendText: { color: t.text.inverse, fontWeight: '700', fontSize: 14 },
  sendTextDisabled: { color: t.text.secondary },
});
