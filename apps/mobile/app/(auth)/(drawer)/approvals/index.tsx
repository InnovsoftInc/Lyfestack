import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors, ApprovalState, AgentRole } from '@lyfestack/shared';
import { useApprovalsStore } from '../../../../stores/approvals.store';
import { Badge } from '../../../../components/ui';
import type { AgentAction } from '@lyfestack/shared';

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
          <Badge label={`${action.confidence}% confidence`} variant={confidenceVariant(action.confidence)} />
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

export default function ApprovalsScreen() {
  const { actions, approve, reject } = useApprovalsStore();
  const theme = useTheme();
  const styles = makeStyles(theme);

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
        {pending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NEEDS YOUR REVIEW</Text>
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
