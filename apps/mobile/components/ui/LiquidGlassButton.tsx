import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

type Props = {
  onPress: () => void;
  icon?: string;
  size?: number;
  /** Use isDark to pick tint — defaults to true */
  isDark?: boolean;
  hitSlop?: number;
  activeOpacity?: number;
  iconSize?: number;
  reflection?: boolean;
  blur?: boolean;
  children?: React.ReactNode;
};

/**
 * Circular semi-transparent "liquid glass" button (iOS 26 style).
 * Uses BlurView on iOS for the frosted-glass fill; falls back to a flat
 * translucent circle on Android.
 */
export function LiquidGlassButton({
  onPress,
  icon,
  size = 38,
  isDark = true,
  hitSlop = 10,
  activeOpacity = 0.65,
  iconSize,
  reflection = true,
  blur = true,
  children,
}: Props) {
  const radius = size / 2;
  const blurTint = isDark ? 'dark' : 'light';
  const overlayColor = reflection
    ? (isDark ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.07)')
    : (isDark ? 'rgba(20,22,30,0.92)' : 'rgba(248,250,252,0.94)');
  const borderColor = reflection
    ? (isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.14)')
    : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.12)');
  const iconColor = isDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.72)';
  const resolvedIconSize = iconSize ?? size * 0.42;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={activeOpacity}
      hitSlop={hitSlop}
      style={[styles.btn, { width: size, height: size, borderRadius: radius, borderColor }]}
    >
      {blur && Platform.OS === 'ios' ? (
        <BlurView
          intensity={48}
          tint={blurTint}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, backgroundColor: overlayColor },
        ]}
      />
      {children ?? (
        <Text
          style={[styles.icon, { color: iconColor, fontSize: resolvedIconSize }]}
          allowFontScaling={false}
        >
          {icon}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  icon: {
    fontWeight: '500',
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: undefined,
  },
});
