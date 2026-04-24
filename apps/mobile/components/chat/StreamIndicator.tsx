import { View, Text, ActivityIndicator } from 'react-native';
import type { Theme } from '../../theme';

export function ToolPill({ label, active, theme }: { label: string; active?: boolean; theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 1.5 }}>
      <Text style={{ color: active ? theme.accent : theme.text.secondary, fontSize: 8, lineHeight: 12 }}>{active ? '●' : '✓'}</Text>
      <Text style={{ color: active ? theme.accent : theme.text.secondary, fontSize: 12, fontWeight: active ? '600' : '400' }}>{label}</Text>
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
  return (
    <View style={{ marginBottom: 6, gap: 0 }}>
      {unique.map((tool, i) => (
        <ToolPill key={`${tool}-${i}`} label={tool} active={currentTool === tool} theme={theme} />
      ))}
    </View>
  );
}

export function StreamIndicator({ theme }: { theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}>
      <ActivityIndicator size="small" color={theme.text.secondary} />
      <Text style={{ color: theme.text.secondary, fontSize: 13 }}>thinking...</Text>
    </View>
  );
}
