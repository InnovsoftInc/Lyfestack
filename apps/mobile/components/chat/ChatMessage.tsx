import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, Platform,
} from 'react-native';
import { memo, useState, useRef } from 'react';
import MarkedBase, { Renderer as MarkedRenderer } from 'react-native-marked';
import * as Clipboard from 'expo-clipboard';
import type { Theme } from '../../theme';
import { Spacing } from '../../theme';
import type { ChatMessage, ChatAttachment, ChatErrorType } from '../../stores/openclaw.store';
import { ToolActivityList } from './StreamIndicator';

const Marked = MarkedBase as any;

const ERROR_META: Record<ChatErrorType, { icon: string; title: string; body: string }> = {
  billing: {
    icon: '💳',
    title: 'Out of Credits',
    body: 'Your API key has insufficient balance. Top up at openrouter.ai/settings/credits or switch to a different key in OpenClaw Settings.',
  },
  rate_limit: {
    icon: '⏱',
    title: 'Rate Limited',
    body: 'Too many requests to the free model tier. Wait a minute and try again, or switch to a paid model in the header above.',
  },
  all_failed: {
    icon: '🚫',
    title: 'All Models Failed',
    body: 'Every model in the fallback chain failed. Check your API keys and model configuration in OpenClaw Settings.',
  },
  generic: {
    icon: '⚠️',
    title: 'Agent Error',
    body: '',
  },
};

const TIMESTAMP_RE = /^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+\w+\]\s*/;
export function stripTimestamp(text: string): string {
  return text.replace(TIMESTAMP_RE, '');
}

