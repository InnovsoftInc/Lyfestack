import { Modal, Pressable, StyleSheet, View, Text, Dimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useEffect, useState, type RefObject, type ReactNode } from 'react';
import { BorderRadius, Spacing } from '../../theme';
import type { Theme } from '../../theme';

type AnchorRect = { x: number; y: number; width: number; height: number };

type PopoverProps = {
  visible: boolean;
  anchorRef: RefObject<any>;
  onClose: () => void;
  theme: Theme;
  width?: number;
  maxHeight?: number;
  align?: 'left' | 'right';
  children: ReactNode;
};

type PopoverOptionProps = {
  theme: Theme;
  label: string;
  subtitle?: string;
  icon?: string;
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
  children,
}: PopoverProps) {
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);

  useEffect(() => {
    if (!visible) return;
    measureAnchor(anchorRef, setAnchorRect);
  }, [visible, anchorRef]);

  if (!visible) return null;

  const top = (anchorRect?.y ?? 88) + (anchorRect?.height ?? 0) + 10;
  const screenWidth = Dimensions.get('window').width;
  const horizontalStyle =
    align === 'right'
      ? { right: Math.max(16, screenWidth - ((anchorRect?.x ?? 0) + (anchorRect?.width ?? 0))) }
      : { left: Math.max(16, anchorRect?.x ?? 16) };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.card,
            {
              top,
              width,
              maxHeight,
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: '#000',
            },
            horizontalStyle,
          ]}
        >
          {children}
        </View>
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
        {icon ? <Text style={styles.optionIcon}>{icon}</Text> : null}
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
    backgroundColor: 'rgba(7,10,18,0.08)',
  },
  card: {
    position: 'absolute',
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
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
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  optionLabelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionIcon: {
    fontSize: 16,
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
