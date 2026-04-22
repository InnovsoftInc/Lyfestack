import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@lyfestack/shared';
import { TextStyles, Spacing, BorderRadius } from '../../theme';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  primary: { bg: 'rgba(14,165,233,0.15)', text: Colors.accent },
  success: { bg: 'rgba(34,197,94,0.15)', text: Colors.success },
  warning: { bg: 'rgba(245,158,11,0.15)', text: Colors.warning },
  error: { bg: 'rgba(239,68,68,0.15)', text: Colors.error },
  neutral: { bg: 'rgba(148,163,184,0.15)', text: Colors.gray400 },
};

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  const colors = variantColors[variant];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  label: {
    ...TextStyles.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
