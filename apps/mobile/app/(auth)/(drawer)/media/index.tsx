import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useTheme } from '../../../../hooks/useTheme';
import type { Theme } from '../../../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../../../theme';
import { Colors } from '@lyfestack/shared';
import { mediaApi, type MediaItem, type MediaSource } from '../../../../services/openclaw-extras.api';
import { getApiBase, getAuthToken } from '../../../../services/api';

const TABS: Array<{ key: 'all' | MediaSource; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'browser', label: 'Browser' },
  { key: 'inbound', label: 'Inbound' },
  { key: 'other', label: 'Other' },
];

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { padding: Spacing.xl, paddingBottom: Spacing.md },
    heading: { ...TextStyles.h1, color: theme.text.primary },
    sub: { ...TextStyles.small, color: theme.text.secondary, marginTop: 4 },
    tabs: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: Spacing.sm, marginBottom: Spacing.md },
    tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.md, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
    tabActive: { backgroundColor: Colors.accent + '22', borderColor: Colors.accent },
    tabLabel: { ...TextStyles.small, color: theme.text.secondary, fontWeight: '600' },
    tabLabelActive: { color: Colors.accent },
    grid: { padding: Spacing.md },
    cell: { flex: 1 / 3, padding: 4 },
    thumb: { aspectRatio: 1, borderRadius: BorderRadius.md, overflow: 'hidden', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
    thumbImage: { width: '100%', height: '100%' },
    thumbLabel: { ...TextStyles.caption, color: theme.text.secondary, marginTop: 4 },
    thumbName: { ...TextStyles.caption, color: theme.text.primary, marginTop: 2 },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
    placeholderText: { ...TextStyles.caption, color: theme.text.secondary, textAlign: 'center' },
    empty: { padding: Spacing.xl, alignItems: 'center' },
    emptyText: { ...TextStyles.body, color: theme.text.secondary, textAlign: 'center' },
  });
}

function MediaTile({ item, theme, authHeader, base }: { item: MediaItem; theme: Theme; authHeader?: string; base: string }) {
  const styles = makeStyles(theme);
  const isImage = item.mimeType.startsWith('image/');
  const url = `${base}${item.url}`;
  return (
    <TouchableOpacity style={styles.cell} activeOpacity={0.7} onPress={() => router.push(`/(auth)/(drawer)/media/${encodeURIComponent(item.id)}` as any)}>
      <View style={styles.thumb}>
        {isImage ? (
          <Image source={authHeader ? { uri: url, headers: { Authorization: authHeader } } : { uri: url }} style={styles.thumbImage} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>{item.mimeType}</Text>
          </View>
        )}
      </View>
      <Text style={styles.thumbName} numberOfLines={1}>{item.filename}</Text>
      <Text style={styles.thumbLabel}>{(item.size / 1024).toFixed(1)} KB</Text>
    </TouchableOpacity>
  );
}

export default function MediaScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [tab, setTab] = useState<'all' | MediaSource>('all');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [base, setBase] = useState<string>('');
  const [authHeader, setAuthHeader] = useState<string | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      setBase(await getApiBase());
      const tok = await getAuthToken();
      if (tok) setAuthHeader(`Bearer ${tok}`);
    })();
  }, []);

  const load = useCallback(async (reset = false) => {
    try {
      const page = await mediaApi.list({
        ...(tab !== 'all' ? { source: tab } : {}),
        ...(reset ? {} : cursor ? { cursor } : {}),
      });
      setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
      setCursor(page.nextCursor);
    } catch {
      // best-effort
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, cursor]);

  useEffect(() => {
    setLoading(true);
    setItems([]);
    setCursor(undefined);
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const onRefresh = () => { setRefreshing(true); setCursor(undefined); void load(true); };

  const dataMemo = useMemo(() => items, [items]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>🖼️ Media</Text>
        <Text style={styles.sub}>Browser captures + inbound files from ~/.openclaw/media/</Text>
      </View>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]} activeOpacity={0.7}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.xl }} />
      ) : (
        <FlatList
          data={dataMemo}
          keyExtractor={(it) => it.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => <MediaTile item={item} theme={theme} {...(authHeader ? { authHeader } : {})} base={base} />}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No media in this bucket.</Text></View>}
          onEndReached={() => { if (cursor) void load(false); }}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        />
      )}
    </SafeAreaView>
  );
}
