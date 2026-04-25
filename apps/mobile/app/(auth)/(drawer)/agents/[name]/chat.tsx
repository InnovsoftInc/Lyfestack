import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Platform, ActivityIndicator, Keyboard,
  Modal, ScrollView, useColorScheme, Alert, Animated, Easing, Image,
} from 'react-native';
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Buffer } from 'buffer';
import { useLocalSearchParams, router } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOpenClawStore } from '../../../../../stores/openclaw.store';
import type { ChatAttachment } from '../../../../../stores/openclaw.store';
import { openclawApi } from '../../../../../services/openclaw.api';
import { approvalsApi } from '../../../../../services/openclaw-extras.api';
import type { AllowlistEntry } from '../../../../../services/openclaw-extras.api';
import { transcribeAudio } from '../../../../../services/openai.api';
import { startRealtime, type RealtimeConnection } from '../../../../../services/realtime.client';
import { useTheme } from '../../../../../hooks/useTheme';
import { useThemeStore } from '../../../../../stores/theme.store';
import { useChatEngine } from '../../../../../hooks/useChatEngine';
import { Spacing } from '../../../../../theme';
import type { Theme } from '../../../../../theme';
import { AgentAvatar } from '../index';
import { ContextWarningBanner } from '../../../../../components/ContextWarningBanner';
import { ContextUsageBadge } from '../../../../../components/ContextUsageBadge';
import { CustomPopover, PopoverOption, PopoverSection, LiquidGlassButton, LiquidSurface } from '../../../../../components/ui';
import { ChatView, ChatComposer } from '../../../../../components/chat';
import type { ChatViewHandle } from '../../../../../components/chat';

type ModelDetail = {
  id: string;
  reasoning?: boolean;
  contextWindow?: number;
};

type ModelTier = 'all' | 'fast' | 'deep';

type ApprovalDefaults = {
  security: string;
  ask: string;
  askFallback: string;
};

type SlashAction = {
  key: string;
  label: string;
  hint: string;
  run?: () => Promise<void> | void;
};

type RemoteSlashCommand = {
  name: string;
  description: string;
  textAliases?: string[];
  acceptsArgs?: boolean;
  args?: Array<{ name: string; required?: boolean }>;
};

const SECURITY_OPTIONS = ['deny', 'allowlist', 'full'];
const ASK_OPTIONS = ['off', 'on-miss', 'always'];
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const DEFAULT_VOICE_NOTE_NAME = 'voice-note.m4a';

function isTextLikeAttachment(mimeType: string, name: string): boolean {
  const lowerMime = mimeType.toLowerCase();
  return lowerMime.startsWith('text/')
    || lowerMime.includes('json')
    || lowerMime.includes('xml')
    || lowerMime.includes('yaml')
    || lowerMime.includes('csv')
    || /\.(txt|md|mdx|json|ya?ml|csv|ts|tsx|js|jsx|html|css|xml|log)$/i.test(name.toLowerCase());
}

async function readUriAsBase64(uri: string): Promise<string> {
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  } catch {
    const res = await fetch(uri);
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }
}

