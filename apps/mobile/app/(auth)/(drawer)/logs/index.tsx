import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { logsApi, type LogFileInfo } from '../../../../services/openclaw-extras.api';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { padding: Spacing.xl, paddingBottom: Spacing.md },
    heading: { ...TextStyles.h1, color: theme.text.primary },
    sub: { ...TextStyles.small, color: theme.text.secondary, marginTop: 4 },
    list: { paddingHorizontal: Spacing.xl },
    row: { backgroundColor: theme.surface, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: theme.border, marginBottom: Spacing.sm },
    rowActive: { borderColor: Colors.accent },
    rowTitle: { ...TextStyles.bodyMedium, color: theme.text.primary },
    rowMeta: { ...TextStyles.caption, color: theme.text.secondary, marginTop: 4 },
    typePill: { backgroundColor: theme.background, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, alignSelf: 'flex-start', marginTop: 6, borderWidth: 1, borderColor: theme.border },
    typePillLabel: { ...TextStyles.caption, color: theme.text.secondary, fontSize: 10 },
    detail: { flex: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
    detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
    detailTitle: { ...TextStyles.h4, color: theme.text.primary },
    actionsRow: { flexDirection: 'row', gap: Spacing.sm },
    actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: theme.border },
    actionBtnActive: { backgroundColor: Colors.accent + '22', borderColor: Colors.accent },
    actionLabel: { ...TextStyles.caption, color: theme.text.primary, fontWeight: '600' },
    code: { backgroundColor: theme.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: theme.border, padding: 12 },
    codeText: { ...TextStyles.caption, color: theme.text.primary, fontFamily: 'Menlo', fontSize: 11, lineHeight: 16 },
    err: { ...TextStyles.caption, color: theme.error, marginTop: 6 },
  });
}

export default function LogsScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [logs, setLogs] = useState<LogFileInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tailLoading, setTailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tailScrollRef = useRef<ScrollView>(null);

  const loadList = useCallback(async () => {
    try {
      const list = await logsApi.list();
      setLogs(list);
      if (!selected && list[0]) setSelected(list[0].name);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to list logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selected]);

  const loadTail = useCallback(async (name: string) => {
    setTailLoading(true);
    setError(null);
    try {
      const res = await logsApi.tail(name);
      setContent(res.content);
      setTimeout(() => tailScrollRef.current?.scrollToEnd({ animated: false }), 50);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to read log');
      setContent('');
    } finally {
      setTailLoading(false);
    }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { if (selected) void loadTail(selected); }, [selected, loadTail]);

  if (loading) return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}><Text style={styles.heading}>📜 Logs</Text></View>
      <ActivityIndicator color={Colors.accent} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>📜 Logs</Text>
        <Text style={styles.sub}>Live tail from ~/.openclaw/logs/</Text>
      </View>
      <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadList(); }} tintColor={Colors.accent} />}>
        {logs.map((l) => {
          const active = selected === l.name;
          return (
            <TouchableOpacity key={l.name} style={[styles.row, active && styles.rowActive]} onPress={() => setSelected(l.name)} activeOpacity={0.7}>
              <Text style={styles.rowTitle}>{l.name}</Text>
              <Text style={styles.rowMeta}>{(l.size / 1024).toFixed(1)} KB · {new Date(l.modifiedAt).toLocaleString()}</Text>
              <View style={styles.typePill}><Text style={styles.typePillLabel}>{l.type}</Text></View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.detail}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle} numberOfLines={1}>{selected ?? 'Select a log'}</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => selected && loadTail(selected)} activeOpacity={0.7}>
              <Text style={styles.actionLabel}>↻ Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>
        {tailLoading ? <ActivityIndicator color={Colors.accent} /> : null}
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <ScrollView ref={tailScrollRef} style={[styles.code, { flex: 1 }]} horizontal>
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            <Text style={styles.codeText} selectable>{content || '— empty —'}</Text>
          </ScrollView>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
