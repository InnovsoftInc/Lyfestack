import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme';
import { Spacing, BorderRadius } from '../../../../theme';
import { openclawApi } from '../../../../services/openclaw.api';

interface Summary { requests: number; totalTokens: number; estimatedCost: number }
interface AgentUsage { agent: string; requests: number; tokens: number; cost: number }
interface ModelUsage { model: string; requests: number; tokens: number; cost: number }
interface HistoryEntry { timestamp: string; agentName: string; model: string; totalTokens: number; estimatedCost: number; durationMs: number }

export default function OpenClawUsageScreen() {
  const theme = useTheme();
  const s = styles(theme);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<{ today: Summary; week: Summary; month: Summary } | null>(null);
  const [byAgent, setByAgent] = useState<AgentUsage[]>([]);
  const [byModel, setByModel] = useState<ModelUsage[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [sumRes, agentRes, modelRes, histRes] = await Promise.all([
        openclawApi.getUsage(),
        openclawApi.getUsageByAgent(),
        openclawApi.getUsageByModel(),
        openclawApi.getUsageHistory(50),
      ]);
      setSummary(sumRes.data);
      setByAgent(agentRes.data ?? []);
      setByModel(modelRes.data ?? []);
      setHistory(histRes.data ?? []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const formatTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
  const formatCost = (n: number) => n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`;
  const formatTime = (ts: string) => { const d = new Date(ts); return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`; };

  if (loading) return <View style={[s.container, s.center]}><ActivityIndicator color={theme.accent} size="large" /></View>;

  const maxAgentReqs = Math.max(...byAgent.map(a => a.requests), 1);
  const maxModelReqs = Math.max(...byModel.map(m => m.requests), 1);

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}>
      {/* Summary Cards */}
      <View style={s.summaryRow}>
        {(['today', 'week', 'month'] as const).map(period => {
          const data = summary?.[period] ?? { requests: 0, totalTokens: 0, estimatedCost: 0 };
          return (
            <View key={period} style={s.summaryCard}>
              <Text style={s.summaryLabel}>{period === 'today' ? 'Today' : period === 'week' ? 'This Week' : 'This Month'}</Text>
              <Text style={s.summaryValue}>{data.requests}</Text>
              <Text style={s.summaryUnit}>requests</Text>
              <Text style={s.summaryTokens}>{formatTokens(data.totalTokens)} tokens</Text>
              <Text style={s.summaryCost}>{formatCost(data.estimatedCost)}</Text>
            </View>
          );
        })}
      </View>

      {/* By Agent */}
      {byAgent.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Usage by Agent</Text>
          {byAgent.map(a => (
            <View key={a.agent} style={s.barRow}>
              <View style={s.barLabel}>
                <Text style={s.barName}>{a.agent}</Text>
                <Text style={s.barStats}>{a.requests} req · {formatTokens(a.tokens)}</Text>
              </View>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${(a.requests / maxAgentReqs) * 100}%` }]} />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* By Model */}
      {byModel.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Usage by Model</Text>
          {byModel.map(m => (
            <View key={m.model} style={s.barRow}>
              <View style={s.barLabel}>
                <Text style={s.barName}>{m.model.split('/').pop()}</Text>
                <Text style={s.barStats}>{m.requests} req · {formatCost(m.cost)}</Text>
              </View>
              <View style={s.barTrack}>
                <View style={[s.barFill, s.barFillModel, { width: `${(m.requests / maxModelReqs) * 100}%` }]} />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Recent Activity */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Recent Activity</Text>
        {history.length === 0 ? (
          <Text style={s.emptyText}>No usage recorded yet</Text>
        ) : (
          history.slice(0, 20).map((h, i) => (
            <View key={i} style={s.historyRow}>
              <View style={s.historyLeft}>
                <Text style={s.historyAgent}>{h.agentName}</Text>
                <Text style={s.historyMeta}>{h.model.split('/').pop()} · {formatTokens(h.totalTokens)} tokens · {Math.round(h.durationMs / 1000)}s</Text>
              </View>
              <Text style={s.historyTime}>{formatTime(h.timestamp)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.background, padding: Spacing.lg },
  center: { justifyContent: 'center', alignItems: 'center' },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  summaryCard: { flex: 1, backgroundColor: t.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: t.border },
  summaryLabel: { color: t.text.secondary, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { color: t.text.primary, fontSize: 28, fontWeight: '700', marginTop: 4 },
  summaryUnit: { color: t.text.secondary, fontSize: 11, marginTop: -2 },
  summaryTokens: { color: t.accent, fontSize: 11, fontWeight: '600', marginTop: 6 },
  summaryCost: { color: t.text.secondary, fontSize: 11, marginTop: 2 },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { color: t.text.secondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.md },
  barRow: { marginBottom: Spacing.md },
  barLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barName: { color: t.text.primary, fontSize: 14, fontWeight: '600' },
  barStats: { color: t.text.secondary, fontSize: 12 },
  barTrack: { height: 8, backgroundColor: t.border, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: t.accent, borderRadius: 4, minWidth: 4 },
  barFillModel: { backgroundColor: '#22C55E' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
  historyLeft: { flex: 1 },
  historyAgent: { color: t.text.primary, fontSize: 14, fontWeight: '600' },
  historyMeta: { color: t.text.secondary, fontSize: 11, marginTop: 2 },
  historyTime: { color: t.text.secondary, fontSize: 12 },
  emptyText: { color: t.text.secondary, fontSize: 14, textAlign: 'center', paddingVertical: Spacing.xl },
});
