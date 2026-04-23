import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Theme } from '../theme';

interface Props {
  used: number;
  contextWindow: number;
  compactionCount?: number;
  theme: Theme;
  onPress?: () => void;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

export function ContextUsageBadge({ used, contextWindow, compactionCount, theme, onPress }: Props) {
  if (!contextWindow || contextWindow <= 0) return null;
  const pct = Math.max(0, Math.min(100, (used / contextWindow) * 100));
  const color = pct >= 90 ? theme.error : pct >= 70 ? theme.warning : theme.success;
  const Wrapper: any = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      {...(onPress ? { onPress, activeOpacity: 0.7, hitSlop: 6 } : {})}
      style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.surface }]}
    >
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.text.secondary }]}>
          {formatTokens(used)} / {formatTokens(contextWindow)}
        </Text>
        {compactionCount ? (
          <Text style={[styles.compact, { color: theme.text.secondary }]}>·{compactionCount}↻</Text>
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: theme.border + '60' }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 96,
    gap: 3,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 10, fontWeight: '600' },
  compact: { fontSize: 9, opacity: 0.7 },
  track: { height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
});
