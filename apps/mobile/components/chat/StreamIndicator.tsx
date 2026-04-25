import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import type { Theme } from '../../theme';

export function ToolPill({ label, active, theme }: { label: string; active?: boolean; theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 1.5 }}>
      <Text style={{ color: active ? theme.accent : theme.text.secondary, fontSize: 8, lineHeight: 12 }}>{active ? '●' : '✓'}</Text>
      <Text style={{ color: active ? theme.accent : theme.text.secondary, fontSize: 12, fontWeight: active ? '600' : '400' }}>{label}</Text>
    </View>
  );
}

function StatusBubble({ title, theme, children }: { title: string; theme: Theme; children?: React.ReactNode }) {
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth: '88%', marginBottom: 10 }}>
      <View style={{ backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(15,23,42,0.08)', borderRadius: 20, borderBottomLeftRadius: 8, paddingHorizontal: 14, paddingVertical: 11, shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: children ? 6 : 0 }}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={{ color: theme.text.primary, fontSize: 13, fontWeight: '600' }}>{title}</Text>
        </View>
        {children}
      </View>
    </View>
  );
}

export function ToolActivityList({ tools, currentTool, theme }: { tools: string[]; currentTool?: string | null; theme: Theme }) {
  if (!tools.length && !currentTool) return null;
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of tools) {
    if (!seen.has(t)) { seen.add(t); unique.push(t); }
  }
  if (currentTool && !seen.has(currentTool)) {
    unique.push(currentTool);
  }
  const statusTitle = currentTool
    ? (currentTool === 'checking context'
      ? 'Checking your request'
      : currentTool === 'reconnecting...'
        ? 'Reconnecting the run'
        : `Working on ${currentTool}`)
    : 'Working';
  return (
    <StatusBubble title={statusTitle} theme={theme}>
      {unique.length > 0 ? (
        <View style={{ gap: 3 }}>
          {unique.map((tool, i) => (
            <ToolPill key={`${tool}-${i}`} label={tool} active={currentTool === tool} theme={theme} />
          ))}
        </View>
      ) : null}
    </StatusBubble>
  );
}

export function StreamIndicator({ theme }: { theme: Theme }) {
  return (
    <StatusBubble title="Thinking through it" theme={theme} />
  );
}
