import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { searchApi, type SearchHit } from '../../../../services/openai.api';

const SCOPE_LABELS: Record<SearchHit['scope'], string> = {
  sessions: '💬',
  skills: '🛠',
  memory: '🧠',
};

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { padding: Spacing.xl, paddingBottom: Spacing.md, gap: Spacing.sm },
    heading: { ...TextStyles.h1, color: theme.text.primary },
    sub: { ...TextStyles.small, color: theme.text.secondary },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
    input: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      ...TextStyles.body,
      color: theme.text.primary,
    },
    btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: BorderRadius.md, backgroundColor: Colors.accent },
    btnSecondary: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
    btnLabel: { ...TextStyles.bodyMedium, color: Colors.white, fontWeight: '600' },
    btnLabelSecondary: { color: theme.text.primary },
    statsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.xl, marginBottom: Spacing.sm },
    statChip: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: BorderRadius.md, paddingHorizontal: 8, paddingVertical: 4 },
    statLabel: { ...TextStyles.caption, color: theme.text.secondary },
    list: { paddingHorizontal: Spacing.xl, paddingBottom: 60 },
    hit: { backgroundColor: theme.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: theme.border, padding: Spacing.md, marginBottom: Spacing.sm, gap: 4 },
    hitHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    hitSource: { ...TextStyles.bodyMedium, color: theme.text.primary, flex: 1 },
    hitScore: { ...TextStyles.caption, color: Colors.accent, fontFamily: 'Menlo' },
    hitSnippet: { ...TextStyles.small, color: theme.text.secondary, lineHeight: 18 },
    empty: { padding: Spacing.xl, alignItems: 'center' },
    emptyText: { ...TextStyles.body, color: theme.text.secondary, textAlign: 'center' },
  });
}

export default function SearchScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [stats, setStats] = useState<{ total: number; byScope: Record<string, number> } | null>(null);

  const loadStats = useCallback(async () => {
    try { setStats(await searchApi.stats()); } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);

  const runSearch = useCallback(async () => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const results = await searchApi.query(q.trim());
      setHits(results);
    } catch (err: any) {
      Alert.alert('Search failed', err?.message ?? 'Could not run search.');
    } finally {
      setSearching(false);
    }
  }, [q]);

  const reindex = useCallback(async () => {
    setReindexing(true);
    try {
      const stats = await searchApi.reindex();
      Alert.alert('Reindex done', `+${stats.added} new, ~${stats.updated} updated, -${stats.removed} removed. Total ${stats.total}.`);
      await loadStats();
    } catch (err: any) {
      Alert.alert('Reindex failed', err?.message ?? 'Could not reindex.');
    } finally {
      setReindexing(false);
    }
  }, [loadStats]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>🔎 Search</Text>
        <Text style={styles.sub}>Semantic search over sessions, skills, and memory.</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={q}
            onChangeText={setQ}
            placeholder="What are you looking for?"
            placeholderTextColor={theme.text.secondary}
            onSubmitEditing={runSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.btn} onPress={runSearch} disabled={!q.trim() || searching}>
            {searching ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnLabel}>Search</Text>}
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statChip}><Text style={styles.statLabel}>Indexed: {stats?.total ?? '—'}</Text></View>
        {stats ? Object.entries(stats.byScope).map(([scope, n]) => (
          <View key={scope} style={styles.statChip}><Text style={styles.statLabel}>{SCOPE_LABELS[scope as SearchHit['scope']] ?? '?'} {n}</Text></View>
        )) : null}
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={reindex} disabled={reindexing}>
          {reindexing ? <ActivityIndicator color={Colors.accent} /> : <Text style={[styles.btnLabel, styles.btnLabelSecondary]}>↻ Reindex</Text>}
        </TouchableOpacity>
      </View>
      <FlatList
        data={hits}
        keyExtractor={(h) => h.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.hit}>
            <View style={styles.hitHeader}>
              <Text style={styles.hitSource} numberOfLines={1}>{SCOPE_LABELS[item.scope] ?? '?'} {item.source}</Text>
              <Text style={styles.hitScore}>{(item.score * 100).toFixed(0)}%</Text>
            </View>
            <Text style={styles.hitSnippet} numberOfLines={3}>{item.snippet}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{q ? 'No matches yet — try Reindex if this is your first search.' : 'Type a query above. Cosine-similarity over text-embedding-3-small.'}</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadStats} tintColor={Colors.accent} />}
      />
    </SafeAreaView>
  );
}
