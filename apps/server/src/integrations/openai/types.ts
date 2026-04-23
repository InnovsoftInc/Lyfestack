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

export interface OpenAIConfig {
  apiKey: string;
  defaultModel: string;
  features: Record<OpenAIFeature, FeatureConfig>;
  budget: BudgetConfig;
}

export interface RedactedOpenAIConfig {
  hasApiKey: boolean;
  apiKeySource: string;
  defaultModel: string;
  features: Record<OpenAIFeature, FeatureConfig>;
  budget: BudgetConfig;
}

export const DEFAULT_OPENAI_CONFIG: OpenAIConfig = {
  apiKey: 'env:OPENAI_API_KEY',
  defaultModel: 'gpt-4o-mini',
  features: {
    voice:        { model: 'gpt-4o-realtime-preview', voice: 'alloy' },
    tts:          { model: 'gpt-4o-mini-tts', voice: 'nova' },
    whisper:      { model: 'whisper-1' },
    vision:       { model: 'gpt-4o' },
    embeddings:   { model: 'text-embedding-3-small' },
    moderation:   { model: 'omni-moderation-latest' },
    summary:      { model: 'gpt-4o-mini' },
    orchestrator: { model: 'gpt-4o-mini' },
    batch:        { model: 'gpt-4o-mini' },
  },
  budget: { dailyUsd: 5, monthlyUsd: 50, hardStop: false },
};
