import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme/colors';
import { Spacing, BorderRadius } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.surface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    padded: {
      padding: Spacing.md,
    },
    elevated: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
  });
}

export function Card({ children, style, padded = true, elevated }: CardProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={[styles.card, padded && styles.padded, elevated && styles.elevated, style]}>
      {children}
    </View>
  );
}
