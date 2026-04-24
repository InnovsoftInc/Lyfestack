import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useOpenClawStore } from '../stores/openclaw.store';
import type { ChatMessage, ChatAttachment } from '../stores/openclaw.store';
import { openclawApi } from '../services/openclaw.api';

const PAGE_SIZE = 50;

const TIMESTAMP_RE = /^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+\w+\]\s*/;

function buildServerMessageId(message: any): string {
  if (message.id) return `msg-${message.id}`;
  if (typeof message.index === 'number') return `msg-${message.index}-${message.role}`;
  const stripped = String(message.content ?? '').replace(TIMESTAMP_RE, '').trim().slice(0, 80);
  const base = `${message.timestamp ?? 'na'}:${message.role}:${stripped}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0;
  }
  return `msg-fallback-${Math.abs(hash)}`;
}

function mapMessage(m: any): ChatMessage {
  return {
    id: buildServerMessageId(m),
    role: m.role === 'user' ? 'user' : 'agent',
    content: m.content,
    timestamp: m.timestamp ?? new Date().toISOString(),
  };
}

type SessionRef = {
  key: string;
  oldestIndex: number;
  newestIndex: number;
  total: number;
  compactionCount: number;
};

export function useChatEngine(agentName: string) {
  const {
    activeChat, openChat, sendMessageStream, abortStream, streamAbort,
    setCurrentSession, updateSessionUsage, appendChatMessages, prependChatMessages,
    loadAgentSessions, newSession, deleteSession, currentSession, agentSessions,
  } = useOpenClawStore();

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [compactionToast, setCompactionToast] = useState(false);

  const sessionRef = useRef<SessionRef | null>(null);
  const loadingOlderRef = useRef(false);
  const warningDismissedRef = useRef<{ soft: boolean; hard: boolean }>({ soft: false, hard: false });

  const loadSession = useCallback(async (key: string, opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoadingHistory(true);
    try {
      const sessionRes: any = await openclawApi.getSession(key, { limit: PAGE_SIZE });
      const data = sessionRes.data ?? {};
      const messages: ChatMessage[] = (data.messages ?? []).map(mapMessage);
      const [agentId] = key.split('/');
      const sessionId = key.slice((agentId?.length ?? 0) + 1);
      sessionRef.current = {
        key,
        oldestIndex: data.firstIndex ?? -1,
        newestIndex: data.lastIndex ?? -1,
        total: data.total ?? messages.length,
        compactionCount: data.compactionCount ?? 0,
      };
      warningDismissedRef.current = { soft: false, hard: false };
      const store = useOpenClawStore.getState();
      store.setCurrentSession({
        key,
        agentId: agentId ?? agentName,
        sessionId,
        model: data.model ?? '',
        contextWindow: data.contextWindow ?? 0,
        usage: data.usage ?? {
          totalTokens: 0, lastInputTokens: 0, lastOutputTokens: 0,
          lastCacheReadTokens: 0, contextUsedTokens: 0, totalTokensFresh: false,
        },
        compactionCount: data.compactionCount ?? 0,
      });
      useOpenClawStore.setState({ activeChat: { agentName, sessionKey: key, messages } });
    } catch { /* ignore — next poll will retry */ }
    finally { if (!opts.silent) setLoadingHistory(false); }
  }, [agentName]);

  const loadOlder = useCallback(async () => {
    const sref = sessionRef.current;
    if (!sref || loadingOlderRef.current) return;
    if (sref.oldestIndex <= 0) return;
    loadingOlderRef.current = true;
    try {
      const res: any = await openclawApi.getSession(sref.key, {
        beforeIndex: sref.oldestIndex,
        limit: PAGE_SIZE,
      });
      const data = res.data ?? {};
      const messages: ChatMessage[] = (data.messages ?? []).map(mapMessage);
      if (messages.length) {
        sref.oldestIndex = data.firstIndex ?? sref.oldestIndex;
        useOpenClawStore.getState().prependChatMessages(agentName, sref.key, messages);
      } else {
        sref.oldestIndex = 0;
      }
    } catch { /* retry on next scroll */ }
    finally { loadingOlderRef.current = false; }
  }, [agentName]);

  const send = useCallback(async (message: string, attachments: ChatAttachment[]) => {
    await sendMessageStream(agentName, message, attachments);
  }, [agentName, sendMessageStream]);

  useEffect(() => {
    openChat(agentName);
    let cancelled = false;
    sessionRef.current = null;

    let appIsActive = AppState.currentState === 'active';
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      appIsActive = nextState === 'active';
    });

    const initial = async () => {
      setLoadingHistory(true);
      try {
        const sessions = await useOpenClawStore.getState().loadAgentSessions(agentName);
        if (cancelled) return;
        let key = sessions[0]?.key ?? null;
        if (!key) {
          const created = await useOpenClawStore.getState().newSession(agentName);
          key = created?.key ?? null;
        }
        if (!key || cancelled) { setLoadingHistory(false); return; }
        await loadSession(key);
      } catch { setLoadingHistory(false); }
    };

    const syncTail = async () => {
      if (!appIsActive) return;
      const sref = sessionRef.current;
      if (!sref) return;
      const storeState = useOpenClawStore.getState() as any;
      if (storeState.streamAbort || storeState.resumeAbort) return;
      try {
        const res: any = await openclawApi.getSession(sref.key, { afterIndex: sref.newestIndex });
        if (cancelled) return;
        const data = res.data ?? {};
        const messages: ChatMessage[] = (data.messages ?? []).map(mapMessage);
        if (messages.length) {
          sref.newestIndex = data.lastIndex ?? sref.newestIndex;
          sref.total = data.total ?? sref.total;
          useOpenClawStore.getState().appendChatMessages(agentName, sref.key, messages);
        }
        const store = useOpenClawStore.getState();
        if (store.currentSession?.key === sref.key) {
          store.updateSessionUsage({
            usage: data.usage ?? store.currentSession.usage,
            compactionCount: data.compactionCount ?? store.currentSession.compactionCount,
            model: data.model ?? store.currentSession.model,
            contextWindow: data.contextWindow ?? store.currentSession.contextWindow,
          });
        }
        if ((data.compactionCount ?? 0) > sref.compactionCount) {
          sref.compactionCount = data.compactionCount;
          warningDismissedRef.current = { soft: false, hard: false };
          setCompactionToast(true);
          setTimeout(() => setCompactionToast(false), 4500);
        }
      } catch { /* next tick */ }
    };

    void initial();
    const interval = setInterval(syncTail, 3000);

    const store = useOpenClawStore.getState() as any;
    if (store.hasResumableStream(agentName) && !store.streamAbort && !store.resumeAbort) {
      void store.resumeActiveStream();
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [agentName, loadSession, openChat]);

  const messages = activeChat?.messages ?? [];
  const isStreaming = !!streamAbort;

  return {
    messages,
    isStreaming,
    loadingHistory,
    compactionToast,
    warningDismissedRef,
    sessionRef,
    send,
    abort: abortStream,
    loadSession,
    loadOlder,
    sessions: agentSessions,
    currentSession,
    loadAgentSessions,
    newSession,
    deleteSession,
  };
}
