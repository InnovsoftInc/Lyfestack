import React from 'react';
import {
  Platform, StyleSheet, View, type StyleProp, type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import type { Theme } from '../../theme';

type LiquidSurfaceProps = {
  theme: Theme;
  isDark?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  borderRadius?: number;
  intensity?: number;
  shadow?: boolean;
  reflection?: boolean;
  blur?: boolean;
};

export function LiquidSurface({
  theme,
  isDark = true,
  children,
  style,
  contentStyle,
  borderRadius = 24,
  intensity = 52,
  shadow = true,
  reflection = true,
  blur = true,
}: LiquidSurfaceProps) {
  const overlayColor = reflection
    ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)')
    : theme.surface;
  const borderColor = reflection
    ? (isDark ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.72)')
    : theme.border;
  const highlightColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.8)';

  return (
    <View
      style={[
        styles.base,
        {
          borderRadius,
          borderColor,
          ...(shadow ? styles.shadow : null),
        },
        style,
      ]}
    >
      {blur && Platform.OS === 'ios' ? (
        <BlurView intensity={intensity} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />
      {reflection ? (
        <>
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: highlightColor,
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.topGlow,
              {
                borderTopLeftRadius: borderRadius,
                borderTopRightRadius: borderRadius,
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.38)',
              },
            ]}
          />
        </>
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    position: 'relative',
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '46%',
  },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
});
