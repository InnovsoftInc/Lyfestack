import { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import type { Theme } from '../theme';
import { ProgressRing } from './ui';

interface Props {
  used: number;
  contextWindow: number;
  compactionCount?: number;
  theme: Theme;
  onPress?: () => void;
}

export function ContextUsageBadge({ used, contextWindow, compactionCount, theme, onPress }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const lastUsedRef = useRef(used);

  useEffect(() => {
    if (lastUsedRef.current === used) return;
    lastUsedRef.current = used;
    pulse.stopAnimation();
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pulse, used]);

  if (!contextWindow || contextWindow <= 0) return null;
  const progress = Math.max(0, Math.min(1, used / contextWindow));
  const pct = progress * 100;
  const color = pct >= 90 ? theme.error : pct >= 70 ? theme.warning : theme.success;
  const Wrapper: any = onPress ? TouchableOpacity : View;

  return (
    <Animated.View
      style={{
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }],
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] }),
      }}
    >
      <Wrapper
        {...(onPress ? { onPress, activeOpacity: 0.7, hitSlop: 6 } : {})}
        style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.surface }]}
      >
        <Animated.View
          style={{
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
          }}
        >
          <ProgressRing
            progress={progress}
            size={22}
            strokeWidth={2.5}
            color={color}
            trackColor={theme.border}
          >
            <View
              style={[
                styles.ringCore,
                { backgroundColor: compactionCount ? theme.accent + '20' : theme.background, borderColor: theme.border },
              ]}
            />
          </ProgressRing>
        </Animated.View>
      </Wrapper>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCore: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
