import {
  Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Spacing } from '../theme';
import type { Theme } from '../theme';
import type { SessionSummary } from '../stores/openclaw.store';

interface Props {
  visible: boolean;
  sessions: SessionSummary[];
  activeKey: string | null;
  loading?: boolean;
  busyKey?: string | null;
  theme: Theme;
  onClose: () => void;
  onSelect: (key: string) => void;
  onNew: () => void;
  onDelete: (key: string) => void;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const sec = Math.max(1, Math.floor(diff / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function SessionPickerSheet({
  visible, sessions, activeKey, loading, busyKey, theme, onClose, onSelect, onNew, onDelete,
}: Props) {
  const handleDelete = (session: SessionSummary) => {
    Alert.alert(
      'Delete session?',
      `"${session.label}" will be archived (kept on disk as .bak).`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(session.key) },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text.primary }]}>Sessions</Text>
            <TouchableOpacity onPress={onNew} activeOpacity={0.7} style={[styles.newBtn, { backgroundColor: theme.accent }]} hitSlop={6}>
              <Text style={styles.newBtnText}>+ New</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ paddingVertical: Spacing.lg, alignItems: 'center' }}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : sessions.length === 0 ? (
            <Text style={[styles.empty, { color: theme.text.secondary }]}>No sessions yet. Tap + New to start one.</Text>
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={(item) => item.key}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => {
                const pct = item.contextWindow > 0
                  ? Math.max(0, Math.min(100, (item.usage.contextUsedTokens / item.contextWindow) * 100))
                  : 0;
                const barColor = pct >= 90 ? theme.error : pct >= 70 ? theme.warning : theme.success;
                const isActive = item.key === activeKey;
                const isBusy = item.key === busyKey;
                return (
                  <TouchableOpacity
                    onPress={() => onSelect(item.key)}
                    disabled={isBusy}
                    activeOpacity={0.7}
                    style={[styles.row, isActive && { backgroundColor: theme.accent + '15' }]}
                  >
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[styles.label, { color: theme.text.primary }]} numberOfLines={1}>
                        {item.label || '(empty)'}
                      </Text>
                      <View style={styles.metaRow}>
                        <Text style={[styles.meta, { color: theme.text.secondary }]}>{formatRelative(item.updatedAt)}</Text>
                        {item.model ? (
                          <Text style={[styles.meta, { color: theme.text.secondary }]}>· {item.model.split('/').pop()}</Text>
                        ) : null}
                        {item.contextWindow > 0 ? (
                          <Text style={[styles.meta, { color: theme.text.secondary }]}>
                            · {formatTokens(item.usage.contextUsedTokens)}/{formatTokens(item.contextWindow)}
                          </Text>
                        ) : null}
                        {item.compactionCount > 0 ? (
                          <Text style={[styles.meta, { color: theme.text.secondary }]}>· {item.compactionCount}↻</Text>
                        ) : null}
                      </View>
                      {item.contextWindow > 0 ? (
                        <View style={[styles.track, { backgroundColor: theme.border + '60' }]}>
                          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor, borderRadius: 2 }} />
                        </View>
                      ) : null}
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={10} style={styles.delBtn} disabled={isBusy}>
                      <Text style={{ color: theme.error, fontSize: 16 }}>🗑</Text>
                    </TouchableOpacity>
                    {isActive && <Text style={[styles.check, { color: theme.accent }]}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <TouchableOpacity style={[styles.close, { borderColor: theme.border }]} onPress={onClose}>
            <Text style={[styles.closeText, { color: theme.text.secondary }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, maxHeight: '75%' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  title: { fontSize: 18, fontWeight: '700' },
  newBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: { textAlign: 'center', paddingVertical: Spacing.lg, fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10,
    marginBottom: 4,
  },
  label: { fontSize: 14, fontWeight: '600' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  meta: { fontSize: 11 },
  track: { height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  delBtn: { padding: 6 },
  check: { fontSize: 16, fontWeight: '700', marginLeft: 4 },
  close: {
    marginTop: Spacing.md, paddingVertical: 14, alignItems: 'center', borderRadius: 12,
    borderWidth: 1,
  },
  closeText: { fontSize: 15, fontWeight: '600' },
});
