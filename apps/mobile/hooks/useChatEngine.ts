import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useOpenClawStore } from '../stores/openclaw.store';
import type { ChatAttachment } from '../stores/openclaw.store';

const PAGE_SIZE = 50;

// Chat is a Lyfestack-visible transcript. OpenClaw owns sessions, memory,
// compression, and usage internally.

export function useChatEngine(agentName: string) {
  const {
    activeChat, openChat, sendMessageStream, abortStream, streamAbort,
    activeStream, resumeAbort,
    loadThread, syncThreadTail, loadOlderThreadMessages, recoverActiveStream, refreshCurrentSession,
  } = useOpenClawStore();

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [compactionToast, setCompactionToast] = useState(false);

  const loadingOlderRef = useRef(false);
  const warningDismissedRef = useRef<{ soft: boolean; hard: boolean }>({ soft: false, hard: false });

  const showCompactionToast = useCallback(() => {
    warningDismissedRef.current = { soft: false, hard: false };
    setCompactionToast(true);
    setTimeout(() => setCompactionToast(false), 4500);
  }, []);

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    try {
      await loadOlderThreadMessages(agentName);
    } catch { /* retry on next scroll */ }
    finally { loadingOlderRef.current = false; }
  }, [agentName, loadOlderThreadMessages]);

  const send = useCallback(async (message: string, attachments: ChatAttachment[]) => {
    await sendMessageStream(agentName, message, attachments);
  }, [agentName, sendMessageStream]);

  useEffect(() => {
    openChat(agentName);
    let cancelled = false;

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

      if (!wasActive) void syncThreadTail(agentName);
    });

    const initial = async () => {
      setLoadingHistory(true);
      try {
        await loadThread(agentName, { limit: PAGE_SIZE });
        if (cancelled) return;
        void refreshCurrentSession(agentName);
        const store = useOpenClawStore.getState() as any;
        if (store.hasResumableStream(agentName) && !store.streamAbort && !store.resumeAbort) {
          void store.resumeActiveStream();
        } else {
          void recoverActiveStream(agentName);
        }
        warningDismissedRef.current = { soft: false, hard: false };
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };

    void initial();

    const store = useOpenClawStore.getState() as any;
    if (store.hasResumableStream(agentName) && !store.streamAbort && !store.resumeAbort) {
      void store.resumeActiveStream();
    } else if (!store.streamAbort && !store.resumeAbort) {
      void recoverActiveStream(agentName);
    }

    return () => {
      cancelled = true;
      appStateSub.remove();
    };
  }, [agentName, loadThread, syncThreadTail, openChat, recoverActiveStream, refreshCurrentSession]);

  const messages = activeChat?.messages ?? [];
  const hasLiveStreamingMessage = Boolean(
    activeChat?.agentName === agentName
    && messages.some((m) => m.role === 'agent' && m.streaming),
  );
  const isStreaming = hasLiveStreamingMessage;

  return {
    messages,
    isStreaming,
    loadingHistory,
    compactionToast,
    warningDismissedRef,
    send,
    abort: abortStream,
    loadOlder,
  };
}
