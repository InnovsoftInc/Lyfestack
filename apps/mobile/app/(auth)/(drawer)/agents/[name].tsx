import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useOpenClawStore } from '../../../../stores/openclaw.store';

export default function AgentChatScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <Text style={styles.agentTitle}>{name}</Text>
        {agent && <Text style={styles.agentMeta}>{agent.role} · {agent.model}</Text>}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
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
              item.isError && styles.errorText,
            ]}>
              {item.content}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyChat}>Send a message to start</Text>}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {sending && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color="#555" />
          <Text style={styles.typingText}>{name} is thinking...</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Message agent..."
          placeholderTextColor="#555"
          multiline
          editable={!sending}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#000" />
            : <Text style={styles.sendText}>Send</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 16, backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#222' },
  agentTitle: { color: '#EDEDED', fontSize: 20, fontWeight: '700' },
  agentMeta: { color: '#666', fontSize: 12, marginTop: 2 },
  messages: { padding: 16, paddingBottom: 8 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 12, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#0EA5E9' },
  agentBubble: { alignSelf: 'flex-start', backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#222' },
  errorBubble: { alignSelf: 'flex-start', backgroundColor: '#1a0000', borderWidth: 1, borderColor: '#3a0000' },
  bubbleText: { color: '#EDEDED', fontSize: 14, lineHeight: 20 },
  userText: { color: '#000' },
  errorLabel: { color: '#EF4444', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  errorText: { color: '#EF4444' },
  emptyChat: { color: '#444', textAlign: 'center', paddingTop: 80, fontSize: 15 },
  typingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  typingText: { color: '#555', fontSize: 13 },
  inputRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#0a0a0a', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#EDEDED', fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: '#222' },
  sendBtn: { marginLeft: 8, backgroundColor: '#0EA5E9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, minWidth: 60, alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#333' },
  sendText: { color: '#000', fontWeight: '700', fontSize: 14 },
});
