import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { useOpenClawStore } from '../../../../stores/openclaw.store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetApiBase } from '../../../../services/openclaw.api';

const STORAGE_KEY = '@lyfestack_openclaw_connection';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { padding: Spacing.xl, paddingBottom: Spacing.md },
    backButton: { marginBottom: Spacing.md },
    backText: { ...TextStyles.bodyMedium, color: theme.text.secondary },
    heading: { ...TextStyles.h1, color: theme.text.primary },
    scroll: { flex: 1 },
    section: { marginBottom: Spacing.xl, paddingHorizontal: Spacing.xl },
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
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      minHeight: 52,
    },
    rowLabel: { ...TextStyles.bodyMedium, color: theme.text.primary },
    rowValue: { ...TextStyles.small, color: theme.text.secondary, maxWidth: '55%', textAlign: 'right' },
    rowValueMono: { fontFamily: 'monospace', fontSize: 12 },
    divider: { height: 1, backgroundColor: theme.border, marginLeft: Spacing.md },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.sm },
    statusRow: { flexDirection: 'row', alignItems: 'center' },
    actionBtn: {
      paddingVertical: 14,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionBtnPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
    actionBtnDanger: { borderColor: Colors.error },
    actionBtnText: { ...TextStyles.bodyMedium, color: theme.text.secondary },
    actionBtnTextPrimary: { color: Colors.white },
    actionBtnTextDanger: { color: Colors.error },
    actionsSection: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  });
}

const STATUS_COLOR: Record<string, string> = {
  connected: '#22C55E',
  connecting: '#F59E0B',
  disconnected: '#EF4444',
};

export default function OpenClawSettingsScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { connectionStatus, connectionUrl, connectionError, reconnect } = useOpenClawStore();

  const handleDisconnect = async () => {
    useOpenClawStore.getState().stopHeartbeat();
    await AsyncStorage.removeItem(STORAGE_KEY);
    resetApiBase();
    useOpenClawStore.setState({ connectionStatus: 'disconnected', connectionUrl: null, connectionError: null, agents: [] });
  };

  const statusLabel = connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>OpenClaw Settings</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONNECTION</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Status</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[connectionStatus] }]} />
                <Text style={styles.rowValue}>{statusLabel}</Text>
              </View>
            </View>

            {connectionUrl ? (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Server URL</Text>
                  <Text style={[styles.rowValue, styles.rowValueMono]}>{connectionUrl}</Text>
                </View>
              </>
            ) : null}

            {connectionError ? (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: Colors.error }]}>Error</Text>
                  <Text style={[styles.rowValue, { color: Colors.error }]}>{connectionError}</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => router.push('/(auth)/connect-openclaw')}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Change Connection</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={reconnect}
            disabled={connectionStatus === 'connecting'}
            activeOpacity={0.85}
          >
            {connectionStatus === 'connecting' ? (
              <ActivityIndicator color={theme.text.secondary} size="small" />
            ) : (
              <Text style={styles.actionBtnText}>Reconnect</Text>
            )}
          </TouchableOpacity>

          {connectionStatus === 'connected' ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={handleDisconnect}
              activeOpacity={0.85}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>Disconnect</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
