import {
  View, FlatList, TouchableOpacity, Text, ActivityIndicator,
} from 'react-native';
import { memo, useRef, useCallback, useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Theme } from '../../theme';
import { Spacing } from '../../theme';
import type { ChatMessage } from '../../stores/openclaw.store';
import { ChatMessageItem } from './ChatMessage';
import { LiquidSurface } from '../ui';

function alphaColor(color: string, alpha: number): string {
  if (!color.startsWith('#')) return color;
  const hex = color.slice(1);
  const full = hex.length === 3
    ? hex.split('').map((char) => char + char).join('')
    : hex;
  if (full.length !== 6) return color;
  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export type ChatViewHandle = {
  scrollToBottom: (animated?: boolean) => void;
  pinToBottom: () => void;
};

type ChatViewProps = {
  messages: ChatMessage[];
  agentName: string;
  isLoading: boolean;
  theme: Theme;
  colorScheme: 'light' | 'dark';
  emptyStateContent?: React.ReactElement | null;
  onScrollNearTop?: () => void;
  attachmentCount?: number;
  avatarSlot?: (size: number) => React.ReactNode;
  contentTopPadding?: number;
  contentBottomPadding?: number;
  floatingButtonBottomOffset?: number;
  showScrollToBottomButton?: boolean;
};

const ChatViewBase = forwardRef<ChatViewHandle, ChatViewProps>(({ 
  messages, agentName, isLoading, theme, colorScheme,
  emptyStateContent, onScrollNearTop, attachmentCount = 0, avatarSlot, contentTopPadding = 0,
  contentBottomPadding = 0, floatingButtonBottomOffset, showScrollToBottomButton = true,
}, ref) => {
  const listRef = useRef<FlatList>(null);
  const pinnedRef = useRef(true);
  const topLoadArmedRef = useRef(true);
  const contentHeightRef = useRef(0);
  const layoutHeightRef = useRef(0);
  const prependAnchorRef = useRef<{ contentHeight: number; offsetY: number } | null>(null);
  const autoScrollArmedRef = useRef(false);
  const initialBottomScrollDoneRef = useRef(false);
  const previousLastMessageIdRef = useRef<string | null>(null);
  const scrollRetryTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const insets = useSafeAreaInsets();
  const fadeHeight = Math.max(72, contentTopPadding + 18);
  const fadeColor = theme.surface;

  const scrollToBottomNow = useCallback((animated = false) => {
    listRef.current?.scrollToEnd({ animated });
  }, []);

  const scrollToBottomWithRetry = useCallback((animated = false) => {
    scrollRetryTimersRef.current.forEach(clearTimeout);
    scrollRetryTimersRef.current = [];
    requestAnimationFrame(() => {
      scrollToBottomNow(animated);
      scrollRetryTimersRef.current = [80, 180, 340].map((delay) => (
        setTimeout(() => scrollToBottomNow(false), delay)
      ));
    });
  }, [scrollToBottomNow]);

  const scrollToBottom = useCallback((animated = false) => {
    pinnedRef.current = true;
    setPinnedToBottom(true);
    autoScrollArmedRef.current = true;

    scrollToBottomWithRetry(animated);
  }, [scrollToBottomWithRetry]);

  const pinToBottom = useCallback(() => {
    pinnedRef.current = true;
    setPinnedToBottom(true);
    autoScrollArmedRef.current = true;

    scrollToBottomWithRetry(false);
  }, [scrollToBottomWithRetry]);

  useImperativeHandle(ref, () => ({ scrollToBottom, pinToBottom }), [scrollToBottom, pinToBottom]);

  useEffect(() => () => {
    scrollRetryTimersRef.current.forEach(clearTimeout);
    scrollRetryTimersRef.current = [];
  }, []);

  useEffect(() => {
    initialBottomScrollDoneRef.current = false;
    previousLastMessageIdRef.current = null;
    pinnedRef.current = true;
    setPinnedToBottom(true);
  }, [agentName]);

  useEffect(() => {
    if (!pinnedRef.current) return;
    autoScrollArmedRef.current = true;
    scrollToBottomWithRetry(false);
  }, [contentBottomPadding, scrollToBottomWithRetry]);

  const lastMessageId = messages[messages.length - 1]?.id ?? null;
  useEffect(() => {
    if (isLoading || !lastMessageId) return;
    const previousLastMessageId = previousLastMessageIdRef.current;
    const lastMessageChanged = previousLastMessageId !== lastMessageId;
    previousLastMessageIdRef.current = lastMessageId;

    if (!initialBottomScrollDoneRef.current || (lastMessageChanged && pinnedRef.current)) {
      initialBottomScrollDoneRef.current = true;
      pinnedRef.current = true;
      setPinnedToBottom(true);
      autoScrollArmedRef.current = true;
      scrollToBottomWithRetry(false);
    }
  }, [isLoading, lastMessageId, scrollToBottomWithRetry]);

  const handleScroll = useCallback((e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    const atBottom = distanceFromBottom < 80;
    if (atBottom !== pinnedRef.current) {
      pinnedRef.current = atBottom;
      setPinnedToBottom(atBottom);
    }
    if (!atBottom) {
      autoScrollArmedRef.current = false;
    }
    const hasScrollableHistory = contentSize.height > layoutMeasurement.height + 240;
    if (!atBottom && hasScrollableHistory && contentOffset.y <= 120) {
      if (topLoadArmedRef.current) {
        topLoadArmedRef.current = false;
        prependAnchorRef.current = {
          contentHeight: contentSize.height,
          offsetY: contentOffset.y,
        };
        onScrollNearTop?.();
      }
    } else if (contentOffset.y >= 240) {
      topLoadArmedRef.current = true;
    }
  }, [onScrollNearTop]);

  return (
    <>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: Spacing.md,
          paddingTop: Spacing.md + contentTopPadding,
          paddingBottom: Spacing.sm + contentBottomPadding,
          flexGrow: 1,
        }}
        renderItem={({ item }) => (
          <ChatMessageItem
            message={item}
            theme={theme}
            colorScheme={colorScheme}
            avatarSlot={avatarSlot ? avatarSlot(24) : undefined}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ alignItems: 'center', gap: Spacing.sm, paddingTop: 80, paddingHorizontal: Spacing.xl }}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : (
            emptyStateContent ?? null
          )
        }
        onScroll={handleScroll}
        scrollEventThrottle={50}
        onLayout={(event) => {
          layoutHeightRef.current = event.nativeEvent.layout.height;
          if (!pinnedRef.current) return;
          scrollToBottomWithRetry(false);
        }}
        onContentSizeChange={(_, height) => {
          const previousHeight = contentHeightRef.current;
          const heightChanged = Math.abs(height - previousHeight) > 4;
          contentHeightRef.current = height;
          if (!heightChanged) return;

          const prependAnchor = prependAnchorRef.current;
          if (prependAnchor && !pinnedRef.current) {
            prependAnchorRef.current = null;
            const delta = height - prependAnchor.contentHeight;
            const nextOffset = Math.max(0, prependAnchor.offsetY + delta);
            requestAnimationFrame(() => {
              listRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
            });
            return;
          }

          if (!pinnedRef.current || !autoScrollArmedRef.current) return;
          autoScrollArmedRef.current = false;
          scrollToBottomWithRetry(false);
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: fadeHeight,
          zIndex: 8,
        }}
      >
        <View style={{ height: '44%', backgroundColor: fadeColor }} />
        <View style={{ height: '24%', backgroundColor: alphaColor(fadeColor, 0.78) }} />
        <View style={{ height: '18%', backgroundColor: alphaColor(fadeColor, 0.42) }} />
        <View style={{ height: '14%', backgroundColor: alphaColor(fadeColor, 0) }} />
      </View>
      {showScrollToBottomButton && !pinnedToBottom && messages.length > 0 && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            alignSelf: 'center',
            bottom: floatingButtonBottomOffset ?? (insets.bottom + 136 + (attachmentCount > 0 ? 40 : 0)),
            zIndex: 15,
          }}
          onPress={() => scrollToBottom(true)}
          activeOpacity={0.8}
          hitSlop={12}
        >
          <LiquidSurface
            theme={theme}
            isDark={colorScheme === 'dark'}
            borderRadius={23}
            intensity={48}
            reflection={false}
            blur={false}
            style={{
              width: 46,
              height: 46,
              borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.74)',
            }}
            contentStyle={{
              width: 46,
              height: 46,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.text.primary, fontSize: 20, fontWeight: '700', marginTop: -2 }}>↓</Text>
          </LiquidSurface>
        </TouchableOpacity>
      )}
    </>
  );
});

export const ChatView = memo(ChatViewBase);
ChatView.displayName = 'ChatView';
