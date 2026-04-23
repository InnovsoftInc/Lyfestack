import { request } from './api';

export const OPENAI_FEATURES = [
  'voice',
  'tts',
  'whisper',
  'vision',
  'embeddings',
  'moderation',
  'summary',
  'orchestrator',
  'batch',
] as const;

export type OpenAIFeature = (typeof OPENAI_FEATURES)[number];

export interface FeatureConfig {
  model: string;
  voice?: string;
}

export interface BudgetConfig {
  dailyUsd: number;
  monthlyUsd: number;
  hardStop: boolean;
}

export interface RedactedOpenAIConfig {
  hasApiKey: boolean;
  apiKeySource: string;
  defaultModel: string;
  features: Record<OpenAIFeature, FeatureConfig>;
  budget: BudgetConfig;
}

export interface OpenAIModel {
  id: string;
  created?: number;
  owned_by?: string;
}

export interface FeatureTestResult {
  ok: boolean;
  model: string;
  sample?: string;
  dimensions?: number;
  flagged?: boolean;
  note?: string;
}

export interface ConfigPatch {
  defaultModel?: string;
  apiKey?: string;
  budget?: Partial<BudgetConfig>;
  features?: Partial<Record<OpenAIFeature, Partial<FeatureConfig>>>;
}

export const openaiApi = {
  getConfig: () =>
    request<{ data: RedactedOpenAIConfig }>('/api/openai/config').then((r) => r.data),

  patchConfig: (patch: ConfigPatch) =>
    request<{ data: RedactedOpenAIConfig }>('/api/openai/config', {
      method: 'PATCH',
      body: patch,
    }).then((r) => r.data),

  listModels: (refresh = false) =>
    request<{ data: OpenAIModel[] }>(`/api/openai/models${refresh ? '?refresh=1' : ''}`).then(
      (r) => r.data,
    ),

  listFeatures: () =>
    request<{ data: readonly OpenAIFeature[] }>('/api/openai/features').then((r) => r.data),

  testFeature: (feature: OpenAIFeature) =>
    request<{ data: FeatureTestResult }>(`/api/openai/features/${feature}/test`, {
      method: 'POST',
    }).then((r) => r.data),
};
