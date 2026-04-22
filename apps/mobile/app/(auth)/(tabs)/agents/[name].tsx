import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { DarkTheme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { useOpenClawStore } from '../../../../stores/openclaw.store';
import type { OpenClawMessage } from '@lyfestack/shared';

function MessageBubble({ msg }: { msg: OpenClawMessage }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAgent]}>
      {!isUser && <View style={styles.agentAvatar}><Text style={styles.agentAvatarText}>🤖</Text></View>}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAgent]}>
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAgent]}>
          {msg.content}
        </Text>
        <Text style={styles.bubbleTime}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

export default function AgentChatScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const navigation = useNavigation();
  const { agents, activeChat, isSending, openChat, closeChat, streamMessage } = useOpenClawStore();
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const agent = agents.find((a) => a.id === name);

  useEffect(() => {
    if (name) {
      openChat(name);
      navigation.setOptions({ title: agent?.name ?? name });
    }
    return () => closeChat();
  }, [name]);

  useEffect(() => {
    if (activeChat?.messages.length) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [activeChat?.messages.length]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !name || isSending) return;
    setInput('');
    streamMessage(name, text);
  };

  const messages = activeChat?.agentId === name ? activeChat.messages : [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Agent info bar */}
      {agent && (
        <View style={styles.agentBar}>
          <View style={styles.agentBarInfo}>
            <Text style={styles.agentBarName}>{agent.name}</Text>
            <Text style={styles.agentBarModel}>{agent.model.split('/').pop()}</Text>
          </View>
          <View style={[styles.statusPill, agent.status === 'active' ? styles.statusActive : styles.statusIdle]}>
            <Text style={styles.statusText}>{agent.status}</Text>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble msg={item} />}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>Send a message to start chatting</Text>
            </View>
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={`Message ${agent?.name ?? name}…`}
            placeholderTextColor={DarkTheme.text.secondary}
            multiline
            maxLength={4000}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || isSending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.sendBtnText}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DarkTheme.background },
  flex: { flex: 1 },
  agentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: DarkTheme.border,
    backgroundColor: DarkTheme.surface,
  },
  agentBarInfo: { gap: 2 },
  agentBarName: { ...TextStyles.bodyMedium, color: DarkTheme.text.primary, fontWeight: '600' },
  agentBarModel: { ...TextStyles.caption, color: Colors.accent },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: { backgroundColor: 'rgba(34,197,94,0.15)' },
  statusIdle: { backgroundColor: DarkTheme.border },
  statusText: { ...TextStyles.caption, color: DarkTheme.text.secondary, textTransform: 'capitalize' },
  messageList: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.lg },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAgent: { justifyContent: 'flex-start' },
  agentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DarkTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  agentAvatarText: { fontSize: 14 },
  bubble: {
    maxWidth: '78%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 4,
  },
  bubbleUser: { backgroundColor: Colors.accent, borderBottomRightRadius: 4 },
  bubbleAgent: { backgroundColor: DarkTheme.surface, borderWidth: 1, borderColor: DarkTheme.border, borderBottomLeftRadius: 4 },
  bubbleText: { ...TextStyles.body, lineHeight: 22 },
  bubbleTextUser: { color: Colors.white },
  bubbleTextAgent: { color: DarkTheme.text.primary },
  bubbleTime: { ...TextStyles.caption, opacity: 0.6, color: 'inherit' },
  emptyChat: { flex: 1, alignItems: 'center', paddingVertical: Spacing.xl * 3 },
  emptyChatText: { ...TextStyles.small, color: DarkTheme.text.secondary },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: DarkTheme.border,
    backgroundColor: DarkTheme.background,
  },
  input: {
    flex: 1,
    ...TextStyles.body,
    color: DarkTheme.text.primary,
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 20, color: Colors.white, lineHeight: 24 },
});
