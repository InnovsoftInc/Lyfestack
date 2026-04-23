import { View, Text, StyleSheet } from 'react-native';
import { Spacing } from '../theme';
import type { Theme } from '../theme';

interface Props {
  level: 'soft' | 'hard';
  theme: Theme;
}

const COPY: Record<'soft' | 'hard', { icon: string; title: string; body: string }> = {
  soft: {
    icon: '⚠️',
    title: 'Context filling up',
    body: 'You\u2019re past 80% of this session\u2019s context window. Consider starting a new session soon.',
  },
  hard: {
    icon: '🛑',
    title: 'Context nearly full',
    body: 'Past 95% — the next turn will likely trigger auto-compaction and older messages will be summarized.',
  },
};

export function ContextWarningBanner({ level, theme }: Props) {
  const meta = COPY[level];
  const color = level === 'hard' ? theme.error : theme.warning;
  return (
    <View style={[styles.wrap, { backgroundColor: color + '18', borderColor: color + '55' }]}>
      <Text style={styles.icon}>{meta.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color }]}>{meta.title}</Text>
        <Text style={[styles.body, { color: theme.text.secondary }]}>{meta.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { fontSize: 16, marginTop: 1 },
  title: { fontSize: 12, fontWeight: '700' },
  body: { fontSize: 11, lineHeight: 15, marginTop: 1 },
});
