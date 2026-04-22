import { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors, ApprovalState } from '@lyfestack/shared';
import { useApprovalsStore } from '../../../../stores/approvals.store';
import { Badge } from '../../../../components/ui';
import type { AgentAction } from '../../../../services/agents.api';

function agentRoleLabel(role: string) {
  switch (role) {
    case 'EXECUTOR': return 'Executor Agent';
    case 'PLANNER': return 'Planner Agent';
    case 'REVIEWER': return 'Reviewer Agent';
    case 'COACH': return 'Coach Agent';
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

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.lg,
    },
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
    list: { paddingBottom: Spacing['2xl'] },
    sectionLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: Spacing.md,
      marginHorizontal: Spacing.xl,
      marginTop: Spacing.md,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: Spacing.md,
      gap: Spacing.md,
      marginHorizontal: Spacing.xl,
      marginBottom: Spacing.md,
    },
    cardResolved: { opacity: 0.65 },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    agentRole: {
      ...TextStyles.caption,
      color: Colors.accent,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    actionLabel: { ...TextStyles.h4, color: theme.text.primary },
    payloadSection: {
      backgroundColor: theme.background,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      gap: 8,
    },
    payloadRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.md,
    },
    payloadKey: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      textTransform: 'capitalize',
      flexShrink: 0,
    },
    payloadValue: { ...TextStyles.small, color: theme.text.primary, flex: 1, textAlign: 'right' },
    rationaleLabel: {
      ...TextStyles.caption,
      color: theme.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
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
    errorText: { ...TextStyles.body, color: theme.error, textAlign: 'center' },
    retryButton: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    retryText: { ...TextStyles.button, color: theme.text.secondary },
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
      </View>

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

      <View>
        <Text style={styles.rationaleLabel}>Why the agent did this</Text>
        <Text style={styles.rationaleText}>{action.rationale}</Text>
      </View>

      {isPending && (
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.approveBtn} onPress={onApprove} activeOpacity={0.8}>
            <Text style={styles.approveBtnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={onReject} activeOpacity={0.8}>
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

type ListItem =
  | { kind: 'sectionLabel'; label: string; key: string }
  | { kind: 'card'; action: AgentAction; key: string }
  | { kind: 'empty'; key: string };

export default function ApprovalsScreen() {
  const { actions, isLoading, error, fetch, approve, reject } = useApprovalsStore();
  const theme = useTheme();
  const styles = makeStyles(theme);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const handleRefresh = useCallback(() => {
    void fetch();
  }, [fetch]);

  if (isLoading && actions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error && actions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pending = actions.filter((a) => a.approvalState === ApprovalState.PENDING);
  const resolved = actions.filter((a) => a.approvalState !== ApprovalState.PENDING);

  const items: ListItem[] = [];

  if (pending.length > 0) {
    items.push({ kind: 'sectionLabel', label: 'NEEDS YOUR REVIEW', key: 'label-pending' });
    pending.forEach((a) => items.push({ kind: 'card', action: a, key: a.id }));
  }

  if (pending.length === 0 && resolved.length === 0) {
    items.push({ kind: 'empty', key: 'empty' });
  }

  if (resolved.length > 0) {
    items.push({ kind: 'sectionLabel', label: 'HISTORY', key: 'label-resolved' });
    resolved.forEach((a) => items.push({ kind: 'card', action: a, key: a.id }));
  }

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

      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
        renderItem={({ item }) => {
          if (item.kind === 'sectionLabel') {
            return <Text style={styles.sectionLabel}>{item.label}</Text>;
          }
          if (item.kind === 'empty') {
            return (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptySubtitle}>No pending approvals. Agents are running smoothly.</Text>
              </View>
            );
          }
          return (
            <ApprovalCard
              action={item.action}
              onApprove={() => void approve(item.action.id)}
              onReject={() => void reject(item.action.id)}
            />
          );
        }}
      />
    </SafeAreaView>
  );
}
