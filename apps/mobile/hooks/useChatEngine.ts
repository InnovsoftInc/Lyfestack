import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useOpenClawStore } from '../stores/openclaw.store';
import type { ChatMessage, ChatAttachment } from '../stores/openclaw.store';
import { openclawApi } from '../services/openclaw.api';

const PAGE_SIZE = 50;

// Phase 2: the chat screen is driven by a LyfeStack thread rather than a raw
// OpenClaw session. A thread owns the visible message history and points at a
// current runtime session; the server automatically rolls sessions over before
// they compact, so a single thread spans many sessions.
//
// The session picker remains an advanced UX affordance — users can still drop
// into "session-view" mode to inspect / delete an individual backend session.
// That legacy path uses sessionRef for pagination; thread mode uses the
// thread's message ids (oldest/newest) instead.

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

function mapSessionMessage(m: any): ChatMessage {
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
    appendChatMessages, prependChatMessages,
    loadThread, syncThreadTail, loadOlderThreadMessages,
    rolloverThread: rolloverActiveThread,
    loadAgentSessions, newSession, deleteSession, currentSession, agentSessions,
  } = useOpenClawStore();

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [compactionToast, setCompactionToast] = useState(false);

  // session-view mode ref — non-null only when the user has jumped into a
  // specific backend session via the advanced session picker.
  const sessionRef = useRef<SessionRef | null>(null);
  const loadingOlderRef = useRef(false);
  const warningDismissedRef = useRef<{ soft: boolean; hard: boolean }>({ soft: false, hard: false });
  // track compaction across poll ticks in thread mode
  const threadCompactionRef = useRef<number>(0);

  const showCompactionToast = useCallback(() => {
    warningDismissedRef.current = { soft: false, hard: false };
    setCompactionToast(true);
    setTimeout(() => setCompactionToast(false), 4500);
  }, []);

  const loadSession = useCallback(async (key: string, opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoadingHistory(true);
    try {
      const sessionRes: any = await openclawApi.getSession(key, { limit: PAGE_SIZE });
      const data = sessionRes.data ?? {};
      const messages: ChatMessage[] = (data.messages ?? []).map(mapSessionMessage);
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
      // Drop into session-view mode — temporarily replaces thread messages
      // with the raw session's messages for inspection.
      useOpenClawStore.setState({
        activeChat: {
          agentName,
          threadId: null,
          activeSessionKey: key,
          messages,
        },
      });
    } catch { /* ignore — next poll will retry */ }
    finally { if (!opts.silent) setLoadingHistory(false); }
  }, [agentName]);

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    try {
      // Session-view mode paginates by backend session index.
      const sref = sessionRef.current;
      if (sref) {
        if (sref.oldestIndex <= 0) return;
        const res: any = await openclawApi.getSession(sref.key, {
          beforeIndex: sref.oldestIndex,
          limit: PAGE_SIZE,
        });
        const data = res.data ?? {};
        const messages: ChatMessage[] = (data.messages ?? []).map(mapSessionMessage);
        if (messages.length) {
          sref.oldestIndex = data.firstIndex ?? sref.oldestIndex;
          useOpenClawStore.getState().prependChatMessages(agentName, messages);
        } else {
          sref.oldestIndex = 0;
        }
        return;
      }
      // Thread mode paginates by thread message id.
      await loadOlderThreadMessages(agentName);
    } catch { /* retry on next scroll */ }
    finally { loadingOlderRef.current = false; }
  }, [agentName, loadOlderThreadMessages]);

  const send = useCallback(async (message: string, attachments: ChatAttachment[]) => {
    await sendMessageStream(agentName, message, attachments);
    // If we were peeking at a raw session, snap back to thread mode once a new
    // message is sent so we see the canonical continuous history.
    if (sessionRef.current) {
      sessionRef.current = null;
      await loadThread(agentName, { limit: PAGE_SIZE });
    }
  }, [agentName, sendMessageStream, loadThread]);

  // Rollover the thread (create a fresh backend session under the same thread)
  // and pull the updated thread state so currentSession reflects the new key.
  const rolloverThread = useCallback(async () => {
    const key = await rolloverActiveThread(agentName);
    if (key) {
      await loadThread(agentName, { limit: PAGE_SIZE });
      sessionRef.current = null;
      showCompactionToast();
    }
    return key;
  }, [agentName, rolloverActiveThread, loadThread, showCompactionToast]);

  useEffect(() => {
    openChat(agentName);
    let cancelled = false;
    sessionRef.current = null;
    threadCompactionRef.current = 0;

    let appIsActive = AppState.currentState === 'active';
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      const wasActive = appIsActive;
      appIsActive = nextState === 'active';

      if (!appIsActive || cancelled) return;

      const store = useOpenClawStore.getState() as any;
      if (!wasActive && store.hasResumableStream(agentName) && !store.streamAbort && !store.resumeAbort) {
        void store.resumeActiveStream();
        return;
      }

      if (!wasActive) {
        if (sessionRef.current) {
          void syncSessionTail();
        } else {
          void syncThreadTail(agentName);
        }
      }
    });

    const initial = async () => {
      setLoadingHistory(true);
      try {
        const detail = await loadThread(agentName, { limit: PAGE_SIZE });
        if (cancelled) return;
        threadCompactionRef.current = detail?.activeSession?.compactionCount ?? 0;
        warningDismissedRef.current = { soft: false, hard: false };
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };

    const syncSessionTail = async () => {
      const sref = sessionRef.current;
      if (!sref) return;
      try {
        const res: any = await openclawApi.getSession(sref.key, { afterIndex: sref.newestIndex });
        if (cancelled) return;
        const data = res.data ?? {};
        const messages: ChatMessage[] = (data.messages ?? []).map(mapSessionMessage);
        if (messages.length) {
          sref.newestIndex = data.lastIndex ?? sref.newestIndex;
          sref.total = data.total ?? sref.total;
          useOpenClawStore.getState().appendChatMessages(agentName, messages);
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
          showCompactionToast();
        }
      } catch { /* next tick */ }
    };

    const syncTail = async () => {
      if (!appIsActive) return;
      const storeState = useOpenClawStore.getState() as any;
      if (storeState.streamAbort || storeState.resumeAbort) return;

      if (sessionRef.current) {
        await syncSessionTail();
        return;
      }

      // Thread mode — poll the thread, and notice if the server rolled the
      // active session over while we weren't looking (e.g. during a stream).
      const prevKey = useOpenClawStore.getState().currentSession?.key ?? null;
      await syncThreadTail(agentName);
      if (cancelled) return;
      const session = useOpenClawStore.getState().currentSession;
      if (!session) return;
      if (prevKey && session.key !== prevKey) {
        threadCompactionRef.current = session.compactionCount ?? 0;
        showCompactionToast();
        return;
      }
      if ((session.compactionCount ?? 0) > threadCompactionRef.current) {
        threadCompactionRef.current = session.compactionCount ?? 0;
        showCompactionToast();
      }
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
  }, [agentName, loadThread, syncThreadTail, openChat, showCompactionToast]);

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
    rolloverThread,
    sessions: agentSessions,
    currentSession,
    loadAgentSessions,
    newSession,
    deleteSession,
    // silence unused-var when the caller doesn't need direct access
    _appendChatMessages: appendChatMessages,
    _prependChatMessages: prependChatMessages,
  };
}