async function buildAttachmentFromAsset(asset: {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
  type?: 'text' | 'image' | 'file';
}): Promise<ChatAttachment> {
  const base64 = await readUriAsBase64(asset.uri);
  const mimeType = asset.mimeType || 'application/octet-stream';
  const name = asset.name || asset.uri.split('/').pop() || 'attachment';
  const size = Number(asset.size ?? Math.ceil((base64.length * 3) / 4)) || 0;
  if (size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${name} is larger than 8MB`);
  }
  const textContent = isTextLikeAttachment(mimeType, name)
    ? Buffer.from(base64, 'base64').toString('utf-8')
    : undefined;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    type: asset.type ?? (mimeType.startsWith('image/') ? 'image' : textContent ? 'text' : 'file'),
    uri: asset.uri,
    mimeType,
    size,
    ...(textContent ? { textContent } : {}),
    dataBase64: base64,
  };
}

function inferAudioMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.caf')) return 'audio/x-caf';
  return 'audio/mp4';
}

function inferAudioFilename(uri: string): string {
  const rawName = uri.split('/').pop()?.split('?')[0];
  if (!rawName) return DEFAULT_VOICE_NOTE_NAME;
  return /\.[a-z0-9]+$/i.test(rawName) ? rawName : `${rawName}.m4a`;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function normalizeRecorderMeter(metering: number | undefined, isRecording: boolean): number {
  if (!isRecording || typeof metering !== 'number' || !Number.isFinite(metering)) {
    return isRecording ? 0.08 : 0;
  }
  const clampedDb = Math.max(-62, Math.min(0, metering));
  const normalized = (clampedDb + 62) / 62;
  return Math.max(0.06, Math.min(1, normalized ** 0.58));
}

function formatModelDateToken(token: string): string {
  if (!/^\d{8}$/.test(token)) return token;
  return `${token.slice(0, 4)}-${token.slice(4, 6)}-${token.slice(6, 8)}`;
}

function formatModelToken(token: string, index: number): string {
  const lower = token.toLowerCase();
  if (!lower) return token;
  if (/^\d{8}$/.test(lower)) return formatModelDateToken(lower);
  if (/^\d+([.]\d+)?$/.test(lower)) return lower;
  if (/^o\d+$/.test(lower) || /^r\d+$/.test(lower)) return lower;
  if (lower === 'gpt') return 'GPT';
  if (lower === 'ai') return 'AI';
  if (lower === 'xai') return 'xAI';
  if (lower === 'api') return 'API';
  const capitalized = lower.charAt(0).toUpperCase() + lower.slice(1);
  return index === 0 ? capitalized : capitalized;
}

function formatModelName(modelId: string): { title: string; provider: string } {
  const [providerId, rawModelId = modelId] = modelId.includes('/') ? modelId.split('/', 2) : ['', modelId];
  const providerMap: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    xai: 'xAI',
    openrouter: 'OpenRouter',
    mistral: 'Mistral',
    meta: 'Meta',
    deepseek: 'DeepSeek',
    groq: 'Groq',
  };
  const provider = providerMap[providerId?.toLowerCase() ?? ''] ?? (providerId ? formatModelToken(providerId, 0) : '');
  const title = rawModelId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((token, index) => formatModelToken(token, index))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    title: title || rawModelId || modelId,
    provider,
  };
}

function MenuIcon({
  kind,
  color,
}: {
  kind: 'voice' | 'file' | 'folder' | 'image' | 'camera' | 'spark';
  color: string;
}) {
  if (kind === 'voice') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Rect x="9" y="3" width="6" height="11" rx="3" stroke={color} strokeWidth="2" />
        <Path d="M6 11a6 6 0 0 0 12 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Path d="M12 17v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Path d="M9 21h6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    );
  }

  if (kind === 'file') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M8 3h6l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <Path d="M14 3v5h5" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (kind === 'folder') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (kind === 'camera') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2.4l1.4-1.7A2 2 0 0 1 11.9 4h.2a2 2 0 0 1 1.6.8L15.1 6h2.4A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <Circle cx="12" cy="12.5" r="3.3" stroke={color} strokeWidth="2" />
      </Svg>
    );
  }

  if (kind === 'spark') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      </Svg>
    );
  }

  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="5" width="18" height="14" rx="2.5" stroke={color} strokeWidth="2" />
      <Circle cx="9" cy="10" r="1.6" fill={color} />
      <Path d="M5.5 17l5-5 3.5 3.5 2-2 2.5 3.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function AgentChatScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const theme = useTheme();
  const isDark = useThemeStore((s) => s.isDark);
  const colorScheme = (useColorScheme() ?? 'dark') as 'light' | 'dark';
  const s = styles(theme);
  const insets = useSafeAreaInsets();
  const { agents, activeChat, currentSession, connectionStatus } = useOpenClawStore();
  const routeName = String(name ?? '');
  const agent = agents.find((a) =>
    a.id === routeName
    || a.name === routeName
    || a.id.toLowerCase() === routeName.toLowerCase()
    || a.name.toLowerCase() === routeName.toLowerCase()
  );
  const agentId = agent?.id ?? (routeName.toLowerCase() === 'leo' ? 'main' : routeName);
  const displayName = agent?.name ?? (agentId === 'main' ? 'Leo' : routeName);

  const {
    messages, isStreaming, loadingHistory, compactionToast, warningDismissedRef,
    send, abort, loadOlder,
  } = useChatEngine(agentId);

  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [keyboardLift, setKeyboardLift] = useState(0);

  // Model picker state
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [attachmentMode, setAttachmentMode] = useState<'camera' | 'gallery' | 'files' | 'workspace'>('camera');
  const [recentImages, setRecentImages] = useState<Array<{ id: string; uri: string; filename: string }>>([]);
  const [recentImagesLoading, setRecentImagesLoading] = useState(false);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<{ id: string; uri: string; filename: string } | null>(null);
  const [showContextPopover, setShowContextPopover] = useState(false);
  const [currentModel, setCurrentModel] = useState('');
  const [fallbackModels, setFallbackModels] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableModelDetails, setAvailableModelDetails] = useState<ModelDetail[]>([]);
  const [modelTier, setModelTier] = useState<ModelTier>('all');
  const [changingModel, setChangingModel] = useState(false);

  // File picker state
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<Array<{ filename: string; preview: string }>>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [selectedWorkspaceFile, setSelectedWorkspaceFile] = useState<{ filename: string; preview: string } | null>(null);
  const [selectedWorkspaceContent, setSelectedWorkspaceContent] = useState('');
  const [selectedWorkspaceLoading, setSelectedWorkspaceLoading] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [speakState, setSpeakState] = useState<'idle' | 'connecting' | 'active'>('idle');
  const [speakTranscript, setSpeakTranscript] = useState('');
  const [remoteSlashCommands, setRemoteSlashCommands] = useState<RemoteSlashCommand[]>([]);

  // Permissions modal state
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [approvalDefaults, setApprovalDefaults] = useState<ApprovalDefaults>({ security: 'full', ask: 'off', askFallback: 'full' });
  const [allowlistEntries, setAllowlistEntries] = useState<AllowlistEntry[]>([]);
  const [allowlistInput, setAllowlistInput] = useState('');
  const [savingPermissions, setSavingPermissions] = useState(false);

  const chatViewRef = useRef<ChatViewHandle>(null);
  const modelAnchorRef = useRef<any>(null);
  const contextAnchorRef = useRef<any>(null);
  const shellAnim = useRef(new Animated.Value(0)).current;
  const realtimeConnectionRef = useRef<RealtimeConnection | null>(null);
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const voiceRecorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const voiceRecorderState = useAudioRecorderState(voiceRecorder, 80);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      const height = Math.max(0, (event.endCoordinates?.height ?? 0) - insets.bottom);
      setKeyboardLift(height);
      requestAnimationFrame(() => chatViewRef.current?.scrollToBottom(false));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardLift(0);
      requestAnimationFrame(() => chatViewRef.current?.scrollToBottom(false));
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  useEffect(() => () => {
    realtimeConnectionRef.current?.close();
    realtimeConnectionRef.current = null;
  }, []);

  useEffect(() => {
    openclawApi.getAgent(agentId).then((res: any) => {
      setCurrentModel(res.data?.model ?? '');
      setFallbackModels(res.data?.fallbackModels ?? []);
    }).catch(() => {});
    openclawApi.getConfig().then((res: any) => {
      const models: string[] = res.data?.availableModels ?? [];
      if (models.length) setAvailableModels(models);
      const details: ModelDetail[] = res.data?.availableModelDetails ?? [];
      if (details.length) setAvailableModelDetails(details);
    }).catch(() => {});
    openclawApi.listCommands({ agentId }).then((res: any) => {
      setRemoteSlashCommands(Array.isArray(res?.data?.commands) ? res.data.commands : []);
    }).catch(() => {
      setRemoteSlashCommands([]);
    });
  }, [agentId]);

  useEffect(() => {
    shellAnim.setValue(0);
    Animated.timing(shellAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [agentId, shellAnim]);

  const currentModelMeta = useMemo(
    () => availableModelDetails.find((d) => d.id === currentModel),
    [availableModelDetails, currentModel],
  );

  const filteredModels = useMemo(
    () => availableModels.filter((model) => {
      if (modelTier === 'all') return true;
      const detail = availableModelDetails.find((e) => e.id === model);
      return modelTier === 'deep' ? Boolean(detail?.reasoning) : !detail?.reasoning;
    }),
    [availableModels, availableModelDetails, modelTier],
  );

  const openModelPicker = useCallback(() => {
    setModelTier(currentModelMeta ? (currentModelMeta.reasoning ? 'deep' : 'fast') : 'all');
    setShowContextPopover(false);
    setShowAttachmentModal(false);
    setShowModelPicker(true);
  }, [currentModelMeta]);

  const handleModelChange = async (model: string, opts: { close?: boolean } = {}) => {
    setChangingModel(true);
    try {
      await openclawApi.updateAgent(agentId, { model });
      setCurrentModel(model);
      if (opts.close !== false) setShowModelPicker(false);
    } catch {} finally { setChangingModel(false); }
  };

  const applyModelTier = useCallback(async (tier: ModelTier) => {
    setModelTier(tier);
    if (tier === 'all') return;
    const currentProvider = currentModel.split('/')[0] ?? '';
    const candidates = availableModelDetails.filter((d) =>
      tier === 'deep' ? Boolean(d.reasoning) : !d.reasoning);
    const preferred = candidates.find((d) => d.id.startsWith(`${currentProvider}/`)) ?? candidates[0];
    if (preferred?.id && preferred.id !== currentModel) {
      await handleModelChange(preferred.id, { close: false });
    }
  }, [availableModelDetails, currentModel]);

  const openPermissions = useCallback(async () => {
    setShowContextPopover(false);
    setShowAttachmentModal(false);
    setShowPermissionsModal(true);
    setPermissionsLoading(true);
    try {
      const [config, allowlist] = await Promise.all([
        approvalsApi.getConfig(),
        approvalsApi.listAllowlist(agentId),
      ]);
      setApprovalDefaults(config.defaults);
      setAllowlistEntries(allowlist[agentId] ?? []);
    } catch { /* ignore */ } finally {
      setPermissionsLoading(false);
    }
  }, [agentId]);

  const updateApprovalSetting = useCallback(async (field: keyof ApprovalDefaults, value: string) => {
    const prev = approvalDefaults;
    setApprovalDefaults({ ...prev, [field]: value });
    setSavingPermissions(true);
    try {
      await approvalsApi.setDefaults({ [field]: value });
    } catch { setApprovalDefaults(prev); }
    finally { setSavingPermissions(false); }
  }, [approvalDefaults]);

  const addAllowlistEntry = useCallback(async () => {
    const pattern = allowlistInput.trim();
    if (!pattern) return;
    setSavingPermissions(true);
    try {
      const entry = await approvalsApi.addEntry(agentId, pattern, 'mobile');
      setAllowlistEntries((prev) => [entry, ...prev.filter((item) => item.id !== entry.id)]);
      setAllowlistInput('');
    } catch { /* ignore */ } finally { setSavingPermissions(false); }
  }, [allowlistInput, agentId]);

  const removeAllowlistEntry = useCallback(async (id: string) => {
    const prev = allowlistEntries;
    setAllowlistEntries((entries) => entries.filter((e) => e.id !== id));
    setSavingPermissions(true);
    try {
      await approvalsApi.removeEntry(agentId, id);
    } catch { setAllowlistEntries(prev); }
    finally { setSavingPermissions(false); }
  }, [allowlistEntries, agentId]);

  const openWorkspaceFilePicker = useCallback(async () => {
    setShowContextPopover(false);
    setShowModelPicker(false);
    setShowAttachmentModal(false);
    setWorkspaceFiles([]);
    setWorkspaceSearch('');
    setSelectedWorkspaceFile(null);
    setSelectedWorkspaceContent('');
    setSelectedWorkspaceLoading(false);
    setLoadingFiles(true);
    setShowFilePicker(true);
    try {
      const res = await openclawApi.listAgentFiles(agentId) as any;
      setWorkspaceFiles(res.data ?? []);
    } catch {
      setWorkspaceFiles([]);
    } finally { setLoadingFiles(false); }
  }, [agentId]);

  const attachWorkspaceFile = useCallback(async (filename: string, contentOverride?: string) => {
    if (pendingAttachments.find((a) => a.name === filename)) { setShowFilePicker(false); return; }
    try {
      const content = typeof contentOverride === 'string'
        ? contentOverride
        : ((await openclawApi.getAgentFile(agentId, filename) as any).data?.content ?? '');
      setPendingAttachments((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          name: filename,
          type: 'text',
          uri: `workspace://${filename}`,
          mimeType: 'text/markdown',
          size: content.length,
          textContent: content,
        },
      ]);
    } catch {} finally { setShowFilePicker(false); }
  }, [agentId, pendingAttachments]);

  const filteredWorkspaceFiles = useMemo(() => {
    const query = workspaceSearch.trim().toLowerCase();
    if (!query) return workspaceFiles;
    return workspaceFiles.filter((file) => (
      file.filename.toLowerCase().includes(query)
      || file.preview.toLowerCase().includes(query)
    ));
  }, [workspaceFiles, workspaceSearch]);

  const openWorkspaceFile = useCallback(async (file: { filename: string; preview: string }) => {
    setSelectedWorkspaceFile(file);
    setSelectedWorkspaceContent('');
    setSelectedWorkspaceLoading(true);
    try {
      const res = await openclawApi.getAgentFile(agentId, file.filename) as any;
      setSelectedWorkspaceContent(res.data?.content ?? '');
    } catch {
      setSelectedWorkspaceContent(file.preview || '');
    } finally {
      setSelectedWorkspaceLoading(false);
    }
  }, [agentId]);

  const attachSelectedWorkspaceFile = useCallback(async () => {
    if (!selectedWorkspaceFile) return;
    await attachWorkspaceFile(selectedWorkspaceFile.filename, selectedWorkspaceContent);
  }, [attachWorkspaceFile, selectedWorkspaceContent, selectedWorkspaceFile]);

  const attachMediaAsset = useCallback(async (asset: { uri: string; name?: string | null; mimeType?: string | null; size?: number | null; type?: 'text' | 'image' | 'file' }) => {
    const attachment = await buildAttachmentFromAsset(asset);
    setPendingAttachments((prev) => [...prev, ...prev.some((existing) => existing.name === attachment.name && existing.size === attachment.size) ? [] : [attachment]]);
  }, []);

  const loadRecentImages = useCallback(async () => {
    setRecentImagesLoading(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        setRecentImages([]);
        return;
      }
      const page = await MediaLibrary.getAssetsAsync({
        first: 20,
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: [MediaLibrary.SortBy.modificationTime],
      });
      const items = await Promise.all(page.assets.map(async (asset) => {
        const info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: false }).catch(() => null);
        return {
          id: asset.id,
          uri: info?.localUri ?? asset.uri,
          filename: asset.filename || `${asset.id}.jpg`,
        };
      }));
      setRecentImages(items.filter((item) => Boolean(item.uri)));
    } catch (err: any) {
      setRecentImages([]);
      Alert.alert('Could not load recent photos', err?.message ?? 'Please try again.');
    } finally {
      setRecentImagesLoading(false);
    }
  }, []);

  const openAttachmentModal = useCallback(async () => {
    setShowContextPopover(false);
    setShowModelPicker(false);
    setAttachmentMode('camera');
    setSelectedGalleryImage(null);
    setShowAttachmentModal(true);
    setRecentImages([]);
    void loadRecentImages();
    if (!cameraPermission?.granted) {
      void requestCameraPermission();
    }
  }, [cameraPermission?.granted, loadRecentImages, requestCameraPermission]);

  const pickDeviceFiles = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: ['*/*'],
      });
      if (result.canceled) return;
      const next = await Promise.all(result.assets.map((asset) => buildAttachmentFromAsset({
        uri: asset.uri,
        ...(asset.name != null ? { name: asset.name } : {}),
        ...(asset.mimeType != null ? { mimeType: asset.mimeType } : {}),
        ...(asset.size != null ? { size: asset.size } : {}),
      })));
      setPendingAttachments((prev) => [...prev, ...next.filter((attachment) => !prev.some((existing) => existing.name === attachment.name && existing.size === attachment.size))]);
    } catch (err: any) {
      const message = String(err?.message ?? 'Please try again.');
      Alert.alert('Could not attach file', message);
    }
  }, []);

  const pickMedia = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photos access needed', 'Please allow photo library access to attach media.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 1,
      });
      if (result.canceled) return;
      const next = await Promise.all(result.assets.map((asset) => buildAttachmentFromAsset({
        uri: asset.uri,
        ...(asset.fileName != null ? { name: asset.fileName } : {}),
        ...(asset.mimeType != null ? { mimeType: asset.mimeType } : {}),
        ...(asset.fileSize != null ? { size: asset.fileSize } : {}),
        type: asset.type === 'image' ? 'image' : 'file',
      })));
      setPendingAttachments((prev) => [...prev, ...next.filter((attachment) => !prev.some((existing) => existing.name === attachment.name && existing.size === attachment.size))]);
    } catch (err: any) {
      Alert.alert('Could not attach media', err?.message ?? 'Please try again.');
    }
  }, []);

  const pickCamera = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Please allow camera access to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (result.canceled) return;
      const next = await Promise.all(result.assets.map((asset) => buildAttachmentFromAsset({
        uri: asset.uri,
        ...(asset.fileName != null ? { name: asset.fileName } : {}),
        ...(asset.mimeType != null ? { mimeType: asset.mimeType } : {}),
        ...(asset.fileSize != null ? { size: asset.fileSize } : {}),
        type: 'image',
      })));
      setPendingAttachments((prev) => [...prev, ...next.filter((attachment) => !prev.some((existing) => existing.name === attachment.name && existing.size === attachment.size))]);
    } catch (err: any) {
      Alert.alert('Could not open camera', err?.message ?? 'Please try again.');
    }
  }, []);

  const captureCameraPhoto = useCallback(async () => {
    try {
      if (!cameraPermission?.granted) {
        const permission = await requestCameraPermission();
        if (!permission.granted) {
          Alert.alert('Camera access needed', 'Please allow camera access to take a photo.');
          return;
        }
      }
      const shot = await cameraRef.current?.takePictureAsync({ quality: 0.9, skipProcessing: true });
      if (!shot?.uri) return;
      await attachMediaAsset({
        uri: shot.uri,
        name: `camera-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        type: 'image',
      });
    } catch (err: any) {
      Alert.alert('Could not take photo', err?.message ?? 'Please try again.');
    }
  }, [attachMediaAsset, cameraPermission?.granted, requestCameraPermission]);

  const launchAttachmentAction = useCallback((action: 'camera' | 'gallery' | 'files' | 'workspace') => {
    if (action === 'camera' || action === 'gallery') {
      setAttachmentMode(action);
      setSelectedGalleryImage(null);
      setShowAttachmentModal(true);
      return;
    }
    setShowAttachmentModal(false);
    setTimeout(() => {
      if (action === 'files') {
        void pickDeviceFiles();
      } else {
        void openWorkspaceFilePicker();
      }
    }, 180);
  }, [openWorkspaceFilePicker, pickDeviceFiles]);

  const attachRecentImage = useCallback(async (id: string) => {
    const selected = recentImages.find((item) => item.id === id);
    if (!selected) return;
    const existing = pendingAttachments.find((item) => item.uri === selected.uri);
    if (existing) {
      setPendingAttachments((prev) => prev.filter((item) => item.id !== existing.id));
      return;
    }
    try {
      await attachMediaAsset({ uri: selected.uri, name: selected.filename, type: 'image' });
    } catch (err: any) {
      Alert.alert('Could not attach image', err?.message ?? 'Please try again.');
    }
  }, [attachMediaAsset, pendingAttachments, recentImages]);

  const previewRecentImage = useCallback((id: string) => {
    const selected = recentImages.find((item) => item.id === id) ?? null;
    setSelectedGalleryImage(selected);
    setAttachmentMode('gallery');
  }, [recentImages]);

  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const resetAudioRecordingMode = useCallback(async () => {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    } catch {}
  }, []);

  const cancelVoiceNote = useCallback(async () => {
    if (voiceState === 'processing' || (!voiceRecorderState.isRecording && voiceState !== 'recording')) return;

    try {
      await voiceRecorder.stop();
    } catch {}
    await resetAudioRecordingMode();
    setVoiceState('idle');
  }, [resetAudioRecordingMode, voiceRecorder, voiceRecorderState.isRecording, voiceState]);

  const stopVoiceNote = useCallback(async () => {
    if (voiceState === 'processing' || (!voiceRecorderState.isRecording && voiceState !== 'recording')) return;

    setVoiceState('processing');
    try {
      await voiceRecorder.stop();
      const recordedUri = voiceRecorder.getStatus().url ?? voiceRecorderState.url;
      if (!recordedUri) {
        throw new Error('No recording was captured.');
      }

      const filename = inferAudioFilename(recordedUri);
      const response = await fetch(recordedUri);
      const audioBuffer = await response.arrayBuffer();
      const transcript = await transcribeAudio(audioBuffer, { filename });
      const transcriptText = transcript.text?.trim();
      if (transcriptText) {
        const current = input.trim();
        const message = current ? `${current}\n\n${transcriptText}` : transcriptText;
        const attachments = [...pendingAttachments];
        setInput('');
        setPendingAttachments([]);
        chatViewRef.current?.pinToBottom();
        await send(message, attachments);
      } else {
        Alert.alert('No speech detected', 'Nothing was sent. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Voice note failed', err?.message ?? 'Please try recording again.');
    } finally {
      await resetAudioRecordingMode();
      setVoiceState('idle');
    }
  }, [input, pendingAttachments, resetAudioRecordingMode, send, voiceRecorder, voiceRecorderState.isRecording, voiceRecorderState.url, voiceState]);

  const startVoiceNote = useCallback(async () => {
    setShowContextPopover(false);
    setShowAttachmentModal(false);
    if (voiceState === 'processing') return;
    if (voiceRecorderState.isRecording) {
      await cancelVoiceNote();
      return;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone access needed', 'Please allow microphone access to record a voice note.');
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await voiceRecorder.prepareToRecordAsync({ isMeteringEnabled: true });
      voiceRecorder.record();
      setVoiceState('recording');
    } catch (err: any) {
      setVoiceState('idle');
      Alert.alert('Could not start recording', err?.message ?? 'Please try again.');
    }
  }, [cancelVoiceNote, isStreaming, voiceRecorder, voiceRecorderState.isRecording, voiceState]);

  const stopSpeakMode = useCallback(() => {
    realtimeConnectionRef.current?.close();
    realtimeConnectionRef.current = null;
    setSpeakTranscript('');
    setSpeakState('idle');
  }, []);

  const startSpeakMode = useCallback(async () => {
    setShowContextPopover(false);
    setShowAttachmentModal(false);
    if (voiceState === 'processing') return;
    if (voiceRecorderState.isRecording) {
      await cancelVoiceNote();
    }
    if (realtimeConnectionRef.current) {
      stopSpeakMode();
      return;
    }

    setSpeakState('connecting');
    setSpeakTranscript('');
    try {
      const conn = await startRealtime({
        instructions: `You are the live voice assistant for ${displayName}. Keep replies short, warm, and conversational.`,
        onTranscript: (text) => setSpeakTranscript((prev) => `${prev}${text}`),
        onClose: () => {
          realtimeConnectionRef.current = null;
          setSpeakTranscript('');
          setSpeakState('idle');
        },
        onError: (err) => Alert.alert('Voice talk failed', err.message),
      });
      realtimeConnectionRef.current = conn;
      setSpeakState('active');
    } catch (err: any) {
      setSpeakState('idle');
      setSpeakTranscript('');
      Alert.alert('Could not start live talk', err?.message ?? 'Please try again.');
    }
  }, [cancelVoiceNote, displayName, isStreaming, stopSpeakMode, voiceRecorderState.isRecording, voiceState]);


  const localSlashActions = useMemo<SlashAction[]>(() => ([
    { key: 'model', label: 'Model', hint: 'Change model and intelligence', run: openModelPicker },
    { key: 'permissions', label: 'Permissions', hint: 'Edit approvals and allowlist', run: openPermissions },
    { key: 'voice', label: 'Voice note', hint: 'Record a note and transcribe it into the composer', run: startVoiceNote },
    { key: 'files', label: 'Files', hint: 'Attach a device or workspace file', run: () => { void openAttachmentModal(); } },
  ]), [openModelPicker, openPermissions, startVoiceNote]);

  const slashActions = useMemo<SlashAction[]>(() => {
    const byKey = new Map<string, SlashAction>();
    for (const action of localSlashActions) byKey.set(action.key, action);
    for (const command of remoteSlashCommands) {
      if (!command?.name) continue;
      if (byKey.has(command.name)) continue;
      byKey.set(command.name, {
        key: command.name,
        label: command.name,
        hint: command.description,
      });
    }
    return Array.from(byKey.values());
  }, [localSlashActions, remoteSlashCommands]);

  const slashQuery = input.startsWith('/') ? input.slice(1).trim().toLowerCase() : '';
  const slashMatches = input.startsWith('/')
    ? slashActions.filter((a) => a.key.includes(slashQuery) || a.label.toLowerCase().includes(slashQuery))
    : [];

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed && pendingAttachments.length === 0) return;
    if (trimmed.startsWith('/')) {
      const command = slashActions.find((a) => `/${a.key}` === trimmed.toLowerCase());
      if (command?.run) {
        setInput('');
        await command.run();
        return;
      }
    }
    const msg = input;
    const attachments = [...pendingAttachments];
    setInput('');
    setPendingAttachments([]);
    chatViewRef.current?.pinToBottom();
    await send(msg, attachments);
  }, [input, isStreaming, pendingAttachments, send, slashActions]);

  const liveSession = activeChat?.agentName === agentId ? currentSession : null;

  const usagePct = liveSession && liveSession.contextWindow > 0
    ? liveSession.usage.contextUsedTokens / liveSession.contextWindow
    : 0;
  const contextPctLabel = `${Math.round(usagePct * 100)}% used`;
  const contextColor = usagePct >= 0.9 ? theme.error : usagePct >= 0.7 ? theme.warning : theme.success;
  const currentModelDisplay = currentModel ? formatModelName(currentModel) : null;
  const modelDisplayName = currentModelDisplay?.title.replace(/^GPT\s*/i, '') ?? 'Model';
  const modelIntensityLabel = currentModelMeta ? (currentModelMeta.reasoning ? 'High' : 'Medium') : 'Select';
  const voiceDurationLabel = formatDuration(voiceRecorderState.durationMillis);
  const voiceMeterLevel = normalizeRecorderMeter(voiceRecorderState.metering, voiceRecorderState.isRecording);
  const chatBottomInset = useMemo(() => {
    const baseDock = insets.bottom + 124;
    const attachmentLift = pendingAttachments.length > 0 ? 28 : 0;
    const voiceLift = voiceState !== 'idle' ? 22 : 0;
    const speakLift = speakState !== 'idle' ? 24 : 0;
    const keyboardMessageLift = keyboardLift > 0 ? keyboardLift + 18 : 0;
    return baseDock + attachmentLift + voiceLift + speakLift + keyboardMessageLift;
  }, [insets.bottom, keyboardLift, pendingAttachments.length, speakState, voiceState]);

  const chatAvatarSlot = useCallback((size: number) => (
    <AgentAvatar name={displayName} size={size} />
  ), [displayName]);

  const chatEmptyStateContent = useMemo(() => (
    <View style={{ alignItems: 'center', gap: Spacing.sm, paddingTop: 80, paddingHorizontal: Spacing.xl }}>
      <AgentAvatar name={displayName} size={56} />
      <Text style={{ color: theme.text.primary, fontSize: 18, fontWeight: '600', marginTop: Spacing.sm }}>Chat with {displayName}</Text>
      <Text style={{ color: theme.text.secondary, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>Send a message to start the conversation.</Text>
    </View>
  ), [displayName, theme.text.primary, theme.text.secondary]);

  const composerFooter = (
    <View style={s.composerFooterRow}>
      <View style={s.composerFooterLeft}>
        <TouchableOpacity
          onPress={() => { void openAttachmentModal(); }}
          style={s.footerIconButton}
          hitSlop={6}
          activeOpacity={0.7}
        >
          <Text style={s.footerIconButtonText}>＋</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openPermissions} style={s.footerInlineControl} hitSlop={6} activeOpacity={0.7}>
          <Text style={s.footerInlineLabel}>Default permissions</Text>
          <Text style={s.footerInlineChevron}>▾</Text>
        </TouchableOpacity>
      </View>
      <View style={s.composerFooterRight}>
        {liveSession && liveSession.contextWindow > 0 && (
          <View ref={contextAnchorRef} collapsable={false}>
            <ContextUsageBadge
              used={liveSession.usage.contextUsedTokens}
              contextWindow={liveSession.contextWindow}
              compactionCount={liveSession.compactionCount}
              theme={theme}
              onPress={() => {
                setShowModelPicker(false);
                setShowAttachmentModal(false);
                setShowContextPopover((value) => !value);
              }}
            />
          </View>
        )}
        <TouchableOpacity
          ref={modelAnchorRef}
          onPress={() => { setShowAttachmentModal(false); openModelPicker(); }}
          style={s.footerInlineControl}
          hitSlop={6}
          activeOpacity={0.7}
        >
          <Text style={s.footerInlineStrong}>{modelDisplayName}</Text>
          <Text style={s.footerInlineMeta}>{modelIntensityLabel}</Text>
          <Text style={s.footerInlineChevron}>▾</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Floating header height for content offset
  const headerHeight = insets.top + 68;
  const statusOnline = connectionStatus === 'connected' && agent?.status !== 'offline';
  const statusLabel = connectionStatus === 'connecting'
    ? 'Connecting'
    : statusOnline ? 'Online' : 'Offline';
  const headerStatusLabel = statusLabel;
  const headerStatusColor = statusOnline ? theme.success : theme.error;

  return (
    <View style={s.container}>
      {/* Messages */}
      <ChatView
        ref={chatViewRef}
        messages={messages}
        agentName={displayName}
        isLoading={loadingHistory}
        theme={theme}
        colorScheme={colorScheme}
        attachmentCount={pendingAttachments.length}
        onScrollNearTop={loadOlder}
        contentTopPadding={headerHeight}
        contentBottomPadding={chatBottomInset}
        floatingButtonBottomOffset={chatBottomInset + 10}
        showScrollToBottomButton
        avatarSlot={chatAvatarSlot}
        emptyStateContent={chatEmptyStateContent}
      />

      <View style={[s.floatingHeader, { paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View
          style={[
            s.headerShellWrap,
            {
              opacity: shellAnim,
              transform: [{
                translateY: shellAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-12, 0],
                }),
              }],
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={s.headerBar} pointerEvents="box-none">
            <View pointerEvents="auto">
              <LiquidGlassButton
                isDark={isDark}
                onPress={() => router.push(`/(auth)/(drawer)/agents/${agentId}` as any)}
                size={48}
                hitSlop={12}
                reflection={false}
                blur={false}
              >
                <AgentAvatar name={displayName} size={34} />
              </LiquidGlassButton>
            </View>

            <View style={s.headerCenter} pointerEvents="none">
              <Text style={s.agentTitle} numberOfLines={1}>{displayName}</Text>
              {headerStatusLabel ? (
                <View style={s.statusRow}>
                  <View style={[s.statusDot, { backgroundColor: headerStatusColor }]} />
                  <Text style={[s.statusText, { color: headerStatusColor }]}>
                    {headerStatusLabel}
                  </Text>
                </View>
              ) : null}
            </View>

            <View pointerEvents="auto">
              <LiquidGlassButton
                icon="✕"
                isDark={isDark}
                onPress={() => router.back()}
                size={48}
                iconSize={17}
                hitSlop={12}
                reflection={false}
                blur={false}
              />
            </View>
          </View>
        </Animated.View>
      </View>

      {compactionToast && (
        <View style={{ marginHorizontal: Spacing.md, marginTop: Spacing.xs }}>
          <LiquidSurface
            theme={theme}
            isDark={isDark}
            borderRadius={18}
            intensity={46}
            shadow={false}
            reflection={false}
            blur={false}
            contentStyle={{ padding: 11 }}
          >
            <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>↻ Backend chat rotated automatically to keep this thread going.</Text>
          </LiquidSurface>
        </View>
      )}

      {/* Model picker popover — opens upward from composer button */}
      <CustomPopover
        visible={showModelPicker}
        anchorRef={modelAnchorRef}
        onClose={() => setShowModelPicker(false)}
        theme={theme}
        width={290}
        maxHeight={440}
        align="right"
        openUpward
        reflection={false}
        blur={false}
      >
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <PopoverSection title="Intelligence" theme={theme}>
            {([
              { key: 'fast', label: 'Low', subtitle: 'Quick replies' },
              { key: 'all', label: 'Medium', subtitle: 'Balanced default' },
              { key: 'deep', label: 'High', subtitle: 'Reasoning first' },
            ] as const).map((tier) => (
              <PopoverOption
                key={tier.key}
                theme={theme}
                label={tier.label}
                subtitle={tier.subtitle}
                active={modelTier === tier.key}
                compact
                onPress={() => { void applyModelTier(tier.key); }}
              />
            ))}
          </PopoverSection>
          <PopoverSection title="Models" theme={theme}>
            {filteredModels.length === 0 ? (
              availableModels.length === 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm }}>
                  <ActivityIndicator size="small" color={theme.text.secondary} />
                  <Text style={{ color: theme.text.secondary, fontSize: 13 }}>Loading models...</Text>
                </View>
              ) : (
                <Text style={{ color: theme.text.secondary, fontSize: 13, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm }}>
                  No models match this tier yet.
                </Text>
              )
            ) : filteredModels.map((model) => {
              const meta = availableModelDetails.find((e) => e.id === model);
              const display = formatModelName(model);
              const subtitleParts = [
                display.provider,
                meta?.reasoning ? 'Deep reasoning' : 'Fast response',
                meta?.contextWindow ? `${(meta.contextWindow / 1000).toFixed(meta.contextWindow >= 100000 ? 0 : 1)}k ctx` : null,
              ].filter(Boolean);
              return (
                <PopoverOption
                  key={model}
                  theme={theme}
                  label={display.title}
                  subtitle={subtitleParts.join(' · ')}
                  active={currentModel === model}
                  onPress={() => { void handleModelChange(model); }}
                />
              );
            })}
          </PopoverSection>
        </ScrollView>
      </CustomPopover>

      {liveSession && liveSession.contextWindow > 0 && (
        <CustomPopover
          visible={showContextPopover}
          anchorRef={contextAnchorRef}
          onClose={() => setShowContextPopover(false)}
          theme={theme}
          width={248}
          maxHeight={240}
          align="right"
          openUpward
          reflection={false}
          blur={false}
        >
          <PopoverSection title="Context Window" theme={theme}>
            <View style={s.contextPopoverBody}>
              <Text style={s.contextPopoverValue}>
                {liveSession.usage.contextUsedTokens.toLocaleString()} / {liveSession.contextWindow.toLocaleString()}
              </Text>
              <Text style={s.contextPopoverMeta}>{contextPctLabel}</Text>
              <View style={[s.contextPopoverTrack, { backgroundColor: theme.border + '45' }]}>
                <View style={s.contextPopoverTrackInner}>
                  <View style={[s.contextPopoverFill, { width: `${Math.round(usagePct * 100)}%`, backgroundColor: contextColor }]} />
                </View>
              </View>
              <Text style={s.contextPopoverHint}>
                Codex automatically compacts older context to keep the session moving.
              </Text>
              <Text style={s.contextPopoverHint}>
                {liveSession.compactionCount > 0 ? `${liveSession.compactionCount} compactions so far.` : 'No compactions yet.'}
              </Text>
            </View>
          </PopoverSection>
        </CustomPopover>
      )}

      {/* Permissions modal */}
      <Modal visible={showPermissionsModal} transparent animationType="slide" onRequestClose={() => setShowPermissionsModal(false)}>
        <View style={s.modalOverlay}>
          <LiquidSurface
            theme={theme}
            isDark={isDark}
            borderRadius={28}
            intensity={58}
            reflection={false}
            blur={false}
            style={s.modalContent}
            contentStyle={s.modalInner}
          >
            <Text style={s.modalTitle}>Permissions</Text>
            {permissionsLoading ? (
              <ActivityIndicator color={theme.accent} style={{ marginVertical: Spacing.lg }} />
            ) : (
              <ScrollView style={s.modelList} keyboardShouldPersistTaps="handled">
                <View style={s.permissionCard}>
                  <Text style={s.permissionTitle}>Global approval defaults</Text>
                  <Text style={s.permissionHint}>These settings affect how commands are approved across agents.</Text>

                  <Text style={s.permissionLabel}>Security</Text>
                  <View style={s.permissionChips}>
                    {SECURITY_OPTIONS.map((option) => (
                      <TouchableOpacity key={option} style={[s.permissionChip, approvalDefaults.security === option && s.permissionChipActive]} onPress={() => { void updateApprovalSetting('security', option); }} activeOpacity={0.7}>
                        <Text style={[s.permissionChipText, approvalDefaults.security === option && s.permissionChipTextActive]}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.permissionLabel}>Ask</Text>
                  <View style={s.permissionChips}>
                    {ASK_OPTIONS.map((option) => (
                      <TouchableOpacity key={option} style={[s.permissionChip, approvalDefaults.ask === option && s.permissionChipActive]} onPress={() => { void updateApprovalSetting('ask', option); }} activeOpacity={0.7}>
                        <Text style={[s.permissionChipText, approvalDefaults.ask === option && s.permissionChipTextActive]}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.permissionLabel}>Fallback</Text>
                  <View style={s.permissionChips}>
                    {SECURITY_OPTIONS.map((option) => (
                      <TouchableOpacity key={option} style={[s.permissionChip, approvalDefaults.askFallback === option && s.permissionChipActive]} onPress={() => { void updateApprovalSetting('askFallback', option); }} activeOpacity={0.7}>
                        <Text style={[s.permissionChipText, approvalDefaults.askFallback === option && s.permissionChipTextActive]}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={s.permissionCard}>
                  <Text style={s.permissionTitle}>{displayName} allowlist</Text>
                  <Text style={s.permissionHint}>Store command patterns this agent can run without another approval.</Text>
                  <View style={s.allowlistComposer}>
                    <TextInput
                      style={s.allowlistInput}
                      value={allowlistInput}
                      onChangeText={setAllowlistInput}
                      placeholder="/bin/ls"
                      placeholderTextColor={theme.text.secondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity style={s.allowlistAddBtn} onPress={() => { void addAllowlistEntry(); }} activeOpacity={0.8} disabled={!allowlistInput.trim() || savingPermissions}>
                      <Text style={s.allowlistAddText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                  {allowlistEntries.length === 0 ? (
                    <Text style={s.permissionHint}>No saved command patterns for this agent yet.</Text>
                  ) : allowlistEntries.map((entry) => (
                    <View key={entry.id} style={s.allowlistRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={s.allowlistPattern} numberOfLines={1}>{entry.pattern}</Text>
                        {entry.lastUsedCommand ? <Text style={s.allowlistMeta} numberOfLines={1}>{entry.lastUsedCommand}</Text> : null}
                      </View>
                      <TouchableOpacity onPress={() => { void removeAllowlistEntry(entry.id); }} hitSlop={8}>
                        <Text style={{ color: theme.error, fontSize: 16 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
            <TouchableOpacity style={s.modalClose} onPress={() => setShowPermissionsModal(false)}>
              <Text style={s.modalCloseText}>{savingPermissions ? 'Saving…' : 'Close'}</Text>
            </TouchableOpacity>
          </LiquidSurface>
        </View>
      </Modal>

      {/* Context warnings */}
      {(() => {
        if (!liveSession || liveSession.contextWindow <= 0) return null;
        const pct = (liveSession.usage.contextUsedTokens / liveSession.contextWindow) * 100;
        if (pct >= 95 && !warningDismissedRef.current.hard) return <ContextWarningBanner level="hard" theme={theme} />;
        if (pct >= 80 && !warningDismissedRef.current.soft) return <ContextWarningBanner level="soft" theme={theme} />;
        return null;
      })()}

      {/* Slash command menu */}
      <Modal visible={slashMatches.length > 0} transparent animationType="fade" onRequestClose={() => setInput('')}>
        <View style={s.slashModalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setInput('')} />
          <LiquidSurface theme={theme} isDark={isDark} borderRadius={24} intensity={56} reflection={false} blur={false} style={s.slashModal} contentStyle={s.slashModalInner}>
            <View style={s.slashModalHeader}>
              <View>
                <Text style={s.modalTitle}>Commands</Text>
                <Text style={s.modalSubtitle}>Tap a command. Scroll for more.</Text>
              </View>
              <TouchableOpacity onPress={() => setInput('')} hitSlop={8}>
                <Text style={s.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={s.slashModalList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
              {slashMatches.map((action) => (
                <TouchableOpacity
                  key={action.key}
                  style={s.slashRow}
                  onPress={() => {
                    setInput('');
                    if (action.run) {
                      void action.run();
                    } else {
                      setInput(`/${action.key} `);
                    }
                  }}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.slashTitle}>/{action.key}</Text>
                    <Text style={s.slashHint}>{action.hint}</Text>
                  </View>
                  <Text style={s.slashLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </LiquidSurface>
        </View>
      </Modal>

      {/* Attachment modal */}
      <Modal visible={showAttachmentModal} transparent animationType="fade" onRequestClose={() => setShowAttachmentModal(false)}>
        <View style={s.modalOverlay}>
          <LiquidSurface
            theme={theme}
            isDark={isDark}
            borderRadius={28}
            intensity={58}
            reflection={false}
            blur={false}
            style={s.modalContent}
            contentStyle={s.modalInner}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
              <Text style={s.modalTitle}>Attach</Text>
              <TouchableOpacity onPress={() => setShowAttachmentModal(false)} hitSlop={8}>
                <Text style={s.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.md }}>
              {([
                { key: 'camera', label: 'Camera', icon: 'camera' as const },
                { key: 'gallery', label: 'Gallery', icon: 'image' as const },
                { key: 'files', label: 'Files', icon: 'file' as const },
                { key: 'workspace', label: 'Workspace', icon: 'folder' as const },
              ] as const).map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    s.fileOption,
                    attachmentMode === item.key && { borderColor: theme.accent, backgroundColor: `${theme.accent}12` },
                  ]}
                  onPress={() => {
                    if (item.key === 'files') {
                      void pickDeviceFiles();
                      return;
                    }
                    if (item.key === 'workspace') {
                      void openWorkspaceFilePicker();
                      return;
                    }
                    setAttachmentMode(item.key);
                  }}
                  activeOpacity={0.75}
                >
                  <MenuIcon kind={item.icon} color={attachmentMode === item.key ? theme.accent : theme.text.secondary} />
                  <Text style={[s.fileOptionName, attachmentMode === item.key && { color: theme.accent }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {attachmentMode === 'camera' ? (
              <View style={{ gap: 10 }}>
                <View style={{ height: 320, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0B0F14' }}>
                  {cameraPermission?.granted ? (
                    <CameraView ref={cameraRef as any} style={{ flex: 1 }} facing="back" />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }}>
                      <Text style={{ color: theme.text.primary, fontSize: 14, fontWeight: '700', textAlign: 'center' }}>Camera access is needed for live preview.</Text>
                      <TouchableOpacity
                        style={{ backgroundColor: theme.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 }}
                        onPress={() => { void requestCameraPermission(); }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700' }}>Enable Camera</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: theme.text.secondary, fontSize: 12, fontWeight: '600' }}>{pendingAttachments.length} selected</Text>
                  <TouchableOpacity
                    style={{ backgroundColor: theme.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 }}
                    onPress={() => { void captureCameraPhoto(); }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Capture</Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ color: theme.text.secondary, fontSize: 12, lineHeight: 18 }}>Live camera stays on screen. Each capture is added to the queue.</Text>
              </View>
            ) : attachmentMode === 'gallery' ? (
              <View style={{ gap: 10 }}>
                <Text style={{ color: theme.text.secondary, fontSize: 12, lineHeight: 18 }}>Tap a photo to preview it. Use the button below to add or remove it from the queue.</Text>
                {recentImagesLoading ? (
                  <ActivityIndicator color={theme.accent} style={{ marginVertical: Spacing.lg }} />
                ) : recentImages.length === 0 ? (
                  <Text style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18 }}>No recent photos available.</Text>
                ) : (
                  <View style={{ gap: 12 }}>
                    <View style={{ height: 220, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(15,23,42,0.06)', borderWidth: 1, borderColor: 'rgba(15,23,42,0.08)' }}>
                      {selectedGalleryImage ? (
                        <Image source={{ uri: selectedGalleryImage.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                          <Text style={{ color: theme.text.secondary, fontSize: 13, lineHeight: 18, textAlign: 'center' }}>Pick an image below to preview it here.</Text>
                        </View>
                      )}
                    </View>

                    {selectedGalleryImage ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: theme.text.primary, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{selectedGalleryImage.filename}</Text>
                          <Text style={{ color: theme.text.secondary, fontSize: 12 }}>
                            {pendingAttachments.some((a) => a.uri === selectedGalleryImage.uri) ? 'Queued' : 'Not queued'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={{ backgroundColor: theme.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 }}
                          onPress={() => { void attachRecentImage(selectedGalleryImage.id); }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700' }}>
                            {pendingAttachments.some((a) => a.uri === selectedGalleryImage.uri) ? 'Remove from queue' : 'Add to queue'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {recentImages.map((img) => {
                          const selected = pendingAttachments.some((a) => a.uri === img.uri);
                          const isPreview = selectedGalleryImage?.uri === img.uri;
                          return (
                            <TouchableOpacity
                              key={img.id}
                              onPress={() => { previewRecentImage(img.id); }}
                              activeOpacity={0.85}
                              style={{ width: '23%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 2, borderColor: isPreview ? theme.accent : selected ? 'rgba(59,130,246,0.75)' : 'transparent' }}
                            >
                              <Image source={{ uri: img.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                              {selected ? (
                                <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>
                                </View>
                              ) : null}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                )}
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <Text style={{ color: theme.text.secondary, fontSize: 12, lineHeight: 18 }}>
                  {attachmentMode === 'files' ? 'Multiple document selection is supported.' : 'Tap workspace files to preview and attach them.'}
                </Text>
                <TouchableOpacity
                  style={{ alignSelf: 'flex-start', backgroundColor: theme.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 }}
                  onPress={() => {
                    if (attachmentMode === 'files') {
                      void pickDeviceFiles();
                    } else {
                      void openWorkspaceFilePicker();
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{attachmentMode === 'files' ? 'Pick files' : 'Open workspace picker'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {pendingAttachments.length > 0 ? (
              <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(15,23,42,0.08)', gap: 8 }}>
                <Text style={{ color: theme.text.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>Queued ({pendingAttachments.length})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {pendingAttachments.map((a) => (
                      <View key={a.id} style={{ width: 76, gap: 6 }}>
                        <View style={{ width: 76, height: 76, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(15,23,42,0.06)', borderWidth: 1, borderColor: 'rgba(15,23,42,0.08)' }}>
                          {a.type === 'image' ? (
                            <Image source={{ uri: a.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          ) : (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                              <MenuIcon kind={a.type === 'file' ? 'file' : 'folder'} color={theme.text.secondary} />
                            </View>
                          )}
                          <TouchableOpacity
                            onPress={() => removeAttachment(a.id)}
                            style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#111318', alignItems: 'center', justifyContent: 'center' }}
                            activeOpacity={0.8}
                          >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>×</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={{ color: theme.text.primary, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{a.name}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ) : null}
          </LiquidSurface>
        </View>
      </Modal>

      {/* Workspace file picker modal */}
      <Modal visible={showFilePicker} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <LiquidSurface
            theme={theme}
            isDark={isDark}
            borderRadius={28}
            intensity={58}
            reflection={false}
            blur={false}
            style={s.modalContent}
            contentStyle={s.modalInner}
          >
            <View style={s.fileBrowserHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>Workspace files</Text>
                <Text style={s.modalSubtitle}>Tap a file to preview it, then attach from inside the modal.</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFilePicker(false)} hitSlop={8}>
                <Text style={s.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={s.searchBar}>
              <Text style={s.searchIcon}>⌕</Text>
              <TextInput
                value={workspaceSearch}
                onChangeText={setWorkspaceSearch}
                placeholder="Search files"
                placeholderTextColor={theme.text.secondary}
                style={s.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={s.fileStatsRow}>
              <View style={s.fileStatPill}><Text style={s.fileStatValue}>{workspaceFiles.length}</Text><Text style={s.fileStatLabel}>Files</Text></View>
              <View style={s.fileStatPill}><Text style={s.fileStatValue}>{filteredWorkspaceFiles.length}</Text><Text style={s.fileStatLabel}>Visible</Text></View>
              <View style={s.fileStatPill}><Text style={s.fileStatValue}>{pendingAttachments.length}</Text><Text style={s.fileStatLabel}>Queued</Text></View>
            </View>

            {loadingFiles ? (
              <ActivityIndicator color={theme.accent} style={{ marginVertical: Spacing.lg }} />
            ) : (
              <View style={s.workspaceBrowser}>
                <ScrollView style={s.workspaceList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {filteredWorkspaceFiles.length === 0 && (
                    <View style={s.emptyWorkspaceWrap}>
                      <Text style={s.emptyWorkspaceTitle}>No files match that search.</Text>
                      <Text style={s.emptyWorkspaceSubtitle}>Try a different filename or preview keyword.</Text>
                    </View>
                  )}

                  {filteredWorkspaceFiles.map((file) => {
                    const isSelected = selectedWorkspaceFile?.filename === file.filename;
                    const isAttached = Boolean(pendingAttachments.find((a) => a.name === file.filename));
                    return (
                      <TouchableOpacity
                        key={file.filename}
                        style={[s.workspaceRow, isSelected && s.workspaceRowActive]}
                        onPress={() => { void openWorkspaceFile(file); }}
                        activeOpacity={0.78}
                      >
                        <View style={s.workspaceRowIcon}>
                          <MenuIcon kind="file" color={isSelected ? theme.accent : theme.text.secondary} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.workspaceRowName} numberOfLines={1}>{file.filename}</Text>
                          <Text style={s.workspaceRowPreview} numberOfLines={2}>{file.preview || 'Open to preview this file.'}</Text>
                        </View>
                        <View style={s.workspaceRowMeta}>
                          {isAttached ? <Text style={s.workspaceAttached}>Added</Text> : null}
                          {isSelected ? <Text style={s.workspaceSelected}>View</Text> : <Text style={s.workspaceChevron}>›</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={s.workspacePreviewPane}>
                  {selectedWorkspaceFile ? (
                    <>
                      <View style={s.previewPaneHeader}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.previewPaneTitle} numberOfLines={1}>{selectedWorkspaceFile.filename}</Text>
                          <Text style={s.previewPaneMeta}>{selectedWorkspaceContent.length ? `${selectedWorkspaceContent.length.toLocaleString()} chars` : 'Live preview'}</Text>
                        </View>
                        {pendingAttachments.find((a) => a.name === selectedWorkspaceFile.filename) ? (
                          <Text style={s.previewPaneBadge}>Queued</Text>
                        ) : null}
                      </View>

                      <View style={s.previewPaneBody}>
                        {selectedWorkspaceLoading ? (
                          <ActivityIndicator color={theme.accent} style={{ marginVertical: Spacing.lg }} />
                        ) : (
                          <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={s.previewPaneText} selectable>
                              {selectedWorkspaceContent || selectedWorkspaceFile.preview || 'No preview available for this file.'}
                            </Text>
                          </ScrollView>
                        )}
                      </View>

                      <TouchableOpacity
                        style={[s.previewAttachBtn, pendingAttachments.find((a) => a.name === selectedWorkspaceFile.filename) && s.previewAttachBtnDisabled]}
                        onPress={() => { void attachSelectedWorkspaceFile(); }}
                        activeOpacity={0.8}
                      >
                        <Text style={s.previewAttachBtnText}>
                          {pendingAttachments.find((a) => a.name === selectedWorkspaceFile.filename) ? 'Already attached' : 'Attach file'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={s.previewPaneEmpty}>
                      <Text style={s.previewPaneEmptyTitle}>Preview a file here</Text>
                      <Text style={s.previewPaneEmptyText}>Pick any workspace file to inspect it without leaving the modal.</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </LiquidSurface>
        </View>
      </Modal>

      {/* Input composer */}
      <ChatComposer
        value={input}
        onChangeText={setInput}
        onSend={handleSend}
        isStreaming={isStreaming}
        onAbort={abort}
        onAttachPress={() => { void openAttachmentModal(); }}
        onPhotoPress={() => { void openAttachmentModal(); }}
        onVoicePress={() => { void startVoiceNote(); }}
        onVoiceSend={() => { void stopVoiceNote(); }}
        onSpeakPress={() => { void startSpeakMode(); }}
        onSpeakExit={stopSpeakMode}
        voiceState={voiceState}
        voiceDurationLabel={voiceDurationLabel}
        voiceMeterLevel={voiceMeterLevel}
        voiceMeterTick={voiceRecorderState.durationMillis}
        speakState={speakState}
        speakTranscript={speakTranscript}
        placeholder={voiceState === 'recording' ? `Recording a voice note for ${displayName}...` : 'Ask anything'}
        theme={theme}
        isDark={isDark}
        insets={insets}
        attachments={pendingAttachments}
        onRemoveAttachment={removeAttachment}
        footerContent={composerFooter}
      />
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.surface },

  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
  },
  headerShellWrap: {
    paddingHorizontal: Spacing.md,
  },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm + 6, paddingBottom: Spacing.xs + 2,
    minHeight: 56,
  },
  headerCenter: {
    flex: 1, alignItems: 'center', gap: 4,
  },
  agentTitle: {
    color: t.text.primary,
    fontSize: 17,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.24)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(4,6,12,0.22)', justifyContent: 'flex-end', paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm },
  modalContent: { maxHeight: '86%' },
  modalInner: { padding: Spacing.lg },
  modalTitle: { color: t.text.primary, fontSize: 18, fontWeight: '700', marginBottom: Spacing.md },
  modalSubtitle: { color: t.text.secondary, fontSize: 12, lineHeight: 17, marginTop: -Spacing.xs, paddingRight: Spacing.md },
  modelList: { maxHeight: 380 },
  modalClose: { marginTop: Spacing.md, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.06)' },
  modalCloseText: { color: t.text.secondary, fontSize: 15, fontWeight: '600' },
  fileBrowserHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: Spacing.md },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 10, marginBottom: Spacing.sm },
  searchIcon: { color: t.text.secondary, fontSize: 14, fontWeight: '700' },
  searchInput: { flex: 1, color: t.text.primary, fontSize: 13, paddingVertical: 0 },
  fileStatsRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.sm },
  fileStatPill: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 10, paddingHorizontal: 12 },
  fileStatValue: { color: t.text.primary, fontSize: 15, fontWeight: '700' },
  fileStatLabel: { color: t.text.secondary, fontSize: 11, fontWeight: '600', marginTop: 2 },
  workspaceBrowser: { flex: 1, minHeight: 380, gap: Spacing.sm },
  workspaceList: { maxHeight: 260 },
  workspaceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8 },
  workspaceRowActive: { borderColor: t.accent + '66', backgroundColor: t.accent + '14' },
  workspaceRowIcon: { width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  workspaceRowName: { color: t.text.primary, fontSize: 13, fontWeight: '700' },
  workspaceRowPreview: { color: t.text.secondary, fontSize: 11, lineHeight: 15, marginTop: 2 },
  workspaceRowMeta: { alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  workspaceAttached: { color: t.accent, fontSize: 11, fontWeight: '700' },
  workspaceSelected: { color: t.text.primary, fontSize: 11, fontWeight: '700' },
  workspaceChevron: { color: t.text.secondary, fontSize: 18, lineHeight: 18, fontWeight: '300' },
  emptyWorkspaceWrap: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  emptyWorkspaceTitle: { color: t.text.primary, fontSize: 14, fontWeight: '700' },
  emptyWorkspaceSubtitle: { color: t.text.secondary, fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 16 },
  workspacePreviewPane: { flex: 1, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)', padding: 12 },
  previewPaneHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  previewPaneTitle: { color: t.text.primary, fontSize: 14, fontWeight: '700' },
  previewPaneMeta: { color: t.text.secondary, fontSize: 11, marginTop: 2 },
  previewPaneBadge: { color: t.accent, fontSize: 11, fontWeight: '700' },
  previewPaneBody: { flex: 1, minHeight: 150, borderRadius: 14, backgroundColor: 'rgba(4,6,12,0.14)', padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' },
  previewPaneText: { color: t.text.primary, fontSize: 12, lineHeight: 18 },
  previewAttachBtn: { marginTop: 10, borderRadius: 14, alignItems: 'center', paddingVertical: 12, backgroundColor: t.accent },
  previewAttachBtnDisabled: { opacity: 0.55 },
  previewAttachBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  previewPaneEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  previewPaneEmptyTitle: { color: t.text.primary, fontSize: 14, fontWeight: '700' },
  previewPaneEmptyText: { color: t.text.secondary, fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 16 },

  permissionCard: { backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 18, padding: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)', gap: 10, marginBottom: Spacing.md },
  permissionTitle: { color: t.text.primary, fontSize: 14, fontWeight: '700' },
  permissionHint: { color: t.text.secondary, fontSize: 12, lineHeight: 17 },
  permissionLabel: { color: t.text.secondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  permissionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  permissionChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.08)' },
  permissionChipActive: { backgroundColor: t.accent + '1f', borderColor: t.accent + '66' },
  permissionChipText: { color: t.text.secondary, fontSize: 12, fontWeight: '600' },
  permissionChipTextActive: { color: t.accent },
  allowlistComposer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  allowlistInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', color: t.text.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  allowlistAddBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: t.accent },
  allowlistAddText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  allowlistRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  allowlistPattern: { color: t.text.primary, fontSize: 13, fontWeight: '600' },
  allowlistMeta: { color: t.text.secondary, fontSize: 11 },

  fileOption: { paddingVertical: 12, paddingHorizontal: Spacing.md, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)' },
  fileOptionName: { color: t.text.primary, fontSize: 14, fontWeight: '600' },
  fileOptionPreview: { color: t.text.secondary, fontSize: 12, marginTop: 1 },

  emptyWrap: { alignItems: 'center', gap: Spacing.sm, paddingTop: 80, paddingHorizontal: Spacing.xl },
  emptyTitle: { color: t.text.primary, fontSize: 18, fontWeight: '600', marginTop: Spacing.sm },
  emptySubtitle: { color: t.text.secondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  slashModalOverlay: { flex: 1, backgroundColor: 'rgba(4,6,12,0.30)', justifyContent: 'center', paddingHorizontal: Spacing.md },
  slashModal: { maxHeight: '72%', borderRadius: 24 },
  slashModalInner: { padding: Spacing.lg, gap: Spacing.sm },
  slashModalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  slashModalList: { maxHeight: 420 },
  slashMenuWrap: { position: 'absolute', left: Spacing.md, right: Spacing.md, zIndex: 20 },
  slashMenu: { borderRadius: 20 },
  slashRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.md, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  slashTitle: { color: t.text.primary, fontSize: 13, fontWeight: '700' },
  slashHint: { color: t.text.secondary, fontSize: 11, marginTop: 2 },
  slashLabel: { color: t.accent, fontSize: 12, fontWeight: '600' },

  contextPopoverBody: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm, gap: 8 },
  contextPopoverValue: { color: t.text.primary, fontSize: 18, fontWeight: '700' },
  contextPopoverMeta: { color: t.text.secondary, fontSize: 12, fontWeight: '600' },
  contextPopoverTrack: { width: '100%', height: 8, borderRadius: 999, overflow: 'hidden' },
  contextPopoverTrackInner: { flex: 1, margin: 1.5, borderRadius: 999, overflow: 'hidden' },
  contextPopoverFill: { height: '100%', borderRadius: 999 },
  contextPopoverHint: { color: t.text.secondary, fontSize: 12, lineHeight: 17 },

  composerFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  composerFooterLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  composerFooterRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  footerPill: { minHeight: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.34)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerWidePill: { flex: 1 },
  footerPillText: { color: t.text.secondary, fontSize: 12, fontWeight: '500', flexShrink: 1 },
  footerPillChevron: { color: t.text.secondary, fontSize: 10, marginLeft: 2 },
  footerIconButton: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  footerIconButtonText: { color: t.text.secondary, fontSize: 20, lineHeight: 20, fontWeight: '300' },
  footerInlineControl: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 24, paddingHorizontal: 2 },
  footerInlineLabel: { color: t.text.secondary, fontSize: 12, fontWeight: '500' },
  footerInlineStrong: { color: t.text.primary, fontSize: 13, fontWeight: '600' },
  footerInlineMeta: { color: t.text.secondary, fontSize: 12, fontWeight: '500' },
  footerInlineChevron: { color: t.text.secondary, fontSize: 10, marginTop: 1 },
  voiceIndicatorIcon: { width: 16, alignItems: 'center', justifyContent: 'center' },
  voiceIndicatorDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: t.error },
  voiceActivePill: { backgroundColor: t.error + '18', borderColor: t.error + '50' },
  voiceProcessingPill: { backgroundColor: t.accent + '14', borderColor: t.accent + '40' },
  voiceActiveText: { color: t.error },
});
