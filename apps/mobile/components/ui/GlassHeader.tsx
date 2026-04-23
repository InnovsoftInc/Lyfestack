import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useThemeStore } from '../../stores/theme.store';
import { Spacing, TextStyles } from '../../theme';

type LeftKind = 'back' | 'menu' | 'none';

interface GlassHeaderProps {
  title?: string;
  subtitle?: string;
  leftKind?: LeftKind;
  onLeftPress?: () => void;
  right?: React.ReactNode;
  floating?: boolean;
  transparent?: boolean;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GlassHeader({
  title,
  subtitle,
  leftKind = 'back',
  onLeftPress,
  right,
  floating = true,
  transparent = false,
  large = false,
  style,
}: GlassHeaderProps) {
  const theme = useTheme();
  const isDark = useThemeStore((s) => s.isDark);
  const insets = useSafeAreaInsets();

  const blurTint = isDark ? 'dark' : 'light';
  const tintOverlay = isDark ? 'rgba(10,10,12,0.55)' : 'rgba(255,255,255,0.7)';
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const leftGlyph = leftKind === 'back' ? '‹' : leftKind === 'menu' ? '☰' : null;

  const content = (
    <View
      style={[
        styles.bar,
        { paddingTop: insets.top + Spacing.sm, borderBottomColor: borderColor },
        large && styles.barLarge,
      ]}
    >
      <View style={styles.side}>
        {leftGlyph ? (
          <TouchableOpacity
            onPress={onLeftPress ?? (() => router.back())}
            hitSlop={12}
            activeOpacity={0.6}
            style={styles.leftBtn}
          >
            <Text
              style={[
                leftKind === 'back' ? styles.backIcon : styles.menuIcon,
                { color: leftKind === 'back' ? theme.accent : theme.text.primary },
              ]}
            >
              {leftGlyph}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.center} pointerEvents="box-none">
        {title ? (
          <Text
            style={[
              large ? styles.titleLarge : styles.title,
              { color: theme.text.primary },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.text.secondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.side}>{right ?? null}</View>
    </View>
  );

  if (transparent) {
    return <View style={[floating ? styles.floating : null, style]}>{content}</View>;
  }

  const canBlur = Platform.OS === 'ios';

  return (
    <View style={[floating ? styles.floating : null, style]}>
      {canBlur ? (
        <BlurView intensity={60} tint={blurTint} style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tintOverlay }]} />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  floating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    overflow: 'hidden',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  barLarge: {
    paddingBottom: Spacing.md,
  },
  side: {
    width: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftBtn: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '300',
  },
  menuIcon: {
    fontSize: 22,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...TextStyles.bodyMedium,
    fontWeight: '600',
    fontSize: 17,
  },
  titleLarge: {
    ...TextStyles.h2,
    fontWeight: '700',
  },
  subtitle: {
    ...TextStyles.caption,
    marginTop: 1,
  },
});

export function headerSpacerHeight(topInset: number, large = false) {
  return topInset + (large ? 64 : 50);
}