function formatWorkTime(ms?: number): string | null {
  if (ms == null || ms < 0) return null;
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  if (totalSeconds < 60) return `Worked for ${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `Worked for ${minutes}m` : `Worked for ${minutes}m ${seconds}s`;
}

function CopyButton({ content, theme }: { content: string; theme: Theme }) {
  const [copied, setCopied] = useState(false);
  const onPress = async () => {
    await Clipboard.setStringAsync(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={6}
      activeOpacity={0.6}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 4,
        paddingHorizontal: 2,
      }}
    >
      <Text style={{ color: theme.text.secondary, fontSize: 12, fontWeight: '500' }}>{copied ? '✓ Copied' : '⧉ Copy'}</Text>
    </TouchableOpacity>
  );
}

function ErrorBadge({ type, rawMessage, theme }: { type: ChatErrorType; rawMessage: string; theme: Theme }) {
  const meta = ERROR_META[type];
  const isKnown = type !== 'generic';
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth: '88%', marginBottom: 8 }}>
      <View style={{ backgroundColor: theme.error + '14', borderWidth: 1, borderColor: theme.error + '32', borderRadius: 18, borderBottomLeftRadius: 8, padding: 13, gap: 5, shadowColor: theme.error, shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 15 }}>{meta.icon}</Text>
          <Text style={{ color: theme.error, fontSize: 13, fontWeight: '700' }}>{meta.title}</Text>
        </View>
        {isKnown ? (
          <Text style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18 }}>{meta.body}</Text>
        ) : (
          <Text style={{ color: theme.text.secondary, fontSize: 12, lineHeight: 17, fontFamily: 'Courier' }} numberOfLines={4}>
            {rawMessage.split('\n')[0]}
          </Text>
        )}
      </View>
    </View>
  );
}

function CodeBlockWithCopy({ code, language, theme }: { code: string; language?: string; theme: Theme }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <View style={{ marginVertical: 8, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(15,23,42,0.08)', overflow: 'hidden', backgroundColor: '#F8FAFC' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(148,163,184,0.10)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(15,23,42,0.06)' }}>
        <Text style={{ color: theme.text.secondary, fontSize: 11, fontWeight: '600' }}>{language || 'code'}</Text>
        <TouchableOpacity onPress={onCopy} hitSlop={6} activeOpacity={0.6}>
          <Text style={{ color: theme.text.secondary, fontSize: 11, fontWeight: '600' }}>{copied ? '✓ Copied' : '⧉ Copy'}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 10 }}>
        <Text style={{ color: '#0F172A', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, lineHeight: 19 }}>{code}</Text>
      </ScrollView>
    </View>
  );
}

class CustomMarkdownRenderer extends MarkedRenderer {
  private theme: Theme;
  constructor(theme: Theme) {
    super();
    this.theme = theme;
  }
  code(text: string, language?: string) {
    return <CodeBlockWithCopy key={text.slice(0, 20)} code={text} {...(language ? { language } : {})} theme={this.theme} />;
  }
  link(children: string | React.ReactNode[], href: string, styles?: any, title?: string) {
    return (
      <Text
        selectable
        accessibilityRole="link"
        accessibilityHint="Opens in a new window"
        accessibilityLabel={title || href}
        key={this.getKey()}
        onPress={() => { void Linking.openURL(href).catch(() => {}); }}
        style={[styles, { color: '#0B5FFF', textDecorationLine: 'underline', fontWeight: '600' }]}
      >
        {children}
      </Text>
    );
  }
}

class UserMarkdownRenderer extends MarkedRenderer {
  link(children: string | React.ReactNode[], href: string, styles?: any, title?: string) {
    return (
      <Text
        selectable
        accessibilityRole="link"
        accessibilityHint="Opens in a new window"
        accessibilityLabel={title || href}
        key={this.getKey()}
        onPress={() => { void Linking.openURL(href).catch(() => {}); }}
        style={[styles, { color: '#fff', textDecorationLine: 'underline', fontWeight: '700' }]}
      >
        {children}
      </Text>
    );
  }
}

function AgentBubble({ content, streaming, toolActivity, toolHistory, workTimeMs, theme, colorScheme, avatarSlot }: {
  content: string;
  streaming: boolean;
  toolActivity: string | null;
  toolHistory: string[];
  workTimeMs?: number;
  theme: Theme;
  colorScheme: 'light' | 'dark';
  avatarSlot?: React.ReactNode;
}) {
  const rendererRef = useRef<CustomMarkdownRenderer | null>(null);
  if (!rendererRef.current) rendererRef.current = new CustomMarkdownRenderer(theme);

  const markdownTheme = {
    code: { backgroundColor: '#F8FAFC', color: '#0F172A', borderRadius: 14, padding: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(15,23,42,0.10)', overflow: 'scroll' as any },
    codespan: { backgroundColor: '#F1F5F9', color: '#0F172A', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    heading1: { color: theme.text.primary, fontSize: 20, fontWeight: '700' as const, marginTop: 10, marginBottom: 6 },
    heading2: { color: theme.text.primary, fontSize: 17, fontWeight: '700' as const, marginTop: 8, marginBottom: 4 },
    heading3: { color: theme.text.primary, fontSize: 15, fontWeight: '700' as const, marginTop: 6, marginBottom: 3 },
    paragraph: { color: theme.text.primary, fontSize: 15, lineHeight: 24, marginBottom: 8 },
    strong: { color: theme.text.primary, fontWeight: '700' as const },
    em: { color: theme.text.primary, fontStyle: 'italic' as const },
    link: { color: '#0B5FFF', textDecorationLine: 'underline' as const, fontWeight: '600' as const },
    blockquote: { backgroundColor: '#F7F8FA', borderLeftColor: '#CBD5E1', borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 6, marginVertical: 6, borderRadius: 8 },
    hr: { backgroundColor: 'rgba(15,23,42,0.08)', height: StyleSheet.hairlineWidth, marginVertical: 12 },
    li: { color: theme.text.primary, fontSize: 15, lineHeight: 24, marginBottom: 4 },
    table: { borderColor: 'rgba(15,23,42,0.10)' },
    th: { backgroundColor: '#F7F8FA', color: theme.text.primary, fontWeight: '700' as const, padding: 6, fontSize: 13 },
    td: { color: theme.text.primary, padding: 6, fontSize: 13 },
    image: {},
    text: { color: theme.text.primary },
  };
  const hasVisibleContent = content.trim().length > 0 || Boolean(toolHistory?.length) || Boolean(toolActivity);
  const workTimeLabel = !streaming && hasVisibleContent ? formatWorkTime(workTimeMs) : null;

  return (
    <View style={{ marginBottom: Spacing.md + 2 }}>
      <View style={{ alignSelf: 'stretch', maxWidth: '100%', marginBottom: Spacing.xs }}>
        {workTimeLabel && (
          <View style={{ paddingBottom: 12, marginBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(15,23,42,0.08)' }}>
            <Text style={{ color: theme.text.secondary, fontSize: 13, fontWeight: '500' }}>
              {workTimeLabel} {'›'}
            </Text>
          </View>
        )}
        {streaming && (toolHistory?.length || toolActivity) ? (
          <ToolActivityList tools={toolHistory ?? []} currentTool={toolActivity ?? null} theme={theme} />
        ) : null}
        <View
          style={{
            alignSelf: 'stretch',
            paddingHorizontal: 0,
            paddingVertical: 0,
          }}
        >
          {streaming && content.length === 0 && !toolActivity && !(toolHistory?.length) ? (
            <ToolActivityList tools={[]} currentTool="checking context" theme={theme} />
          ) : content.length > 0 ? (
            <Marked
              value={content || ' '}
              flatListProps={{
                scrollEnabled: false,
                contentContainerStyle: { paddingTop: 2, paddingBottom: 2, paddingHorizontal: 0 },
                style: { backgroundColor: 'transparent' },
              } as any}
              theme={markdownTheme as any}
              colorScheme={colorScheme}
              renderer={rendererRef.current}
            />
          ) : null}
          {streaming && content.length > 0 && (
            <View style={{ width: 6, height: 14, backgroundColor: theme.accent, marginLeft: 2, marginBottom: 4, borderRadius: 1 }} />
          )}
        </View>
      </View>
      {!streaming && content.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <CopyButton content={content} theme={theme} />
        </View>
      )}
    </View>
  );
}

type ChatMessageItemProps = {
  message: ChatMessage;
  theme: Theme;
  colorScheme: 'light' | 'dark';
  avatarSlot?: React.ReactNode;
};

export const ChatMessageItem = memo(function ChatMessageItem({ message, theme, colorScheme, avatarSlot }: ChatMessageItemProps) {
  const userRendererRef = useRef<UserMarkdownRenderer | null>(null);
  if (!userRendererRef.current) userRendererRef.current = new UserMarkdownRenderer();

  if (message.isError && message.errorType) {
    return <ErrorBadge type={message.errorType} rawMessage={message.content} theme={theme} />;
  }

  if (message.role === 'agent') {
    const hasVisibleAgentContent = message.content.trim().length > 0 || Boolean(message.streaming) || Boolean(message.toolActivity) || Boolean(message.toolHistory?.length) || Boolean(message.isError);
    if (!hasVisibleAgentContent) return null;

    return (
      <AgentBubble
        content={message.content}
        streaming={message.streaming ?? false}
        toolActivity={message.toolActivity ?? null}
        toolHistory={message.toolHistory ?? []}
        {...(message.workTimeMs != null ? { workTimeMs: message.workTimeMs } : {})}
        theme={theme}
        colorScheme={colorScheme}
        avatarSlot={avatarSlot}
      />
    );
  }

  const userAttachments = message.attachments ?? [];
  const userText = stripTimestamp(message.content);
  const hasUserText = userText.trim().length > 0;
  const userMarkdownTheme = {
    paragraph: { color: '#fff', fontSize: 15, lineHeight: 21, marginBottom: 0 },
    strong: { color: '#fff', fontWeight: '800' as const },
    em: { color: '#fff', fontStyle: 'italic' as const },
    text: { color: '#fff' },
    link: { color: '#fff', textDecorationLine: 'underline' as const, fontWeight: '700' as const },
    codespan: { color: '#fff', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 5, paddingHorizontal: 4 },
  };

  return (
    <View>
      <View style={{
        maxWidth: '80%', paddingHorizontal: 15, paddingVertical: 11,
        borderRadius: 22, borderBottomRightRadius: 8,
        marginBottom: Spacing.sm,
        alignSelf: 'flex-end',
        backgroundColor: theme.accent,
        shadowColor: theme.accent,
        shadowOpacity: 0.28,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.18)',
      }}>
        {userAttachments.length > 0 && (
          <View style={{ gap: 6, marginBottom: hasUserText ? 8 : 0 }}>
            {userAttachments.map((a: ChatAttachment) => (
              <View
                key={a.id}
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  maxWidth: '100%',
                  backgroundColor: 'rgba(255,255,255,0.92)',
                  borderRadius: 16,
                  paddingLeft: 9,
                  paddingRight: 11,
                  paddingVertical: 7,
                  gap: 7,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: 'rgba(18, 24, 38, 0.08)',
                  shadowColor: '#0F172A',
                  shadowOpacity: 0.08,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: 'rgba(15, 23, 42, 0.07)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 10,
                      borderRadius: 2,
                      borderWidth: 1.3,
                      borderColor: 'rgba(15, 23, 42, 0.82)',
                    }}
                  />
                </View>
                <Text
                  style={{ color: '#111827', fontSize: 12, fontWeight: '600', flexShrink: 1 }}
                  numberOfLines={1}
                >
                  {a.name}
                </Text>
              </View>
            ))}
          </View>
        )}
        {hasUserText && (
          <Marked
            value={userText}
            flatListProps={{
              scrollEnabled: false,
              contentContainerStyle: { paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 },
              style: { backgroundColor: 'transparent' },
            } as any}
            theme={userMarkdownTheme as any}
            colorScheme={colorScheme}
            renderer={userRendererRef.current}
          />
        )}
      </View>
    </View>
  );
});
