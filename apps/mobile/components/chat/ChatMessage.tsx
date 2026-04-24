import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform,
} from 'react-native';
import { useState, useRef } from 'react';
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
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 4 }}
    >
      <Text style={{ color: theme.text.secondary, fontSize: 11, fontWeight: '600' }}>{copied ? '✓ Copied' : '⧉ Copy'}</Text>
    </TouchableOpacity>
  );
}

function ErrorBadge({ type, rawMessage, theme }: { type: ChatErrorType; rawMessage: string; theme: Theme }) {
  const meta = ERROR_META[type];
  const isKnown = type !== 'generic';
  return (
    <View style={{ alignSelf: 'flex-start', maxWidth: '88%', marginBottom: 8 }}>
      <View style={{ backgroundColor: theme.error + '12', borderWidth: 1, borderColor: theme.error + '40', borderRadius: 14, borderBottomLeftRadius: 4, padding: 12, gap: 4 }}>
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
    <View style={{ marginVertical: 4, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.border + '30' }}>
        <Text style={{ color: theme.text.secondary, fontSize: 10, fontWeight: '600' }}>{language || 'code'}</Text>
        <TouchableOpacity onPress={onCopy} hitSlop={6} activeOpacity={0.6}>
          <Text style={{ color: theme.text.secondary, fontSize: 10, fontWeight: '600' }}>{copied ? '✓ Copied' : '⧉ Copy'}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: theme.surface, padding: 10 }}>
        <Text style={{ color: theme.text.primary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, lineHeight: 18 }}>{code}</Text>
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
}

function AgentBubble({ content, streaming, toolActivity, toolHistory, theme, colorScheme, avatarSlot }: {
  content: string;
  streaming: boolean;
  toolActivity: string | null;
  toolHistory: string[];
  theme: Theme;
  colorScheme: 'light' | 'dark';
  avatarSlot?: React.ReactNode;
}) {
  const rendererRef = useRef<CustomMarkdownRenderer | null>(null);
  if (!rendererRef.current) rendererRef.current = new CustomMarkdownRenderer(theme);

  const markdownTheme = {
    code: { backgroundColor: theme.surface, color: theme.text.primary, borderRadius: 10, padding: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, overflow: 'scroll' as any },
    codespan: { backgroundColor: theme.surface, color: theme.accent, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
    heading1: { color: theme.text.primary, fontSize: 18, fontWeight: '700' as const, marginTop: 8, marginBottom: 4 },
    heading2: { color: theme.text.primary, fontSize: 15, fontWeight: '700' as const, marginTop: 6, marginBottom: 2 },
    heading3: { color: theme.text.primary, fontSize: 13, fontWeight: '700' as const, marginTop: 4 },
    paragraph: { color: theme.text.primary, fontSize: 15, lineHeight: 21, marginBottom: 4 },
    strong: { color: theme.text.primary, fontWeight: '700' as const },
    em: { color: theme.text.primary, fontStyle: 'italic' as const },
    link: { color: theme.accent },
    blockquote: { backgroundColor: theme.background, borderLeftColor: theme.accent, borderLeftWidth: 3, paddingLeft: Spacing.sm, paddingVertical: 2, marginVertical: 2 },
    hr: { backgroundColor: theme.border, height: StyleSheet.hairlineWidth, marginVertical: Spacing.sm },
    li: { color: theme.text.primary, fontSize: 15, lineHeight: 21 },
    table: { borderColor: theme.border },
    th: { backgroundColor: theme.background, color: theme.text.primary, fontWeight: '700' as const, padding: 4, fontSize: 13 },
    td: { color: theme.text.primary, padding: 4, fontSize: 13 },
    image: {},
    text: { color: theme.text.primary },
  };

  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <View style={{ alignSelf: 'flex-start', maxWidth: '88%', marginBottom: Spacing.xs }}>
        {(toolHistory?.length || toolActivity) ? (
          <ToolActivityList tools={toolHistory ?? []} currentTool={streaming ? (toolActivity ?? null) : null} theme={theme} />
        ) : null}
        {streaming && content.length === 0 && !toolActivity ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}>
            <ActivityIndicator size="small" color={theme.text.secondary} />
            <Text style={{ color: theme.text.secondary, fontSize: 13 }}>thinking...</Text>
          </View>
        ) : content.length > 0 ? (
          <Marked
            value={content || ' '}
            flatListProps={{
              scrollEnabled: false,
              contentContainerStyle: { paddingTop: 4, paddingBottom: 4, paddingHorizontal: 0 },
              style: { backgroundColor: 'transparent' },
            } as any}
            theme={markdownTheme as any}
            colorScheme={colorScheme}
            renderer={rendererRef.current}
          />
        ) : null}
        {streaming && content.length > 0 && (
          <View style={{ width: 6, height: 14, backgroundColor: theme.accent, marginLeft: 2, marginBottom: 6, borderRadius: 1 }} />
        )}
      </View>
      {!streaming && content.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          {avatarSlot}
          <CopyButton content={content} theme={theme} />
        </View>
      )}
      {!streaming && content.length === 0 && avatarSlot}
    </View>
  );
}

type ChatMessageItemProps = {
  message: ChatMessage;
  theme: Theme;
  colorScheme: 'light' | 'dark';
  avatarSlot?: React.ReactNode;
};

export function ChatMessageItem({ message, theme, colorScheme, avatarSlot }: ChatMessageItemProps) {
  if (message.isError && message.errorType) {
    return <ErrorBadge type={message.errorType} rawMessage={message.content} theme={theme} />;
  }

  if (message.role === 'agent') {
    return (
      <AgentBubble
        content={message.content}
        streaming={message.streaming ?? false}
        toolActivity={message.toolActivity ?? null}
        toolHistory={message.toolHistory ?? []}
        theme={theme}
        colorScheme={colorScheme}
        avatarSlot={avatarSlot}
      />
    );
  }

  return (
    <View>
      {message.attachments && message.attachments.length > 0 && (
        <View style={{ alignSelf: 'flex-end', flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4, maxWidth: '80%' }}>
          {message.attachments.map((a: ChatAttachment) => (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.accent + '18', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, gap: 3 }}>
              <Text style={{ fontSize: 11 }}>📄</Text>
              <Text style={{ color: theme.accent, fontSize: 11 }} numberOfLines={1}>{a.name}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={{
        maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 20, borderBottomRightRadius: 6,
        marginBottom: Spacing.sm, alignSelf: 'flex-end',
        backgroundColor: theme.accent,
      }}>
        <Text style={{ color: '#fff', fontSize: 15, lineHeight: 21 }}>{stripTimestamp(message.content)}</Text>
      </View>
    </View>
  );
}
