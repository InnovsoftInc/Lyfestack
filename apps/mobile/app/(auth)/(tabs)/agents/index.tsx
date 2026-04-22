import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { DarkTheme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { useOpenClawStore } from '../../../../stores/openclaw.store';
import type { OpenClawAgent } from '@lyfestack/shared';

function StatusDot({ status }: { status: OpenClawAgent['status'] }) {
  const color =
    status === 'active' ? Colors.success : status === 'idle' ? Colors.warning : DarkTheme.border;
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

function AgentCard({ agent }: { agent: OpenClawAgent }) {
  const shortModel = agent.model.split('/').pop() ?? agent.model;
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => router.push(`/(auth)/(tabs)/agents/${agent.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <StatusDot status={agent.status} />
          <Text style={styles.cardName}>{agent.name}</Text>
        </View>
        <Text style={styles.cardArrow}>›</Text>
      </View>
      <Text style={styles.cardRole}>{agent.role}</Text>
      <View style={styles.cardMeta}>
        <Text style={styles.cardModel}>{shortModel}</Text>
        {agent.lastActive && (
          <Text style={styles.cardLastActive}>
            Active {new Date(agent.lastActive).toLocaleDateString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function AgentsScreen() {
  const { agents, connectionStatus, isLoadingAgents, error, fetchAgents, connect } =
    useOpenClawStore();

  const isConnected = connectionStatus === 'connected';

  const handleRefresh = async () => {
    if (isConnected) {
      await fetchAgents();
    } else {
      await connect('localhost', 3000);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Connection banner */}
      <View style={[styles.banner, isConnected ? styles.bannerConnected : styles.bannerDisconnected]}>
        <View style={[styles.dot, { backgroundColor: isConnected ? Colors.success : Colors.error }]} />
        <Text style={styles.bannerText}>
          {isConnected ? 'Connected to Mac' : 'Not connected — tap to retry'}
        </Text>
        {!isConnected && (
          <TouchableOpacity onPress={() => router.push('/(auth)/connect-openclaw')}>
            <Text style={styles.bannerAction}>Setup</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingAgents}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        {error && (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {isLoadingAgents && !agents.length && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.loadingText}>Loading agents…</Text>
          </View>
        )}

        {!isLoadingAgents && !agents.length && isConnected && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🤖</Text>
            <Text style={styles.emptyTitle}>No agents yet</Text>
            <Text style={styles.emptySubtitle}>Create your first agent to get started</Text>
          </View>
        )}

        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push('/(auth)/(tabs)/agents/create')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DarkTheme.background },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  bannerConnected: { backgroundColor: 'rgba(34,197,94,0.08)' },
  bannerDisconnected: { backgroundColor: 'rgba(239,68,68,0.08)' },
  bannerText: { ...TextStyles.small, color: DarkTheme.text.secondary, flex: 1 },
  bannerAction: { ...TextStyles.small, color: Colors.accent, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardName: { ...TextStyles.h4, color: DarkTheme.text.primary },
  cardArrow: { ...TextStyles.bodyMedium, color: DarkTheme.text.secondary },
  cardRole: { ...TextStyles.small, color: DarkTheme.text.secondary, textTransform: 'capitalize' },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  cardModel: { ...TextStyles.caption, color: Colors.accent },
  cardLastActive: { ...TextStyles.caption, color: DarkTheme.text.secondary },
  dot: { width: 8, height: 8, borderRadius: 4 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  loadingText: { ...TextStyles.body, color: DarkTheme.text.secondary },
  errorRow: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  errorText: { ...TextStyles.small, color: Colors.error },
  empty: { alignItems: 'center', paddingVertical: Spacing.xl * 2, gap: Spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { ...TextStyles.h4, color: DarkTheme.text.primary },
  emptySubtitle: { ...TextStyles.small, color: DarkTheme.text.secondary },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: { fontSize: 28, color: Colors.white, lineHeight: 32 },
});
