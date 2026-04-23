import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRef, useState } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { startRealtime, type RealtimeConnection } from '../../../../services/realtime.client';

const SYSTEM_INSTRUCTIONS = `You are the OpenClaw remote console. Speak briefly. Confirm any destructive action (toggle, run, delete) before doing it. When the user asks for status, summarize in one or two short sentences.`;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { padding: Spacing.xl, paddingBottom: Spacing.md },
    heading: { ...TextStyles.h1, color: theme.text.primary },
    sub: { ...TextStyles.small, color: theme.text.secondary, marginTop: 4 },
    main: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.xl },
    mic: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent + '22', borderWidth: 2, borderColor: Colors.accent },
    micActive: { backgroundColor: Colors.error + '22', borderColor: Colors.error },
    micEmoji: { fontSize: 64 },
    status: { ...TextStyles.bodyMedium, color: theme.text.primary, textAlign: 'center' },
    statusSub: { ...TextStyles.caption, color: theme.text.secondary, textAlign: 'center', maxWidth: 320 },
    transcript: { width: '100%', backgroundColor: theme.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: theme.border, padding: Spacing.md, maxHeight: 200 },
    transcriptText: { ...TextStyles.body, color: theme.text.primary, lineHeight: 22 },
    devNote: { ...TextStyles.caption, color: theme.text.secondary, textAlign: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, fontStyle: 'italic' },
  });
}

export default function RealtimeScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [connecting, setConnecting] = useState(false);
  const [active, setActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const connRef = useRef<RealtimeConnection | null>(null);

  const start = async () => {
    if (active || connecting) return;
    setConnecting(true);
    setTranscript('');
    try {
      const conn = await startRealtime({
        instructions: SYSTEM_INSTRUCTIONS,
        onTranscript: (text) => setTranscript((prev) => prev + text),
        onClose: () => { setActive(false); connRef.current = null; },
        onError: (err) => Alert.alert('Realtime error', err.message),
      });
      connRef.current = conn;
      setActive(true);
    } catch (err: any) {
      Alert.alert('Could not start Realtime', err?.message ?? 'unknown');
    } finally {
      setConnecting(false);
    }
  };

  const stop = () => {
    connRef.current?.close();
    connRef.current = null;
    setActive(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>🎙 Realtime</Text>
        <Text style={styles.sub}>Hold-free voice console powered by gpt-4o-realtime. Tap the mic to talk.</Text>
      </View>
      <View style={styles.main}>
        <TouchableOpacity style={[styles.mic, active && styles.micActive]} onPress={active ? stop : start} disabled={connecting} activeOpacity={0.8}>
          <Text style={styles.micEmoji}>{active ? '⏹' : '🎙'}</Text>
        </TouchableOpacity>
        <Text style={styles.status}>{connecting ? 'Connecting…' : active ? 'Listening — tap to stop' : 'Tap the mic to start'}</Text>
        <Text style={styles.statusSub}>OpenClaw control over voice. Mention what you want and the model will call the right tools.</Text>
        {transcript ? (
          <ScrollView style={styles.transcript}>
            <Text style={styles.transcriptText}>{transcript}</Text>
          </ScrollView>
        ) : null}
      </View>
      <Text style={styles.devNote}>Realtime audio requires the dev-client build (run `npx expo prebuild` then rebuild). Expo Go cannot load WebRTC.</Text>
    </SafeAreaView>
  );
}
