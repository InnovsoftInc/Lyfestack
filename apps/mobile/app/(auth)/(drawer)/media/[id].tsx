import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { mediaApi, type MediaItem } from '../../../../services/openclaw-extras.api';
import { openaiApi } from '../../../../services/openai.api';
import { getApiBase, getAuthToken } from '../../../../services/api';

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.xl, gap: Spacing.md },
    backArrow: { ...TextStyles.h2, color: theme.text.primary, lineHeight: 28 },
    title: { ...TextStyles.h3, color: theme.text.primary, flex: 1 },
    body: { padding: Spacing.xl, gap: Spacing.md },
    card: { backgroundColor: theme.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: theme.border, padding: Spacing.md },
    image: { width: '100%', aspectRatio: 1, borderRadius: BorderRadius.md, backgroundColor: theme.background },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    metaLabel: { ...TextStyles.caption, color: theme.text.secondary },
    metaValue: { ...TextStyles.caption, color: theme.text.primary },
    actions: { flexDirection: 'row', gap: Spacing.sm },
    actionBtn: { flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
    actionBtnPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
    actionLabel: { ...TextStyles.bodyMedium, color: theme.text.primary },
    actionLabelPrimary: { color: Colors.white },
  });
}

export default function MediaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [item, setItem] = useState<MediaItem | null>(null);
  const [base, setBase] = useState('');
  const [authHeader, setAuthHeader] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    void (async () => {
      setBase(await getApiBase());
      const tok = await getAuthToken();
      if (tok) setAuthHeader(`Bearer ${tok}`);
    })();
  }, []);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const decoded = decodeURIComponent(id as string);
        const it = await mediaApi.get(decoded);
        setItem(it);
      } catch (err: any) {
        Alert.alert('Failed', err?.message ?? 'Could not load media');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading || !item) return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>Loading…</Text>
      </View>
      <ActivityIndicator color={Colors.accent} />
    </SafeAreaView>
  );

  const url = `${base}${item.url}`;
  const isImage = item.mimeType.startsWith('image/');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backArrow}>‹</Text></TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{item.filename}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          {isImage ? (
            <Image source={authHeader ? { uri: url, headers: { Authorization: authHeader } } : { uri: url }} style={styles.image} resizeMode="contain" />
          ) : (
            <Text style={{ color: theme.text.secondary }}>Preview not available for {item.mimeType}</Text>
          )}
          <View style={styles.metaRow}><Text style={styles.metaLabel}>Source</Text><Text style={styles.metaValue}>{item.source}</Text></View>
          <View style={styles.metaRow}><Text style={styles.metaLabel}>Type</Text><Text style={styles.metaValue}>{item.mimeType}</Text></View>
          <View style={styles.metaRow}><Text style={styles.metaLabel}>Size</Text><Text style={styles.metaValue}>{(item.size / 1024).toFixed(1)} KB</Text></View>
          <View style={styles.metaRow}><Text style={styles.metaLabel}>Modified</Text><Text style={styles.metaValue}>{new Date(item.modifiedAt).toLocaleString()}</Text></View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary, analyzing && { opacity: 0.6 }]}
            activeOpacity={0.7}
            disabled={analyzing}
            onPress={async () => {
              setAnalyzing(true);
              setAnalysis(null);
              try {
                const result = await openaiApi.vision({ prompt: 'Describe this image in 2-3 sentences. Note any text, errors, or actionable items.', mediaId: item.id });
                setAnalysis(result.answer);
              } catch (err: any) {
                Alert.alert('Vision failed', err?.message ?? 'Could not analyze image.');
              } finally {
                setAnalyzing(false);
              }
            }}
          >
            <Text style={[styles.actionLabel, styles.actionLabelPrimary]}>{analyzing ? 'Analyzing…' : 'Ask GPT-4o'}</Text>
          </TouchableOpacity>
        </View>
        {analysis ? (
          <View style={[styles.card, { gap: 4 }]}>
            <Text style={styles.metaLabel}>Analysis</Text>
            <Text style={{ ...TextStyles.body, color: theme.text.primary }}>{analysis}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
