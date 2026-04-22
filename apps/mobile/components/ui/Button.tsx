import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import type { Theme } from '../../theme/colors';
import { TextStyles, Spacing, BorderRadius } from '../../theme';
import { Colors } from '@lyfestack/shared';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: BorderRadius.md,
    },
    fullWidth: { width: '100%' },
    primary: { backgroundColor: Colors.accent },
    secondary: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: Colors.error },
    disabled: { opacity: 0.45 },
    size_sm: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md },
    size_md: { paddingVertical: 10, paddingHorizontal: Spacing.lg },
    size_lg: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl },
    label: { ...TextStyles.button },
    label_primary: { color: Colors.white },
    label_secondary: { color: theme.text.primary },
    label_ghost: { color: Colors.accent },
    label_danger: { color: Colors.white },
    labelSize_sm: { fontSize: 13 },
    labelSize_md: {},
    labelSize_lg: { fontSize: 18 },
  });
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  style,
  fullWidth,
}: ButtonProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        (disabled || loading) && styles.disabled,
        fullWidth && styles.fullWidth,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? Colors.white : Colors.accent}
          size="small"
        />
      ) : (
        <Text style={[styles.label, styles[`label_${variant}`], styles[`labelSize_${size}`]]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
