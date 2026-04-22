import React from 'react';
import { View } from 'react-native';
import { Colors } from '@lyfestack/shared';
import { DarkTheme } from '../../theme/colors';

interface ProgressRingProps {
  progress: number; // 0–1
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 6,
  color = Colors.accent,
  trackColor,
  children,
}: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const degrees = clamped * 360;
  const rightDeg = Math.min(degrees, 180);
  const leftDeg = Math.max(0, degrees - 180);
  const innerSize = size - strokeWidth * 2;
  const track = trackColor ?? DarkTheme.border;

  return (
    <View style={{ width: size, height: size }}>
      {/* Track circle */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: track,
        }}
      />

      {/* Right half — shows 0–180° of arc */}
      <View
        style={{
          position: 'absolute',
          width: size / 2,
          height: size,
          right: 0,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            right: 0,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: rightDeg > 0 ? color : 'transparent',
            transform: [{ rotate: `${rightDeg - 180}deg` }],
          }}
        />
      </View>

      {/* Left half — shows 180–360° of arc */}
      <View
        style={{
          position: 'absolute',
          width: size / 2,
          height: size,
          left: 0,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            left: 0,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: leftDeg > 0 ? color : 'transparent',
            transform: [{ rotate: `${leftDeg - 180}deg` }],
          }}
        />
      </View>

      {/* Inner circle (background + children) */}
      <View
        style={{
          position: 'absolute',
          top: strokeWidth,
          left: strokeWidth,
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          backgroundColor: DarkTheme.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}
