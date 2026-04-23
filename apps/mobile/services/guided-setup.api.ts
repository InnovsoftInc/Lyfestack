import { request, getApiBase, getAuthToken } from './api';

export interface GuidedQuestion {
  sessionId: string;
  step: number;
  estimatedTotalSteps: number;
  question: string;
  context?: string;
  inputType: 'text' | 'select' | 'multiselect' | 'slider' | 'number' | 'toggle';
  options?: string[];
  min?: number;
  max?: number;
  default?: number;
  unit?: string;
  placeholder?: string;
  isLastQuestion?: boolean;
}

export interface GeneratedPlanTask {
  title: string;
  description: string;
  estimatedMinutes: number;
  dayOffset: number;
}

export interface GeneratedPlanMilestone {
  title: string;
  description: string;
  dueDayOffset: number;
  tasks: GeneratedPlanTask[];
}

export interface GeneratedPlan {
  goalTitle: string;
  goalDescription: string;
  estimatedDurationDays: number;
  milestones: GeneratedPlanMilestone[];
  insights: string[];
}

export interface SSEEvent {
  type: 'thinking' | 'progress' | 'complete' | 'error';
  message?: string;
  plan?: GeneratedPlan;
  sessionId?: string;
  templateId?: string;
}

export interface SSEConnection {
  close: () => void;
}

export async function startSession(templateId: string): Promise<GuidedQuestion> {
  const res = await request<{ question: GuidedQuestion }>('/goals/guided-setup/start', {
    method: 'POST',
    body: { templateId },
  });
  return res.question;
}

export async function submitAnswer(sessionId: string, answer: string): Promise<GuidedQuestion> {
  const res = await request<{ question: GuidedQuestion }>('/goals/guided-setup/answer', {
    method: 'POST',
    body: { sessionId, answer },
  });
  return res.question;
}

/**
 * Connects to the SSE plan generation endpoint via XHR (compatible with React Native / Hermes).
 * Returns a connection handle with a `close()` method.
 */
export function connectSSE(
  sessionId: string,
  onEvent: (event: SSEEvent) => void,
  onError: (error: Error) => void,
): SSEConnection {
  let isClosed = false;
  let xhr: XMLHttpRequest | null = null;

  void (async () => {
    const base = await getApiBase();
    const token = await getAuthToken();
    const url = `${base}/goals/guided-setup/generate/${sessionId}`;

    xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Cache-Control', 'no-cache');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    let cursor = 0;

    xhr.onprogress = () => {
      if (isClosed || !xhr) return;
      const chunk = xhr.responseText.slice(cursor);
      cursor = xhr.responseText.length;

      const lines = chunk.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (!dataStr) continue;
        try {
          const event = JSON.parse(dataStr) as SSEEvent;
          onEvent(event);
        } catch { /* malformed chunk */ }
      }
    };

    xhr.onerror = () => {
      if (!isClosed) onError(new Error('SSE connection failed'));
    };

    xhr.onloadend = () => {
      if (!isClosed && xhr && xhr.status !== 200) {
        onError(new Error(`SSE request failed with status ${xhr.status}`));
      }
    };

    xhr.send();
  })();

  return {
    close() {
      isClosed = true;
      xhr?.abort();
    },
  };
}
