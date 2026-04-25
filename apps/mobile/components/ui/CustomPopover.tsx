import {
  Modal, Pressable, StyleSheet, View, Text, Dimensions, Animated, Easing,
  type LayoutChangeEvent, type StyleProp, type ViewStyle,
} from 'react-native';
import { useEffect, useRef, useState, type RefObject, type ReactNode } from 'react';
import { BorderRadius, Spacing } from '../../theme';
import type { Theme } from '../../theme';
import { LiquidSurface } from './LiquidSurface';

type AnchorRect = { x: number; y: number; width: number; height: number };

type PopoverProps = {
  visible: boolean;
  anchorRef: RefObject<any>;
  onClose: () => void;
  theme: Theme;
  width?: number;
  maxHeight?: number;
  align?: 'left' | 'right';
  openUpward?: boolean;
  reflection?: boolean;
  blur?: boolean;
  children: ReactNode;
};

type PopoverOptionProps = {
  theme: Theme;
  label: string;
  subtitle?: string;
  icon?: ReactNode;
  value?: string;
  active?: boolean;
  destructive?: boolean;
  compact?: boolean;
  onPress: () => void;
};

function measureAnchor(anchorRef: RefObject<any>, setRect: (rect: AnchorRect | null) => void) {
  const node = anchorRef.current;
  if (!node?.measureInWindow) {
    setRect(null);
    return;
  }
  node.measureInWindow((x: number, y: number, width: number, height: number) => {
    setRect({ x, y, width, height });
  });
}

export function CustomPopover({
  visible,
  anchorRef,
  onClose,
  theme,
  width = 260,
  maxHeight = 420,
  align = 'left',
  openUpward = false,
  reflection = true,
  blur = true,
  children,
}: PopoverProps) {
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setAnchorRect(null);
      setCardHeight(0);
      return;
    }
    measureAnchor(anchorRef, setAnchorRect);

    const retry = setTimeout(() => measureAnchor(anchorRef, setAnchorRect), 32);
    return () => clearTimeout(retry);
  }, [visible, anchorRef]);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 180 : 120,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [anim, visible]);

  if (!visible) return null;

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const screenMargin = 16;
  const gap = 10;
  const resolvedWidth = Math.min(width, screenWidth - (screenMargin * 2));
  const estimatedHeight = Math.min(cardHeight || maxHeight, screenHeight - (screenMargin * 2));
  const anchorX = anchorRect?.x ?? screenMargin;
  const anchorY = anchorRect?.y ?? 88;
  const anchorWidth = anchorRect?.width ?? 0;
  const anchorHeight = anchorRect?.height ?? 0;
  const rawLeft = align === 'right'
    ? anchorX + anchorWidth - resolvedWidth
    : anchorX;
  const left = Math.min(
    Math.max(screenMargin, rawLeft),
    Math.max(screenMargin, screenWidth - resolvedWidth - screenMargin),
  );
  const preferredTop = openUpward
    ? anchorY - estimatedHeight - gap
    : anchorY + anchorHeight + gap;
  const top = Math.min(
    Math.max(screenMargin, preferredTop),
    Math.max(screenMargin, screenHeight - estimatedHeight - screenMargin),
  );

  const handleCardLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (Math.abs(nextHeight - cardHeight) > 1) {
      setCardHeight(nextHeight);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.cardWrap,
            {
              left,
              top,
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [openUpward ? 10 : -6, 0],
                  }),
                },
                {
                  scale: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.97, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <LiquidSurface
            theme={theme}
            borderRadius={BorderRadius.lg + 2}
            intensity={58}
            reflection={reflection}
            blur={blur}
            style={[styles.card, { width: resolvedWidth, maxHeight }]}
            contentStyle={{ paddingVertical: 6 }}
          >
            <View onLayout={handleCardLayout}>
              {children}
            </View>
          </LiquidSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function PopoverSection({ title, theme, children, style }: { title?: string; theme: Theme; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.section, style]}>
      {title ? <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function PopoverOption({
  theme,
  label,
  subtitle,
  icon,
  value,
  active,
  destructive,
  compact,
  onPress,
}: PopoverOptionProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.option, compact && styles.optionCompact, pressed && styles.optionPressed]}>
      <View style={styles.optionLabelWrap}>
        {icon ? <View style={styles.optionIcon}>{icon}</View> : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionLabel, { color: destructive ? theme.error : theme.text.primary }]}>{label}</Text>
          {subtitle ? <Text style={[styles.optionSubtitle, { color: theme.text.secondary }]}>{subtitle}</Text> : null}
        </View>
      </View>
      {value ? <Text style={[styles.optionValue, { color: theme.text.secondary }]}>{value}</Text> : null}
      {active ? <Text style={[styles.optionCheck, { color: theme.text.primary }]}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7,10,18,0.12)',
  },
  cardWrap: {
    position: 'absolute',
  },
  card: {
    borderRadius: BorderRadius.lg + 2,
  },
  section: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.sm,
    paddingTop: 4,
    paddingBottom: 6,
  },
  option: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionCompact: {
    minHeight: 38,
    paddingVertical: 8,
  },
  optionPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  optionLabelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { fontSize: 14, fontWeight: '600' },
  optionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  optionValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  optionCheck: {
    fontSize: 15,
    fontWeight: '700',
  },
});
