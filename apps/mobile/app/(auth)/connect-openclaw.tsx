import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { DarkTheme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';
import { useOpenClawStore } from '../../stores/openclaw.store';
import * as api from '../../services/openclaw.api';

type TestState = 'idle' | 'testing' | 'success' | 'failure';

export default function ConnectOpenClawScreen() {
  const { connect } = useOpenClawStore();

  const [ip, setIp] = useState('localhost');
  const [port, setPort] = useState('3000');
  const [testState, setTestState] = useState<TestState>('idle');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const handleTest = async () => {
    setTestState('testing');
    const ok = await api.connectToLocal(ip.trim(), Number(port));
    setTestState(ok ? 'success' : 'failure');
  };

  const handleDiscover = async () => {
    setIsDiscovering(true);
    setTestState('idle');
    const found = await api.discoverLocal();
    setIsDiscovering(false);
    if (found) {
      setIp(found.ip);
      setPort(String(found.port));
      setTestState('success');
    } else {
      setTestState('failure');
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    const ok = await connect(ip.trim(), Number(port));
    setIsConnecting(false);
    if (ok) {
      router.replace('/(auth)/(tabs)/agents');
    }
  };

  const testColor =
    testState === 'success' ? Colors.success : testState === 'failure' ? Colors.error : Colors.accent;

  const testIcon =
    testState === 'success' ? '✓' : testState === 'failure' ? '✗' : '';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerIcon}>🔗</Text>
            <Text style={styles.title}>Connect to OpenClaw</Text>
            <Text style={styles.subtitle}>
              Link your phone to the OpenClaw running on your Mac to manage agents and send tasks.
            </Text>
          </View>

          {/* Auto-discover */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AUTO-DISCOVER</Text>
            <TouchableOpacity
              style={styles.discoverBtn}
              onPress={handleDiscover}
              disabled={isDiscovering}
              activeOpacity={0.8}
            >
              {isDiscovering ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Text style={styles.discoverIcon}>📡</Text>
              )}
              <View style={styles.discoverText}>
                <Text style={styles.discoverTitle}>Scan local network</Text>
                <Text style={styles.discoverSubtitle}>Try common ports on localhost</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Manual entry */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MANUAL ENTRY</Text>
            <View style={styles.manualRow}>
              <View style={styles.ipField}>
                <Text style={styles.label}>Server IP or hostname</Text>
                <TextInput
                  style={styles.input}
                  value={ip}
                  onChangeText={setIp}
                  placeholder="localhost or 192.168.1.x"
                  placeholderTextColor={DarkTheme.text.secondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
              <View style={styles.portField}>
                <Text style={styles.label}>Port</Text>
                <TextInput
                  style={styles.input}
                  value={port}
                  onChangeText={setPort}
                  placeholder="3000"
                  placeholderTextColor={DarkTheme.text.secondary}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.testBtn}
              onPress={handleTest}
              disabled={testState === 'testing'}
              activeOpacity={0.8}
            >
              {testState === 'testing' ? (
                <ActivityIndicator size="small" color={testColor} />
              ) : (
                <Text style={[styles.testBtnText, { color: testColor }]}>
                  {testIcon} Test connection
                </Text>
              )}
            </TouchableOpacity>

            {testState === 'success' && (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>Connection successful! OpenClaw is reachable.</Text>
              </View>
            )}
            {testState === 'failure' && (
              <View style={styles.failureBanner}>
                <Text style={styles.failureText}>
                  Could not reach OpenClaw. Make sure the Lyfestack server is running and the gateway is up.
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.connectBtn, isConnecting && styles.connectBtnDisabled]}
            onPress={handleConnect}
            disabled={isConnecting}
            activeOpacity={0.8}
          >
            {isConnecting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.connectBtnText}>Connect & Open Agents</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DarkTheme.background },
  flex: { flex: 1 },
  scrollContent: { padding: Spacing.xl, gap: Spacing.xl },
  header: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
  headerIcon: { fontSize: 48 },
  title: { ...TextStyles.h2, color: DarkTheme.text.primary, textAlign: 'center' },
  subtitle: {
    ...TextStyles.body,
    color: DarkTheme.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  section: { gap: Spacing.md },
  sectionTitle: {
    ...TextStyles.caption,
    color: DarkTheme.text.secondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  discoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    padding: Spacing.md,
  },
  discoverIcon: { fontSize: 24 },
  discoverText: { gap: 2 },
  discoverTitle: { ...TextStyles.bodyMedium, color: DarkTheme.text.primary },
  discoverSubtitle: { ...TextStyles.caption, color: DarkTheme.text.secondary },
  manualRow: { flexDirection: 'row', gap: Spacing.md },
  ipField: { flex: 2, gap: Spacing.xs },
  portField: { flex: 1, gap: Spacing.xs },
  label: { ...TextStyles.small, color: DarkTheme.text.secondary },
  input: {
    ...TextStyles.body,
    color: DarkTheme.text.primary,
    backgroundColor: DarkTheme.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  testBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: DarkTheme.border,
  },
  testBtnText: { ...TextStyles.bodyMedium },
  successBanner: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  successText: { ...TextStyles.small, color: Colors.success },
  failureBanner: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  failureText: { ...TextStyles.small, color: Colors.error, lineHeight: 20 },
  connectBtn: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  connectBtnDisabled: { opacity: 0.5 },
  connectBtnText: { ...TextStyles.bodyMedium, color: Colors.white, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  skipText: { ...TextStyles.small, color: DarkTheme.text.secondary },
});
