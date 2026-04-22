import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { User, Goal, DailyBrief, AgentAction } from '@lyfestack/shared';

const API_BASE_KEY = '@lyfestack_api_base';
const AUTH_TOKEN_KEY = 'lyfestack_auth_token';

let cachedBase: string | null = null;
let cachedToken: string | null = null;

// Non-sensitive: server URL stored in AsyncStorage
export async function getApiBase(): Promise<string> {
  if (cachedBase) return cachedBase;
  try {
    const saved = await AsyncStorage.getItem(API_BASE_KEY);
    cachedBase = saved ?? 'http://localhost:3000';
  } catch {
    cachedBase = 'http://localhost:3000';
  }
  return cachedBase;
}

export async function setApiBase(url: string): Promise<void> {
  cachedBase = url;
  try { await AsyncStorage.setItem(API_BASE_KEY, url); } catch { /* best-effort */ }
}

// Sensitive: auth token stored in SecureStore (iOS Keychain / Android Keystore)
export async function getAuthToken(): Promise<string | null> {
  if (cachedToken !== null) return cachedToken;
  try {
    cachedToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export async function setAuthToken(token: string | null): Promise<void> {
  cachedToken = token;
  try {
    if (token) {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    }
  } catch { /* best-effort */ }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  skipAuth?: boolean;
}

export async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const base = await getApiBase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  const skipAuth = options?.skipAuth === true || options?.auth === false;
  if (!skipAuth) {
    const token = await getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = { method: options?.method ?? 'GET', headers };
  if (options?.body !== undefined) {
    fetchOptions.body = typeof options.body === 'string'
      ? options.body
      : JSON.stringify(options.body);
  }

  const res = await fetch(`${base}${path}`, fetchOptions);

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
    const message = (errBody?.error as Record<string, unknown>)?.message as string
      ?? `Request failed: ${res.status}`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthResult {
  user: User;
  token: string;
}

export interface SignUpPendingResult {
  confirmationRequired: true;
  email: string;
}

export const authApi = {
  signup: (email: string, password: string, name?: string) =>
    request<{ data: AuthResult | SignUpPendingResult }>('/auth/signup', {
      method: 'POST',
      body: { email, password, name },
      skipAuth: true,
    }).then((r) => r.data),

  login: (email: string, password: string) =>
    request<{ data: AuthResult }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    }).then((r) => r.data),

  logout: () =>
    request<void>('/auth/logout', { method: 'POST' }),

  me: () =>
    request<{ data: User }>('/auth/me').then((r) => r.data),
};

// ── Templates ─────────────────────────────────────────────────────────────────

export const templatesApi = {
  list: () =>
    request<{ templates: unknown[] }>('/templates').then((r) => r.templates),

  getById: (id: string) =>
    request<{ template: unknown }>(`/templates/${id}`).then((r) => r.template),
};

// ── Goals ────────────────────────────────────────────────────────────────────

export const goalsApi = {
  createPlan: (
    goalId: string,
    payload: { templateId: string; answers: { questionId: string; value: string | number | boolean }[] },
  ) =>
    request<{ plan: unknown }>(`/goals/${goalId}/plan`, {
      method: 'POST',
      body: payload,
    }).then((r) => r.plan),

  getPlan: (goalId: string) =>
    request<{ plan: unknown }>(`/goals/${goalId}/plan`).then((r) => r.plan),
};

// ── Daily Briefs ──────────────────────────────────────────────────────────────

export const briefsApi = {
  getToday: () =>
    request<{ brief: DailyBrief }>('/briefs/today').then((r) => r.brief),

  getByDate: (date: string) =>
    request<{ brief: DailyBrief }>(`/briefs/${date}`).then((r) => r.brief),

  completeTask: (briefId: string, taskId: string) =>
    request<{ brief: DailyBrief }>(`/briefs/${briefId}/tasks/${taskId}`, {
      method: 'PATCH',
    }).then((r) => r.brief),
};

// ── Agents ────────────────────────────────────────────────────────────────────

export const agentsApi = {
  execute: (agentKey: string, prompt: string, context?: Record<string, unknown>) =>
    request<{ output: unknown }>('/agents/execute', {
      method: 'POST',
      body: { agentKey, prompt, context },
    }).then((r) => r.output),

  list: () =>
    request<{ agents: unknown[] }>('/agents/actions').then((r) => r.agents),
};

// ── Integrations ──────────────────────────────────────────────────────────────

export const integrationsApi = {
  status: () =>
    request<{ calendar: { connected: boolean }; buffer: { connected: boolean } }>('/integrations/status'),

  calendarAuthUrl: () =>
    request<{ url: string }>('/integrations/calendar/auth').then((r) => r.url),

  bufferAuthUrl: () =>
    request<{ url: string }>('/integrations/buffer/auth').then((r) => r.url),

  disconnectCalendar: () =>
    request<{ success: boolean }>('/integrations/calendar', { method: 'DELETE' }),

  disconnectBuffer: () =>
    request<{ success: boolean }>('/integrations/buffer', { method: 'DELETE' }),
};
