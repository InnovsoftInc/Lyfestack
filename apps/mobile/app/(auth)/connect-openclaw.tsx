import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@lyfestack_openclaw_connection';
const COMMON_PORTS = [3000, 8080, 4000];

export default function ConnectOpenClawScreen() {
  const router = useRouter();
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('3000');
  const [status, setStatus] = useState<'idle' | 'scanning' | 'testing' | 'connected' | 'failed'>('idle');
  const [foundIp, setFoundIp] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSaved();
  }, []);

  const loadSaved = async () => {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) {
      const { ip: savedIp, port: savedPort } = JSON.parse(saved);
      setIp(savedIp);
      setPort(savedPort);
    }
  };

  const testConnection = async (testIp: string, testPort: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`http://${testIp}:${testPort}/api/openclaw/status`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        return data.data?.running === true || data.data?.agentCount >= 0;
      }
      return false;
    } catch {
      return false;
    }
  };

  const autoDiscover = async () => {
    setStatus('scanning');
    setError('');
    setFoundIp(null);

    // Try common local network patterns
    const subnet = '192.168.1';
    const candidates = [
      `${subnet}.1`, `${subnet}.2`, `${subnet}.100`, `${subnet}.142`,
      `${subnet}.10`, `${subnet}.50`, `${subnet}.200`,
      '10.0.0.1', '10.0.1.1', 'localhost',
    ];

    for (const candidate of candidates) {
      for (const p of COMMON_PORTS) {
        const found = await testConnection(candidate, String(p));
        if (found) {
          setFoundIp(candidate);
          setIp(candidate);
          setPort(String(p));
          setStatus('connected');
          await saveConnection(candidate, String(p));
          return;
        }
      }
    }

    setStatus('failed');
    setError('Could not find Lyfestack server on your network. Try entering the IP manually.');
  };

  const manualConnect = async () => {
    if (!ip.trim()) return;
    setStatus('testing');
    setError('');

    const found = await testConnection(ip.trim(), port);
    if (found) {
      setStatus('connected');
      await saveConnection(ip.trim(), port);
    } else {
      setStatus('failed');
      setError(`Could not connect to ${ip}:${port}. Make sure the server is running.`);
    }
  };

  const saveConnection = async (savedIp: string, savedPort: string) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ip: savedIp, port: savedPort }));
    // Update the API base URL globally
    await AsyncStorage.setItem('@lyfestack_api_base', `http://${savedIp}:${savedPort}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect to your Mac</Text>
      <Text style={styles.subtitle}>Link Lyfestack to your local OpenClaw instance</Text>

      {/* Auto discover */}
      <TouchableOpacity
        style={[styles.autoBtn, status === 'scanning' && styles.autoBtnScanning]}
        onPress={autoDiscover}
        disabled={status === 'scanning'}
      >
        {status === 'scanning' ? (
          <ActivityIndicator color="#000" size="small" />
        ) : (
          <Text style={styles.autoBtnText}>Auto-discover on network</Text>
        )}
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>or enter manually</Text>
        <View style={styles.line} />
      </View>

      {/* Manual entry */}
      <Text style={styles.label}>IP Address</Text>
      <TextInput
        style={styles.input}
        value={ip}
        onChangeText={setIp}
        placeholder="192.168.1.142"
        placeholderTextColor="#444"
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Port</Text>
      <TextInput
        style={styles.input}
        value={port}
        onChangeText={setPort}
        placeholder="3000"
        placeholderTextColor="#444"
        keyboardType="number-pad"
      />

      <TouchableOpacity
        style={[styles.connectBtn, status === 'testing' && styles.connectBtnDisabled]}
        onPress={manualConnect}
        disabled={status === 'testing' || !ip.trim()}
      >
        {status === 'testing' ? (
          <ActivityIndicator color="#000" size="small" />
        ) : (
          <Text style={styles.connectBtnText}>Test Connection</Text>
        )}
      </TouchableOpacity>

      {/* Status feedback */}
      {status === 'connected' && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>Connected to {ip}:{port}</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Help text */}
      <View style={styles.helpBox}>
        <Text style={styles.helpTitle}>How to start the server on your Mac:</Text>
        <Text style={styles.helpCode}>cd ~/Documents/BusinessIdeas/Lyfestack/apps/server{'\n'}npm run dev</Text>
        <Text style={styles.helpNote}>Make sure your phone and Mac are on the same Wi-Fi network.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 16 },
  title: { color: '#EDEDED', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#666', fontSize: 14, marginBottom: 24 },
  autoBtn: { backgroundColor: '#0EA5E9', padding: 16, borderRadius: 12, alignItems: 'center' },
  autoBtnScanning: { backgroundColor: '#0c87c4' },
  autoBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  line: { flex: 1, height: 1, backgroundColor: '#222' },
  or: { color: '#555', fontSize: 12, marginHorizontal: 12 },
  label: { color: '#888', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#111', borderRadius: 10, padding: 14, color: '#EDEDED', fontSize: 16, borderWidth: 1, borderColor: '#222', fontFamily: 'monospace' },
  connectBtn: { marginTop: 16, backgroundColor: '#1a1a1a', padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  connectBtnDisabled: { borderColor: '#222' },
  connectBtnText: { color: '#EDEDED', fontSize: 15, fontWeight: '600' },
  successBox: { marginTop: 20, backgroundColor: '#0a1f0a', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#22C55E', alignItems: 'center' },
  successText: { color: '#22C55E', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  doneBtn: { backgroundColor: '#22C55E', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  doneBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  errorText: { color: '#EF4444', fontSize: 13, marginTop: 12 },
  helpBox: { marginTop: 32, backgroundColor: '#0a0a0a', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1a1a1a' },
  helpTitle: { color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  helpCode: { color: '#0EA5E9', fontSize: 13, fontFamily: 'monospace', backgroundColor: '#111', padding: 10, borderRadius: 6, marginBottom: 8, lineHeight: 20 },
  helpNote: { color: '#555', fontSize: 12 },
});
