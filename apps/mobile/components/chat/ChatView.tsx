import {
  View, FlatList, TouchableOpacity, Text, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useRef, useCallback, useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Theme } from '../../theme';
import { Spacing } from '../../theme';
import type { ChatMessage } from '../../stores/openclaw.store';
import { ChatMessageItem } from './ChatMessage';

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
};

export const ChatView = forwardRef<ChatViewHandle, ChatViewProps>(({
  messages, agentName, isLoading, theme, colorScheme,
  emptyStateContent, onScrollNearTop, attachmentCount = 0, avatarSlot, contentTopPadding = 0,
}, ref) => {
  const listRef = useRef<FlatList>(null);
  const pinnedRef = useRef(true);
  const scrollRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const insets = useSafeAreaInsets();

  const clearScrollRetry = useCallback(() => {
    if (scrollRetryTimeoutRef.current) {
      clearTimeout(scrollRetryTimeoutRef.current);
      scrollRetryTimeoutRef.current = null;
    }
  }, []);

  const scrollToBottom = useCallback((animated = false) => {
    pinnedRef.current = true;
    setPinnedToBottom(true);

    const run = (attemptsLeft: number) => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated });
        if (attemptsLeft <= 1) return;
        clearScrollRetry();
        scrollRetryTimeoutRef.current = setTimeout(() => run(attemptsLeft - 1), 80);
      });
    };

    run(4);
  }, [clearScrollRetry]);

  const pinToBottom = useCallback(() => {
    pinnedRef.current = true;
    setPinnedToBottom(true);
  }, []);

  useImperativeHandle(ref, () => ({ scrollToBottom, pinToBottom }), [scrollToBottom, pinToBottom]);

  useEffect(() => () => {
    clearScrollRetry();
  }, [clearScrollRetry]);

  const handleScroll = useCallback((e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    const atBottom = distanceFromBottom < 80;
    if (atBottom !== pinnedRef.current) {
      pinnedRef.current = atBottom;
      setPinnedToBottom(atBottom);
    }
    if (contentOffset.y < 600) onScrollNearTop?.();
  }, [onScrollNearTop]);

  return (
    <>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.md, paddingTop: Spacing.md + contentTopPadding, paddingBottom: Spacing.sm, flexGrow: 1 }}
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
        onContentSizeChange={() => { if (pinnedRef.current) listRef.current?.scrollToEnd({ animated: false }); }}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />
      {!pinnedToBottom && messages.length > 0 && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            alignSelf: 'center',
            bottom: insets.bottom + 132 + (attachmentCount > 0 ? 40 : 0),
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
            zIndex: 15,
          }}
          onPress={() => scrollToBottom(true)}
          activeOpacity={0.8}
          hitSlop={10}
        >
          <Text style={{ color: theme.text.primary, fontSize: 18, fontWeight: '700' }}>↓</Text>
        </TouchableOpacity>
      )}
    </>
  );
});

ChatView.displayName = 'ChatView';
