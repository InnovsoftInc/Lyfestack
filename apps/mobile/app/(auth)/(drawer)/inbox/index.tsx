import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { deliveryQueueApi, type DeliveryItem, type DeliveryStatus, type QueueListing } from '../../../../services/openclaw-extras.api';

const TABS: Array<{ key: DeliveryStatus; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'failed', label: 'Failed' },
  { key: 'sent', label: 'Sent' },
];

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { padding: Spacing.xl, paddingBottom: Spacing.md },
    heading: { ...TextStyles.h1, color: theme.text.primary },
    sub: { ...TextStyles.small, color: theme.text.secondary, marginTop: 4 },
    tabs: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: Spacing.sm, marginBottom: Spacing.md },
    tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 6 },
    tabActive: { backgroundColor: Colors.accent + '22', borderColor: Colors.accent },
    tabLabel: { ...TextStyles.small, color: theme.text.secondary, fontWeight: '600' },
    tabLabelActive: { color: Colors.accent },
    badge: { backgroundColor: theme.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
    badgeLabel: { ...TextStyles.caption, color: theme.text.primary, fontWeight: '700', fontSize: 10 },
    list: { paddingHorizontal: Spacing.xl, paddingBottom: 40 },
    card: { backgroundColor: theme.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: theme.border, padding: Spacing.md, marginBottom: Spacing.sm },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
    title: { ...TextStyles.bodyMedium, color: theme.text.primary, flex: 1 },
    when: { ...TextStyles.caption, color: theme.text.secondary },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    metaChip: { backgroundColor: theme.background, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: theme.border },
    metaChipLabel: { ...TextStyles.caption, color: theme.text.secondary },
    err: { ...TextStyles.caption, color: theme.error, marginTop: 6 },
    actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    btn: { flex: 1, paddingVertical: 8, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
    btnPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
    btnLabel: { ...TextStyles.small, color: theme.text.primary, fontWeight: '600' },
    btnLabelPrimary: { color: Colors.white },
    empty: { padding: Spacing.xl, alignItems: 'center' },
    emptyText: { ...TextStyles.body, color: theme.text.secondary, textAlign: 'center' },
  });
}

function ItemCard({ item, theme, onRetry, onDelete }: { item: DeliveryItem; theme: Theme; onRetry?: () => void; onDelete: () => void }) {
  const styles = makeStyles(theme);
  return (
    <View style={styles.card}>
      <View style={styles.rowTop}>
        <Text style={styles.title} numberOfLines={2}>{item.subject ?? item.filename}</Text>
        <Text style={styles.when}>{new Date(item.updatedAt).toLocaleString()}</Text>
      </View>
      <View style={styles.metaRow}>
        {item.channel ? <View style={styles.metaChip}><Text style={styles.metaChipLabel}>{item.channel}</Text></View> : null}
        {item.recipient ? <View style={styles.metaChip}><Text style={styles.metaChipLabel}>→ {item.recipient}</Text></View> : null}
        {typeof item.attempts === 'number' ? <View style={styles.metaChip}><Text style={styles.metaChipLabel}>tries: {item.attempts}</Text></View> : null}
        <View style={styles.metaChip}><Text style={styles.metaChipLabel}>{(item.size / 1024).toFixed(1)} KB</Text></View>
      </View>
      {item.lastError ? <Text style={styles.err} numberOfLines={3}>{item.lastError}</Text> : null}
      <View style={styles.actions}>
        {onRetry ? (
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onRetry} activeOpacity={0.7}>
            <Text style={[styles.btnLabel, styles.btnLabelPrimary]}>Retry</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.btn} onPress={onDelete} activeOpacity={0.7}>
          <Text style={styles.btnLabel}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function InboxScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [tab, setTab] = useState<DeliveryStatus>('pending');
  const [data, setData] = useState<QueueListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await deliveryQueueApi.list());
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load delivery queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); void load(); };

  const handleRetry = async (id: string) => {
    try { await deliveryQueueApi.retry(id); await load(); }
    catch (err: any) { Alert.alert('Retry failed', err?.message ?? 'Could not retry'); }
  };
  const handleDelete = async (id: string) => {
    Alert.alert('Delete item?', 'This removes it from the queue permanently.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deliveryQueueApi.remove(id); await load(); }
        catch (err: any) { Alert.alert('Delete failed', err?.message ?? 'Could not delete'); }
      } },
    ]);
  };

  const items = data ? data[tab] ?? [] : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>📬 Inbox</Text>
        <Text style={styles.sub}>Outgoing delivery queue from ~/.openclaw/delivery-queue/</Text>
      </View>
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const count = data?.counts[t.key] ?? 0;
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, active && styles.tabActive]} activeOpacity={0.7}>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
              <View style={styles.badge}><Text style={styles.badgeLabel}>{count}</Text></View>
            </TouchableOpacity>
          );
        })}
      </View>
      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}>
          {error ? <Text style={[styles.err, { marginBottom: 12 }]}>{error}</Text> : null}
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{tab === 'pending' ? 'Nothing waiting to send.' : tab === 'failed' ? 'No failures — nice.' : 'No sent items yet.'}</Text>
            </View>
          ) : (
            items.map((it) => {
              const props = {
                item: it,
                theme,
                onDelete: () => handleDelete(it.id),
                ...(tab === 'failed' ? { onRetry: () => handleRetry(it.id) } : {}),
              };
              return <ItemCard key={it.id} {...props} />;
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
