import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors, ApprovalState, AgentRole } from '@lyfestack/shared';
import { useApprovalsStore } from '../../../../stores/approvals.store';
import { Badge } from '../../../../components/ui';
import type { AgentAction } from '@lyfestack/shared';
import { approvalsApi, type AllowlistEntry, type PendingApproval } from '../../../../services/openclaw-extras.api';

function agentRoleLabel(role: AgentRole) {
  switch (role) {
    case AgentRole.EXECUTOR: return 'Executor Agent';
    case AgentRole.PLANNER: return 'Planner Agent';
    case AgentRole.REVIEWER: return 'Reviewer Agent';
    case AgentRole.COACH: return 'Coach Agent';
    default: return 'Agent';
  }
}

function actionLabel(action: string) {
  switch (action) {
    case 'DRAFT_CONTENT': return 'Content Draft';
    case 'UPDATE_PRICING': return 'Pricing Update';
    case 'SCHEDULE_POST': return 'Post Scheduled';
    default: return action.replace(/_/g, ' ');
  }
}

function confidenceVariant(score: number): 'success' | 'warning' | 'error' {
  if (score >= 85) return 'success';
  if (score >= 65) return 'warning';
  return 'error';
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.xl,
      paddingBottom: Spacing.md,
    },
    heading: { ...TextStyles.h1, color: theme.text.primary },
    pendingBadge: {
      backgroundColor: 'rgba(14,165,233,0.15)',
      borderRadius: BorderRadius.full,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    pendingBadgeText: { ...TextStyles.caption, color: Colors.accent, fontWeight: '700' },
    scroll: { flex: 1 },
    section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
    sectionLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.md,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    cardResolved: { opacity: 0.65 },
    cardHeader: { gap: 8 },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    agentRole: { ...TextStyles.caption, color: Colors.accent, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    actionLabel: { ...TextStyles.h4, color: theme.text.primary },
    payloadSection: {
      backgroundColor: theme.background,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      gap: 8,
    },
    payloadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
    payloadKey: { ...TextStyles.caption, color: theme.text.secondary, textTransform: 'capitalize', flexShrink: 0 },
    payloadValue: { ...TextStyles.small, color: theme.text.primary, flex: 1, textAlign: 'right' },
    rationaleSection: { gap: 6 },
    rationaleLabel: { ...TextStyles.caption, color: theme.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    rationaleText: { ...TextStyles.small, color: theme.text.secondary, lineHeight: 20 },
    cardActions: { flexDirection: 'row', gap: Spacing.sm },
    approveBtn: {
      flex: 2,
      backgroundColor: Colors.accent,
      borderRadius: BorderRadius.md,
      paddingVertical: 10,
      alignItems: 'center',
    },
    approveBtnText: { ...TextStyles.small, color: Colors.white, fontWeight: '600' },
    editBtn: {
      flex: 1,
      backgroundColor: theme.border,
      borderRadius: BorderRadius.md,
      paddingVertical: 10,
      alignItems: 'center',
    },
    editBtnText: { ...TextStyles.small, color: theme.text.primary },
    rejectBtn: {
      flex: 1,
      backgroundColor: 'rgba(239,68,68,0.15)',
      borderRadius: BorderRadius.md,
      paddingVertical: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Colors.error,
    },
    rejectBtnText: { ...TextStyles.small, color: Colors.error, fontWeight: '600' },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing['2xl'],
      gap: Spacing.md,
    },
    emptyIcon: { fontSize: 48 },
    emptyTitle: { ...TextStyles.h3, color: theme.text.primary },
    emptySubtitle: { ...TextStyles.body, color: theme.text.secondary, textAlign: 'center' },
    spacer: { height: 40 },
  });
}

interface ApprovalCardProps {
  action: AgentAction;
  onApprove: () => void;
  onReject: () => void;
}

