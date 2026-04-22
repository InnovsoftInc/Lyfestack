import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { DarkTheme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { useAuthStore } from '../../../../stores/auth.store';

const API_BASE = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';

interface IntegrationStatus {
  connected: boolean;
}

interface IntegrationsStatus {
  calendar: IntegrationStatus;
  buffer: IntegrationStatus;
}

interface IntegrationDef {
  key: keyof IntegrationsStatus;
  name: string;
  description: string;
  icon: string;
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    key: 'calendar',
    name: 'Google Calendar',
    description: 'Sync tasks to your calendar and avoid scheduling conflicts.',
    icon: '📅',
  },
  {
    key: 'buffer',
    name: 'Buffer',
    description: 'Schedule social media posts directly from your Lyfestack goals.',
    icon: '📢',
  },
];

export default function IntegrationsScreen() {
  const { authToken } = useAuthStore();
  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/integrations/status`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setStatus((await res.json()) as IntegrationsStatus);
      }
    } catch {
      // Silently fail — show disconnected state
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async (key: keyof IntegrationsStatus) => {
    if (!authToken) return;
    setConnecting(key);
    try {
      const res = await fetch(`${API_BASE}/integrations/${key}/auth`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const { url } = (await res.json()) as { url: string };
      await Linking.openURL(url);
      // After returning from OAuth, re-fetch status
      setTimeout(() => { void fetchStatus(); }, 2000);
    } catch {
      // Error opening URL
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (key: keyof IntegrationsStatus) => {
    if (!authToken) return;
    setConnecting(key);
    try {
      await fetch(`${API_BASE}/integrations/${key}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      await fetchStatus();
    } catch {
      // Error disconnecting
    } finally {
      setConnecting(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Integrations</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Connect your tools to give Lyfestack more context and automate more of your workflow.
        </Text>

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={styles.loader} />
        ) : (
          INTEGRATIONS.map((integration) => {
            const isConnected = status?.[integration.key]?.connected ?? false;
            const isBusy = connecting === integration.key;

            return (
              <View key={integration.key} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.icon}>{integration.icon}</Text>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{integration.name}</Text>
                    <Text
                      style={[
                        styles.cardStatus,
                        { color: isConnected ? Colors.accent : DarkTheme.text.secondary },
                      ]}
                    >
                      {isConnected ? 'Connected' : 'Not connected'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardDescription}>{integration.description}</Text>

                <TouchableOpacity
                  style={[styles.actionBtn, isConnected && styles.disconnectBtn]}
                  onPress={() =>
                    isConnected
                      ? handleDisconnect(integration.key)
                      : handleConnect(integration.key)
                  }
                  disabled={isBusy}
                  activeOpacity={0.7}
                >
                  {isBusy ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={[styles.actionBtnText, isConnected && styles.disconnectBtnText]}>
                      {isConnected ? 'Disconnect' : 'Connect'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <View style={styles.footer}>
          <Text style={styles.footerNote}>
            More integrations coming soon: Notion, Todoist, Apple Health, and more.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DarkTheme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  backBtn: { padding: 4 },
  backArrow: { ...TextStyles.h2, color: DarkTheme.text.primary, lineHeight: 28 },
  heading: { ...TextStyles.h2, color: DarkTheme.text.primary },
  scroll: { flex: 1, paddingHorizontal: Spacing.xl },
  subtitle: {
    ...TextStyles.body,
    color: DarkTheme.text.secondary,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  loader: { marginTop: Spacing.xl },
  card: {
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: { fontSize: 28 },
  cardInfo: { flex: 1 },
  cardName: { ...TextStyles.bodyMedium, color: DarkTheme.text.primary },
  cardStatus: { ...TextStyles.small, marginTop: 2 },
  cardDescription: { ...TextStyles.small, color: DarkTheme.text.secondary, lineHeight: 20 },
  actionBtn: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionBtnText: { ...TextStyles.bodyMedium, color: Colors.white },
  disconnectBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: DarkTheme.border },
  disconnectBtnText: { color: DarkTheme.text.secondary },
  footer: { paddingVertical: Spacing.xl },
  footerNote: { ...TextStyles.caption, color: DarkTheme.text.secondary, textAlign: 'center' },
});
