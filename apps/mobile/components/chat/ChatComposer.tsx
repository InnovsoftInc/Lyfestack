import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';
import type { Theme } from '../../theme';
import { Spacing } from '../../theme';
import type { ChatAttachment } from '../../stores/openclaw.store';

function AttachmentChip({ attachment, onRemove, theme }: { attachment: ChatAttachment; onRemove: () => void; theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.accent + '18', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, gap: 4, borderWidth: 1, borderColor: theme.accent + '40' }}>
      <Text style={{ fontSize: 12 }}>{attachment.type === 'image' ? '🖼' : '📄'}</Text>
      <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '600', maxWidth: 120 }} numberOfLines={1}>{attachment.name}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={6}>
        <Text style={{ color: theme.text.secondary, fontSize: 13 }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

type ChatComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  onAbort: () => void;
  placeholder?: string;
  theme: Theme;
  insets: EdgeInsets;
  attachments: ChatAttachment[];
  onRemoveAttachment: (id: string) => void;
  footerContent?: React.ReactNode;
};

export function ChatComposer({
  value, onChangeText, onSend, isStreaming, onAbort,
  placeholder, theme, insets, attachments, onRemoveAttachment, footerContent,
}: ChatComposerProps) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
      paddingBottom: insets.bottom + Spacing.sm + 2,
      backgroundColor: theme.background,
    }}>
      <View style={{
        flex: 1, backgroundColor: theme.surface, borderRadius: 28,
        paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm,
        borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border,
        shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 }, elevation: 6,
      }}>
        {attachments.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: Spacing.xs }}>
            {attachments.map((a) => (
              <AttachmentChip key={a.id} attachment={a} onRemove={() => onRemoveAttachment(a.id)} theme={theme} />
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm }}>
          <TextInput
            style={{
              flex: 1, minHeight: 54, backgroundColor: 'transparent', borderRadius: 22,
              paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm + 2,
              color: theme.text.primary, fontSize: 15, maxHeight: 110, textAlignVertical: 'top',
            }}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={theme.text.secondary}
            multiline
            editable={!isStreaming}
            returnKeyType="send"
            onSubmitEditing={onSend}
            blurOnSubmit={false}
          />
          {isStreaming ? (
            <TouchableOpacity
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.error + 'cc', alignItems: 'center', justifyContent: 'center' }}
              onPress={onAbort}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>■</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', shadowColor: theme.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
                !value.trim() && { backgroundColor: theme.surface, shadowOpacity: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
              ]}
              onPress={onSend}
              disabled={!value.trim()}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: -1 }}>↑</Text>
            </TouchableOpacity>
          )}
        </View>
        {footerContent && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: Spacing.xs, paddingBottom: Spacing.sm }}>
            {footerContent}
          </View>
        )}
      </View>
    </View>
  );
}
