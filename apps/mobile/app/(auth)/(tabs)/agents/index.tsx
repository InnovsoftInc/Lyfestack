import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useOpenClawStore } from '../../../../stores/openclaw.store';

export default function AgentsScreen() {
  const router = useRouter();
  const { connectionStatus, agents, connect, fetchAgents } = useOpenClawStore();

  useEffect(() => { connect(); }, []);

  const statusColor = connectionStatus === 'connected' ? '#22C55E' : connectionStatus === 'connecting' ? '#F59E0B' : '#EF4444';

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text style={styles.statusText}>
          {connectionStatus === 'connected' ? 'Connected to Mac' : connectionStatus === 'connecting' ? 'Connecting...' : 'Not connected'}
        </Text>
        {connectionStatus === 'disconnected' && (
          <TouchableOpacity onPress={connect} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={agents}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/(auth)/(tabs)/agents/${item.name}` as any)}>
            <View style={styles.cardHeader}>
              <Text style={styles.agentName}>{item.name}</Text>
              <View style={[styles.statusDot, { backgroundColor: item.status === 'idle' ? '#22C55E' : '#666' }]} />
            </View>
            <Text style={styles.agentRole}>{item.role}</Text>
            <Text style={styles.agentModel}>{item.model}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{connectionStatus === 'connected' ? 'No agents found' : 'Connect to see your agents'}</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/(auth)/(tabs)/agents/create' as any)}>
        <Text style={styles.fabText}>+ New Agent</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  statusBar: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#222' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { color: '#888', fontSize: 13, flex: 1 },
  retryBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' },
  retryText: { color: '#0EA5E9', fontSize: 12, fontWeight: '600' },
  list: { padding: 16 },
  card: { backgroundColor: '#111', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  agentName: { color: '#EDEDED', fontSize: 18, fontWeight: '700' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  agentRole: { color: '#0EA5E9', fontSize: 13, marginBottom: 2 },
  agentModel: { color: '#555', fontSize: 12 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#555', fontSize: 15 },
  fab: { position: 'absolute', bottom: 24, right: 16, backgroundColor: '#0EA5E9', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  fabText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
