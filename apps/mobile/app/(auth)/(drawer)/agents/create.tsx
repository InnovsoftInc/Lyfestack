import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useOpenClawStore } from '../../../../stores/openclaw.store';

const ROLES = ['Developer', 'Marketing', 'Research', 'PM', 'Writer', 'Analyst', 'Custom'];
const MODELS = ['openrouter/auto', 'anthropic/claude-sonnet-4', 'openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-haiku-4'];

export default function CreateAgentScreen() {
  const router = useRouter();
  const { createAgent } = useOpenClawStore();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [model, setModel] = useState('openrouter/auto');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim() || !role) return;
    setCreating(true);
    setError('');
    try {
      await createAgent({
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        role,
        model,
        systemPrompt,
      });
      router.back();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create agent. Make sure the server is running.');
      setCreating(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create Agent</Text>
      <Text style={styles.subtitle}>Add a new AI employee to your team</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. content-writer"
        placeholderTextColor="#555"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Role</Text>
      <View style={styles.chips}>
        {ROLES.map((r) => (
          <TouchableOpacity key={r} style={[styles.chip, role === r && styles.chipActive]} onPress={() => setRole(r)}>
            <Text style={[styles.chipText, role === r && styles.chipTextActive]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Model</Text>
      <View style={styles.chips}>
        {MODELS.map((m) => (
          <TouchableOpacity key={m} style={[styles.chip, model === m && styles.chipActive]} onPress={() => setModel(m)}>
            <Text style={[styles.chipText, model === m && styles.chipTextActive]}>{m.split('/')[1]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>System Prompt</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={systemPrompt}
        onChangeText={setSystemPrompt}
        placeholder="Instructions for this agent..."
        placeholderTextColor="#555"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.createBtn, (!name.trim() || !role || creating) && styles.createBtnDisabled]}
        onPress={handleCreate}
        disabled={!name.trim() || !role || creating}
      >
        {creating
          ? <ActivityIndicator size="small" color="#000" />
          : <Text style={styles.createBtnText}>Create Agent</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 16, paddingBottom: 40 },
  title: { color: '#EDEDED', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#666', fontSize: 14, marginBottom: 24 },
  label: { color: '#888', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#111', borderRadius: 10, padding: 14, color: '#EDEDED', fontSize: 15, borderWidth: 1, borderColor: '#222' },
  textarea: { minHeight: 100 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#222' },
  chipActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  chipText: { color: '#888', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#000' },
  errorText: { color: '#EF4444', fontSize: 13, marginTop: 16 },
  createBtn: { marginTop: 32, backgroundColor: '#0EA5E9', padding: 16, borderRadius: 12, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  createBtnDisabled: { backgroundColor: '#333' },
  createBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
});
