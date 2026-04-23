import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { openaiApi, type AutomationDraft } from '../../../../services/openai.api';
import { openclawApi } from '../../../../services/openclaw.api';
import { useAutomationsStore } from '../../../../stores/automations.store';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.xl, gap: Spacing.md },
    backArrow: { ...TextStyles.h2, color: theme.text.primary, lineHeight: 28 },
    title: { ...TextStyles.h2, color: theme.text.primary, flex: 1 },
    body: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: 60 },
    label: { ...TextStyles.caption, color: theme.text.secondary, textTransform: 'uppercase', letterSpacing: 1 },
    input: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      ...TextStyles.body,
      color: theme.text.primary,
      minHeight: 120,
      textAlignVertical: 'top',
    },
    inputSm: { minHeight: 0 },
    btn: { backgroundColor: Colors.accent, padding: 14, borderRadius: BorderRadius.md, alignItems: 'center' },
    btnLabel: { ...TextStyles.bodyMedium, color: Colors.white, fontWeight: '600' },
    btnGhost: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
    btnGhostLabel: { color: theme.text.primary, fontWeight: '600' },
    note: { ...TextStyles.caption, color: theme.text.secondary, marginTop: Spacing.sm },
    draftCard: { backgroundColor: theme.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: theme.border, padding: Spacing.md, gap: Spacing.sm },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
    rowLabel: { ...TextStyles.caption, color: theme.text.secondary, flex: 1 },
    rowValue: { ...TextStyles.body, color: theme.text.primary, flex: 2, textAlign: 'right' },
    rationale: { ...TextStyles.small, color: theme.text.secondary, marginTop: 4, fontStyle: 'italic' },
  });
}

export default function VoiceDraftScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [transcript, setTranscript] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<AutomationDraft | null>(null);
  const [agents, setAgents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const { create } = useAutomationsStore();

  useEffect(() => {
    void (async () => {
      try {
        const res: any = await openclawApi.listAgents();
        const list = (res?.data ?? []).map((a: { name?: string }) => a?.name).filter(Boolean) as string[];
        setAgents(list);
      } catch { /* ignore */ }
    })();
  }, []);

  async function handleDraft() {
    if (!transcript.trim()) return;
    setDrafting(true);
    setDraft(null);
    try {
      const result = await openaiApi.draftAutomation({
        transcript: transcript.trim(),
        availableAgents: agents,
      });
      setDraft(result);
    } catch (err: any) {
      Alert.alert('Draft failed', err?.message ?? 'Could not draft automation.');
    } finally {
      setDrafting(false);
    }
  }

  async function handleCreate() {
    if (!draft) return;
    setCreating(true);
    try {
      await create({
        name: draft.name,
        description: draft.rationale,
        type: 'cron',
        schedule: draft.schedule,
        agentName: draft.agent,
        prompt: draft.prompt,
        enabled: draft.enabled,
        ...(draft.notifyChannel ? { channel: draft.notifyChannel } : {}),
      } as any);
      Alert.alert('Created', `Automation "${draft.name}" was created.`, [
        { text: 'OK', onPress: () => router.replace('/(auth)/(drawer)/automations' as any) },
      ]);
    } catch (err: any) {
      Alert.alert('Create failed', err?.message ?? 'Could not create automation.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>🎙 Voice draft</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>What should the automation do?</Text>
        <TextInput
          style={styles.input}
          multiline
          placeholder='e.g. "Every weekday at 9am have the leadgen agent scrape new leads from Reddit and email me a summary"'
          placeholderTextColor={theme.text.secondary}
          value={transcript}
          onChangeText={setTranscript}
        />
        <Text style={styles.note}>Mic capture is in progress — paste a transcript here for now and the draft endpoint will turn it into a structured automation.</Text>
        <TouchableOpacity style={[styles.btn, drafting && { opacity: 0.6 }]} onPress={handleDraft} disabled={drafting || !transcript.trim()} activeOpacity={0.8}>
          {drafting ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnLabel}>Draft automation</Text>}
        </TouchableOpacity>

        {draft ? (
          <View style={styles.draftCard}>
            <Text style={styles.label}>Draft</Text>
            <View style={styles.row}><Text style={styles.rowLabel}>Name</Text><Text style={styles.rowValue}>{draft.name}</Text></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Agent</Text><Text style={styles.rowValue}>{draft.agent}</Text></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Schedule</Text><Text style={styles.rowValue}>{draft.schedule}</Text></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Enabled</Text><Text style={styles.rowValue}>{draft.enabled ? 'yes' : 'no'}</Text></View>
            {draft.notifyChannel ? <View style={styles.row}><Text style={styles.rowLabel}>Notify</Text><Text style={styles.rowValue}>{draft.notifyChannel}</Text></View> : null}
            <Text style={styles.label}>Prompt</Text>
            <Text style={[styles.rowValue, { textAlign: 'left' }]}>{draft.prompt}</Text>
            {draft.rationale ? <Text style={styles.rationale}>{draft.rationale}</Text> : null}
            <TouchableOpacity style={[styles.btn, creating && { opacity: 0.6 }]} onPress={handleCreate} disabled={creating} activeOpacity={0.8}>
              {creating ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnLabel}>Create automation</Text>}
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