function ApprovalCard({ action, onApprove, onReject }: ApprovalCardProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const isPending = action.approvalState === ApprovalState.PENDING;
  const payloadEntries = Object.entries(action.payload).slice(0, 2);

  return (
    <View style={[styles.card, !isPending && styles.cardResolved]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.agentRole}>{agentRoleLabel(action.agentRole)}</Text>
          {!isPending && (
            <Badge
              label={action.approvalState === ApprovalState.APPROVED ? 'Approved' : 'Rejected'}
              variant={action.approvalState === ApprovalState.APPROVED ? 'success' : 'error'}
            />
          )}
        </View>
        <View style={styles.actionRow}>
          <Text style={styles.actionLabel}>{actionLabel(action.action)}</Text>
          <Badge label={`${(action as AgentAction & { confidence?: number }).confidence ?? 0}% confidence`} variant={confidenceVariant((action as AgentAction & { confidence?: number }).confidence ?? 0)} />
        </View>
      </View>

      {/* Payload preview */}
      <View style={styles.payloadSection}>
        {payloadEntries.map(([key, value]) => (
          <View key={key} style={styles.payloadRow}>
            <Text style={styles.payloadKey}>{key.replace(/([A-Z])/g, ' $1').trim()}</Text>
            <Text style={styles.payloadValue} numberOfLines={1}>
              {String(value)}
            </Text>
          </View>
        ))}
      </View>

      {/* Rationale */}
      <View style={styles.rationaleSection}>
        <Text style={styles.rationaleLabel}>Why the agent did this</Text>
        <Text style={styles.rationaleText}>{action.rationale}</Text>
      </View>

      {isPending && (
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.approveBtn} onPress={onApprove} activeOpacity={0.8}>
            <Text style={styles.approveBtnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.8}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.8}>
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function ExecApprovalCard({ item, onDecide, theme }: { item: PendingApproval; onDecide: (decision: 'approve' | 'reject' | 'allow-always') => void; theme: Theme }) {
  return (
    <View style={{ backgroundColor: theme.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: theme.border, padding: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ ...TextStyles.caption, color: Colors.accent, fontWeight: '700', textTransform: 'uppercase' }}>{item.agent}</Text>
        <Text style={{ ...TextStyles.caption, color: theme.text.secondary }}>{new Date(item.requestedAt).toLocaleTimeString()}</Text>
      </View>
      <Text style={{ ...TextStyles.bodyMedium, color: theme.text.primary, fontFamily: 'Menlo' }} numberOfLines={4}>{item.command}</Text>
      {item.resolvedPath ? <Text style={{ ...TextStyles.caption, color: theme.text.secondary }}>resolved: {item.resolvedPath}</Text> : null}
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <TouchableOpacity onPress={() => onDecide('approve')} style={{ flex: 2, backgroundColor: Colors.accent, borderRadius: BorderRadius.md, paddingVertical: 10, alignItems: 'center' }} activeOpacity={0.8}>
          <Text style={{ ...TextStyles.small, color: Colors.white, fontWeight: '600' }}>Approve once</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDecide('allow-always')} style={{ flex: 1, backgroundColor: theme.border, borderRadius: BorderRadius.md, paddingVertical: 10, alignItems: 'center' }} activeOpacity={0.8}>
          <Text style={{ ...TextStyles.small, color: theme.text.primary }}>Always</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDecide('reject')} style={{ flex: 1, backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: BorderRadius.md, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.error }} activeOpacity={0.8}>
          <Text style={{ ...TextStyles.small, color: Colors.error, fontWeight: '600' }}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AllowlistCard({ agent, entries, theme, onRemove }: { agent: string; entries: AllowlistEntry[]; theme: Theme; onRemove: (id: string) => void }) {
  if (!entries.length) return null;
  return (
    <View style={{ backgroundColor: theme.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: theme.border, padding: Spacing.md, marginBottom: Spacing.md, gap: 8 }}>
      <Text style={{ ...TextStyles.caption, color: Colors.accent, fontWeight: '700', textTransform: 'uppercase' }}>{agent}</Text>
      {entries.map((e) => (
        <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }}>
          <View style={{ flex: 1, paddingRight: Spacing.sm }}>
            <Text style={{ ...TextStyles.small, color: theme.text.primary, fontFamily: 'Menlo' }} numberOfLines={1}>{e.pattern}</Text>
            {e.lastUsedCommand ? <Text style={{ ...TextStyles.caption, color: theme.text.secondary }} numberOfLines={1}>last: {e.lastUsedCommand}</Text> : null}
          </View>
          <TouchableOpacity onPress={() => onRemove(e.id)} hitSlop={8}>
            <Text style={{ color: Colors.error, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

export default function ApprovalsScreen() {
  const { actions, approve, reject } = useApprovalsStore();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [execPending, setExecPending] = useState<PendingApproval[]>([]);
  const [allowlist, setAllowlist] = useState<Record<string, AllowlistEntry[]>>({});
  const [execLoading, setExecLoading] = useState(true);

  const loadExec = useCallback(async () => {
    try {
      const [pending, lists] = await Promise.all([
        approvalsApi.listPending(),
        approvalsApi.listAllowlist(),
      ]);
      setExecPending(pending);
      setAllowlist(lists);
    } catch { /* best-effort */ }
    finally { setExecLoading(false); }
  }, []);

  useEffect(() => { void loadExec(); }, [loadExec]);

  const handleExecDecide = async (item: PendingApproval, decision: 'approve' | 'reject' | 'allow-always') => {
    if (!item.pattern && !item.command) return;
    try {
      await approvalsApi.decide({
        agent: item.agent,
        pattern: item.pattern ?? item.command,
        decision,
      });
      await loadExec();
    } catch (err: any) {
      Alert.alert('Decision failed', err?.message ?? 'Could not record decision.');
    }
  };

  const handleRemoveAllowlist = async (agent: string, id: string) => {
    try { await approvalsApi.removeEntry(agent, id); await loadExec(); }
    catch (err: any) { Alert.alert('Remove failed', err?.message ?? 'Could not remove entry.'); }
  };

  const pending = actions.filter((a) => a.approvalState === ApprovalState.PENDING) as AgentAction[];
  const resolved = actions.filter((a) => a.approvalState !== ApprovalState.PENDING) as AgentAction[];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Approvals</Text>
        {pending.length > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{pending.length} pending</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>OPENCLAW EXEC REQUESTS</Text>
          {execLoading ? (
            <ActivityIndicator color={Colors.accent} />
          ) : execPending.length === 0 ? (
            <Text style={{ ...TextStyles.small, color: theme.text.secondary }}>No pending shell commands.</Text>
          ) : (
            execPending.map((item) => (
              <ExecApprovalCard key={item.id} item={item} theme={theme} onDecide={(d) => handleExecDecide(item, d)} />
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ALLOWLIST</Text>
          {Object.entries(allowlist).map(([agent, entries]) => (
            <AllowlistCard key={agent} agent={agent} entries={entries} theme={theme} onRemove={(id) => handleRemoveAllowlist(agent, id)} />
          ))}
        </View>

        {pending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>AGENT ACTIONS NEEDING REVIEW</Text>
            {pending.map((action) => (
              <ApprovalCard
                key={action.id}
                action={action}
                onApprove={() => approve(action.id)}
                onReject={() => reject(action.id)}
              />
            ))}
          </View>
        )}

        {pending.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>No pending approvals. Agents are running smoothly.</Text>
          </View>
        )}

        {resolved.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>HISTORY</Text>
            {resolved.map((action) => (
              <ApprovalCard
                key={action.id}
                action={action}
                onApprove={() => approve(action.id)}
                onReject={() => reject(action.id)}
              />
            ))}
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
