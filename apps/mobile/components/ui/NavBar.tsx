import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../theme';

interface NavBarProps {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function NavBar({ title, onBack, right }: NavBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { borderBottomColor: theme.border, paddingTop: insets.top + Spacing.sm }]}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack ?? (() => router.back())}
        hitSlop={12}
        activeOpacity={0.6}
      >
        <Text style={[styles.backIcon, { color: theme.accent }]}>‹</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.right}>
        {right ?? null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  backIcon: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '300',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  right: {
    width: 40,
    alignItems: 'flex-end',
  },
});
