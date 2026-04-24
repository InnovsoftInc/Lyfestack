import {
  Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  initialAgentId?: string | null;
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
  visible, sessions, activeKey, loading, busyKey, theme, initialAgentId, onClose, onSelect, onNew, onDelete,
}: Props) {
  const listRef = useRef<FlatList<SessionSummary>>(null);
  const agentIds = useMemo(
    () => Array.from(new Set(sessions.map((session) => session.agentId))).sort((a, b) => a.localeCompare(b)),
    [sessions],
  );
  const activeAgentId = activeKey?.split('/')[0] ?? null;
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(initialAgentId ?? activeAgentId);
  const filteredSessions = useMemo(
    () => (!selectedAgentId ? sessions : sessions.filter((session) => session.agentId === selectedAgentId)),
    [selectedAgentId, sessions],
  );

  useEffect(() => {
    if (!visible) return;
    const nextAgentId = initialAgentId ?? activeAgentId ?? agentIds[0] ?? null;
    setSelectedAgentId(nextAgentId);
  }, [visible, initialAgentId, activeAgentId, agentIds]);

  useEffect(() => {
    if (!visible || loading || filteredSessions.length === 0) return;
    requestAnimationFrame(() => {
      const activeIndex = activeKey ? filteredSessions.findIndex((session) => session.key === activeKey) : -1;
      if (activeIndex >= 0) {
        listRef.current?.scrollToIndex({ index: activeIndex, animated: false, viewPosition: 0.5 });
        return;
      }
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [visible, loading, filteredSessions, activeKey]);

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

          {agentIds.length > 0 && (
            <View style={styles.filterWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
                {agentIds.map((agentId) => {
                  const isActive = agentId === selectedAgentId;
                  return (
                    <TouchableOpacity
                      key={agentId}
                      onPress={() => setSelectedAgentId(agentId)}
                      activeOpacity={0.7}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: isActive ? theme.accent + '18' : theme.background,
                          borderColor: isActive ? theme.accent + '55' : theme.border,
                        },
                      ]}
                    >
                      <Text style={{ color: isActive ? theme.accent : theme.text.secondary, fontSize: 12, fontWeight: '600' }}>
                        {agentId}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {loading ? (
            <View style={{ paddingVertical: Spacing.lg, alignItems: 'center' }}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : filteredSessions.length === 0 ? (
            <Text style={[styles.empty, { color: theme.text.secondary }]}>No sessions yet. Tap + New to start one.</Text>
          ) : (
            <FlatList
              ref={listRef}
              data={filteredSessions}
              keyExtractor={(item) => item.key}
              style={{ maxHeight: 380 }}
              onScrollToIndexFailed={() => listRef.current?.scrollToEnd({ animated: false })}
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
  filterWrap: { marginBottom: Spacing.md },
  filterContent: { gap: 8, paddingRight: 4 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
  },
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
