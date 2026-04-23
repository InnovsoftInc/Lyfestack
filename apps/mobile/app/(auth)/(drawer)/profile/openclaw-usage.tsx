import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { openclawApi } from '../../../../services/openclaw.api';

interface UsageSummary {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
}

interface AgentUsage extends UsageSummary { agentName: string; }
interface ModelUsage extends UsageSummary { model: string; }

interface UsageEntry {
  id: string;
  timestamp: string;
  agentName: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  duration: number;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scroll: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.xl,
      paddingBottom: Spacing.md,
    },
    backBtn: { paddingRight: Spacing.sm },
    backText: { ...TextStyles.h3, color: theme.text.secondary },
    heading: { ...TextStyles.h1, color: theme.text.primary },
    section: { marginBottom: Spacing.xl, paddingHorizontal: Spacing.xl },
    sectionLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.md,
    },
    summaryRow: { flexDirection: 'row', gap: Spacing.sm },
    summaryCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      gap: 4,
    },
    summaryCardLabel: { ...TextStyles.caption, color: theme.text.secondary },
    summaryRequests: { ...TextStyles.h3, color: Colors.accent },
    summaryTokens: { ...TextStyles.caption, color: theme.text.primary },
    summaryCost: { ...TextStyles.caption, color: theme.text.secondary },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    barLabel: { ...TextStyles.small, color: theme.text.primary, width: 80 },
    barTrack: {
      flex: 1,
      height: 8,
      backgroundColor: theme.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    barFill: { height: 8, borderRadius: 4, backgroundColor: Colors.accent },
    barCount: { ...TextStyles.caption, color: theme.text.secondary, width: 32, textAlign: 'right' },
    listCard: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    listRow: {
      padding: Spacing.md,
      gap: 4,
    },
    listRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    listAgent: { ...TextStyles.bodyMedium, color: theme.text.primary },
    listTime: { ...TextStyles.caption, color: theme.text.secondary },
    listModel: { ...TextStyles.small, color: Colors.accent },
    listMeta: { ...TextStyles.caption, color: theme.text.secondary },
    divider: { height: 1, backgroundColor: theme.border },
    empty: { ...TextStyles.small, color: theme.text.secondary, textAlign: 'center', padding: Spacing.xl },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  });
}

function fmtTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function fmtCost(n: number): string {
  if (n < 0.001) return `<$0.001`;
  return `$${n.toFixed(3)}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function shortModel(model: string): string {
  const parts = model.split('/');
  const last = parts[parts.length - 1];
  return last.length > 20 ? last.slice(0, 18) + '…' : last;
}

function SummaryCard({ label, data }: { label: string; data: UsageSummary | null }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryCardLabel}>{label}</Text>
      <Text style={styles.summaryRequests}>{data?.requests ?? 0}</Text>
      <Text style={styles.summaryTokens}>{fmtTokens(data?.totalTokens ?? 0)} tok</Text>
      <Text style={styles.summaryCost}>{fmtCost(data?.cost ?? 0)}</Text>
    </View>
  );
}

function BarRow({ label, count, maxCount }: { label: string; count: number; maxCount: number }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const pct = maxCount > 0 ? count / maxCount : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(pct * 100, 2)}%` as any }]} />
      </View>
      <Text style={styles.barCount}>{count}</Text>
    </View>
  );
}

export default function OpenClawUsageScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{ today: UsageSummary; week: UsageSummary; month: UsageSummary } | null>(null);
  const [byAgent, setByAgent] = useState<AgentUsage[]>([]);
  const [byModel, setByModel] = useState<ModelUsage[]>([]);
  const [history, setHistory] = useState<UsageEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [usageRes, agentRes, modelRes, historyRes] = await Promise.all([
          openclawApi.getUsage(),
          openclawApi.getUsageByAgent(),
          openclawApi.getUsageByModel(),
          openclawApi.getUsageHistory(),
        ]);
        setSummary(usageRes.data);
        setByAgent(agentRes.data ?? []);
        setByModel(modelRes.data ?? []);
        setHistory(historyRes.data ?? []);
      } catch (err: any) {
        setError(err.message ?? 'Failed to load usage data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.heading}>Usage & Tokens</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.empty}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const maxAgentCount = byAgent[0]?.requests ?? 1;
  const maxModelCount = byModel[0]?.requests ?? 1;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.heading}>Usage & Tokens</Text>
        </View>

        {/* Summary cards */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>OVERVIEW</Text>
          <View style={styles.summaryRow}>
            <SummaryCard label="Today" data={summary?.today ?? null} />
            <SummaryCard label="This Week" data={summary?.week ?? null} />
            <SummaryCard label="30 Days" data={summary?.month ?? null} />
          </View>
        </View>

        {/* By agent */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BY AGENT</Text>
          {byAgent.length === 0 ? (
            <Text style={styles.empty}>No agent data yet</Text>
          ) : (
            byAgent.map((a) => (
              <BarRow key={a.agentName} label={a.agentName} count={a.requests} maxCount={maxAgentCount} />
            ))
          )}
        </View>

        {/* By model */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BY MODEL</Text>
          {byModel.length === 0 ? (
            <Text style={styles.empty}>No model data yet</Text>
          ) : (
            byModel.map((m) => (
              <BarRow key={m.model} label={shortModel(m.model)} count={m.requests} maxCount={maxModelCount} />
            ))
          )}
        </View>

        {/* Recent activity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
          {history.length === 0 ? (
            <Text style={styles.empty}>No activity yet — send a message to an agent to start tracking</Text>
          ) : (
            <View style={styles.listCard}>
              {history.map((entry, i) => (
                <View key={entry.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.listRow}>
                    <View style={styles.listRowTop}>
                      <Text style={styles.listAgent}>{entry.agentName}</Text>
                      <Text style={styles.listTime}>{relativeTime(entry.timestamp)}</Text>
                    </View>
                    <Text style={styles.listModel}>{shortModel(entry.model)}</Text>
                    <Text style={styles.listMeta}>
                      {fmtTokens(entry.promptTokens + entry.completionTokens)} tokens · {fmtCost(entry.cost)} · {(entry.duration / 1000).toFixed(1)}s
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
