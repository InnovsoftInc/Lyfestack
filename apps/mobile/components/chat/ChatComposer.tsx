import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, KeyboardAvoidingView, Platform, View, Text, TextInput, TouchableOpacity, StyleSheet,
} from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { Theme } from '../../theme';
import { Spacing } from '../../theme';
import type { ChatAttachment } from '../../stores/openclaw.store';
import { LiquidSurface } from '../ui';

const VOICE_BAR_PATTERN = [
  5, 8, 12, 7, 4, 10, 14, 6, 5, 9, 6, 11, 7, 4, 13, 8, 6, 10, 5, 7, 12, 6, 4, 9,
  6, 11, 7, 4, 13, 8, 6, 10, 5, 7, 12, 6, 4, 9, 5, 8, 12, 7, 4, 10, 14, 6,
];
const VOICE_SAMPLE_COUNT = 46;
const VOICE_SAMPLE_STEP = 4;

function ComposerIcon({
  kind,
  color,
}: {
  kind: 'audio' | 'image' | 'file' | 'mic' | 'stop' | 'wave';
  color: string;
}) {
  if (kind === 'audio') {
    return (
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Rect x="9" y="3" width="6" height="11" rx="3" stroke={color} strokeWidth="2" />
        <Path d="M6 11a6 6 0 0 0 12 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Path d="M12 17v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Path d="M9 21h6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    );
  }

  if (kind === 'image') {
    return (
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Rect x="3" y="5" width="18" height="14" rx="2.5" stroke={color} strokeWidth="2" />
        <Circle cx="9" cy="10" r="1.6" fill={color} />
        <Path d="M5.5 17l5-5 3.5 3.5 2-2 2.5 3.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (kind === 'file') {
    return (
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Path d="M8 3h6l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <Path d="M14 3v5h5" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (kind === 'stop') {
    return (
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Rect x="7" y="7" width="10" height="10" rx="2" fill={color} />
      </Svg>
    );
  }

  if (kind === 'wave') {
    return (
      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
        <Path d="M4 14.5c1.5 0 1.5-5 3-5s1.5 10 3 10 1.5-15 3-15 1.5 20 3 20 1.5-10 3-10 1.5 5 3 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="3" width="6" height="11" rx="3" stroke={color} strokeWidth="2" />
      <Path d="M6 11a6 6 0 0 0 12 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M12 17v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M9 21h6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function AttachmentChip({ attachment, onRemove, theme, isDark }: { attachment: ChatAttachment; onRemove: () => void; theme: Theme; isDark: boolean }) {
  const iconKind = attachment.mimeType.startsWith('audio/')
    ? 'audio'
    : attachment.type === 'image'
      ? 'image'
      : 'file';
  const chipBackground = isDark ? 'rgba(15,23,42,0.74)' : 'rgba(255,255,255,0.72)';
  const chipBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: chipBackground, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: chipBorder, shadowColor: '#000', shadowOpacity: isDark ? 0.18 : 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
      <ComposerIcon kind={iconKind} color={theme.text.secondary} />
      <Text style={{ color: theme.text.primary, fontSize: 11, fontWeight: '600', maxWidth: 130 }} numberOfLines={1}>{attachment.name}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={6}>
        <Text style={{ color: theme.text.secondary, fontSize: 12, fontWeight: '700' }}>✕</Text>
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
  onAttachPress?: () => void;
  onPhotoPress?: () => void;
  onVoicePress?: () => void;
  onVoiceSend?: () => void;
  onSpeakPress?: () => void;
  onSpeakExit?: () => void;
  voiceState?: 'idle' | 'recording' | 'processing';
  voiceDurationLabel?: string;
  voiceMeterLevel?: number;
  voiceMeterTick?: number;
  speakState?: 'idle' | 'connecting' | 'active';
  speakTranscript?: string;
  placeholder?: string;
  theme: Theme;
  isDark: boolean;
  insets: EdgeInsets;
  attachments: ChatAttachment[];
  onRemoveAttachment: (id: string) => void;
  footerContent?: React.ReactNode;
};

function VoiceTrack({
  theme, isDark, durationLabel, meterLevel, meterTick,
}: {
  theme: Theme;
  isDark: boolean;
  durationLabel: string;
  meterLevel: number;
  meterTick: number;
}) {
  const barColor = isDark ? 'rgba(226,232,240,0.72)' : 'rgba(15,23,42,0.58)';
  const samplesSeed = useMemo(() => Array.from({ length: VOICE_SAMPLE_COUNT }, () => 0), []);
  const [samples, setSamples] = useState(samplesSeed);
  const shiftAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const level = Math.max(0, Math.min(1, meterLevel));
    setSamples((prev) => [...prev.slice(1), level]);
    shiftAnim.setValue(0);
    Animated.timing(shiftAnim, {
      toValue: 1,
      duration: 78,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [meterLevel, meterTick, shiftAnim]);

  const translateX = shiftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [VOICE_SAMPLE_STEP, 0],
  });

  return (
    <View
      style={{
        flex: 1,
        minHeight: 34,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            transform: [{ translateX }],
          }}
        >
          {samples.map((sample, index) => {
            const isQuiet = sample < 0.11;
            const basePattern = (VOICE_BAR_PATTERN[index % VOICE_BAR_PATTERN.length] ?? 8) / 14;
            const height = isQuiet ? 2 : Math.max(5, Math.min(28, 4 + sample * (12 + basePattern * 15)));
            const width = isQuiet ? 2 : 2.5;
            return (
              <View
                key={index}
                style={{
                  width,
                  height,
                  borderRadius: 999,
                  backgroundColor: barColor,
                  opacity: isQuiet ? 0.34 : Math.min(1, 0.48 + sample * 0.52),
                }}
              />
            );
          })}
        </Animated.View>
      </View>
      <Text style={{ color: theme.text.secondary, fontSize: 13, fontWeight: '500' }}>{durationLabel}</Text>
    </View>
  );
}

function AiOrb({
  theme,
  isDark,
  status,
  transcript,
  onExit,
}: {
  theme: Theme;
  isDark: boolean;
  status: string;
  transcript?: string;
  onExit?: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.26] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });

  return (
    <View style={{ gap: 10, paddingVertical: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: theme.text.secondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 }}>LIVE TALK</Text>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.success }} />
        </View>
        {onExit && (
          <TouchableOpacity
            onPress={onExit}
            activeOpacity={0.8}
            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }}
          >
            <Text style={{ color: theme.text.primary, fontSize: 12, fontWeight: '600' }}>Exit</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
        <Animated.View
          style={{
            position: 'absolute',
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: theme.accent,
            opacity: glowOpacity,
            transform: [{ scale: ringScale }],
          }}
        />
        <Animated.View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.52)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.74)',
            shadowColor: theme.accent,
            shadowOpacity: 0.26,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
            transform: [{ scale }],
          }}
        >
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: theme.accent }} />
        </Animated.View>
      </View>
      <Text style={{ color: theme.text.primary, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>Talking with AI</Text>
      <Text style={{ color: theme.text.secondary, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
        {status}
      </Text>
      {!!transcript && (
        <View style={{ borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: isDark ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.68)' }}>
          <Text style={{ color: theme.text.primary, fontSize: 13, lineHeight: 18 }}>{transcript}</Text>
        </View>
      )}
    </View>
  );
}

export function ChatComposer({
  value, onChangeText, onSend, isStreaming, onAbort,
  onAttachPress, onPhotoPress, onVoicePress, onVoiceSend, onSpeakPress, onSpeakExit, voiceState = 'idle', voiceDurationLabel = '0:00', voiceMeterLevel = 0, voiceMeterTick = 0, speakState = 'idle', speakTranscript = '', placeholder, theme, isDark, insets, attachments, onRemoveAttachment, footerContent,
}: ChatComposerProps) {
  const hasText = value.trim().length > 0;
  const hasContent = hasText || attachments.length > 0;
  const voiceIsBusy = voiceState === 'processing';
  const voiceIsRecording = voiceState === 'recording';
  const composerBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(148,163,184,0.24)';
  const idleVoiceBackground = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.26)';
  const idleVoiceBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.72)';
  const disabledSendBackground = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,19,24,0.28)';
  const showVoiceRecorder = voiceState === 'recording';
  const showSpeakMode = speakState !== 'idle';
  const showVoiceActions = !isStreaming && !hasContent && !voiceIsBusy;
  const speakStatus = speakState === 'connecting' ? 'Connecting voice session…' : 'Speak naturally. Tap exit when you want the keyboard back.';

  return (
    <KeyboardAvoidingView
      pointerEvents="box-none"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingTop: 6,
        paddingBottom: insets.bottom + 4,
        backgroundColor: 'transparent',
      }}>
      <LiquidSurface
        theme={theme}
        isDark={isDark}
        borderRadius={26}
        intensity={52}
        reflection={false}
        blur={false}
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor: composerBorder,
          shadowOpacity: isDark ? 0.28 : 0.14,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 12 },
          elevation: 12,
        }}
        contentStyle={{
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 8,
          backgroundColor: 'transparent',
        }}
      >
        {attachments.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
            {attachments.map((a) => (
              <AttachmentChip key={a.id} attachment={a} onRemove={() => onRemoveAttachment(a.id)} theme={theme} isDark={isDark} />
            ))}
          </View>
        )}
        {showVoiceRecorder ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 42 }}>
            <TouchableOpacity
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,19,24,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={onVoicePress}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Cancel voice note"
            >
              <Text style={{ color: theme.text.secondary, fontSize: 18, fontWeight: '700', marginTop: -1 }}>×</Text>
            </TouchableOpacity>
            <VoiceTrack
              theme={theme}
              isDark={isDark}
              durationLabel={voiceDurationLabel}
              meterLevel={voiceMeterLevel}
              meterTick={voiceMeterTick}
            />
            <TouchableOpacity
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#111318', alignItems: 'center', justifyContent: 'center' }}
              onPress={onVoiceSend}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Send voice note"
            >
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', marginTop: -1 }}>↑</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {showSpeakMode ? (
              <View style={{ marginBottom: 10 }}>
                <AiOrb theme={theme} isDark={isDark} status={speakStatus} transcript={speakTranscript} {...(onSpeakExit ? { onExit: onSpeakExit } : {})} />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  flex: 1,
                  minHeight: 46,
                  borderRadius: 18,
                }}
              >
                <TextInput
                  style={{
                    minHeight: 44,
                    backgroundColor: 'transparent',
                    borderRadius: 18,
                    paddingHorizontal: 0,
                    paddingVertical: 8,
                    color: theme.text.primary,
                    fontSize: 14,
                    lineHeight: 20,
                    maxHeight: 104,
                    textAlignVertical: 'top',
                  }}
                  value={value}
                  onChangeText={onChangeText}
                  placeholder={placeholder}
                  placeholderTextColor={theme.text.secondary}
                  multiline
                  editable={!voiceIsBusy}
                  returnKeyType="send"
                  onSubmitEditing={onSend}
                  blurOnSubmit={false}
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {isStreaming ? (
                  <TouchableOpacity
                    style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.error + 'dd', alignItems: 'center', justifyContent: 'center' }}
                    onPress={onAbort}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Stop running process"
                  >
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>■</Text>
                  </TouchableOpacity>
                ) : hasContent ? (
                  <TouchableOpacity
                    style={[
                      { width: 38, height: 38, borderRadius: 19, backgroundColor: '#111318', alignItems: 'center', justifyContent: 'center' },
                      !hasContent && { backgroundColor: disabledSendBackground },
                    ]}
                    onPress={onSend}
                    disabled={!hasContent}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
                  >
                    <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', marginTop: -1 }}>↑</Text>
                  </TouchableOpacity>
                ) : showVoiceActions ? (
                  <>
                    <TouchableOpacity
                      style={[
                        {
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: idleVoiceBorder,
                          shadowOpacity: 0.08,
                          shadowRadius: 10,
                          shadowOffset: { width: 0, height: 2 },
                          elevation: 3,
                        },
                        voiceIsRecording
                          ? { backgroundColor: theme.error, shadowColor: theme.error }
                          : { backgroundColor: idleVoiceBackground, shadowColor: isDark ? '#000' : '#0f172a' },
                      ]}
                      onPress={onVoicePress}
                      disabled={voiceIsBusy}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={voiceIsRecording ? 'Recording voice note' : 'Start voice note'}
                    >
                      {voiceIsBusy ? (
                        <Text style={{ color: theme.text.secondary, fontSize: 16, fontWeight: '700' }}>…</Text>
                      ) : (
                        <ComposerIcon kind="mic" color={voiceIsRecording ? '#fff' : theme.text.secondary} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        {
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: speakState !== 'idle' ? theme.accent : idleVoiceBorder,
                          backgroundColor: speakState !== 'idle' ? `${theme.accent}20` : idleVoiceBackground,
                          shadowOpacity: 0.08,
                          shadowRadius: 10,
                          shadowOffset: { width: 0, height: 2 },
                          elevation: 3,
                        },
                        speakState !== 'idle' && { shadowColor: theme.accent },
                      ]}
                      onPress={onSpeakPress}
                      disabled={voiceIsBusy}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={speakState !== 'idle' ? 'Exit speak mode' : 'Start live talk'}
                    >
                      <ComposerIcon kind="wave" color={speakState !== 'idle' ? theme.accent : theme.text.secondary} />
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            </View>
          </>
        )}
        {footerContent && (

          <View style={{ paddingTop: 10 }}>
            {footerContent}
          </View>
        )}
      </LiquidSurface>
      </View>
    </KeyboardAvoidingView>
  );
}
