import { patchOpenclawJson, readOpenclawJson, resolveEnvValue } from '../openclaw/openclaw-json';
import {
  DEFAULT_OPENAI_CONFIG,
  type BudgetConfig,
  type FeatureConfig,
  type OpenAIConfig,
  type OpenAIFeature,
  type RedactedOpenAIConfig,
  OPENAI_FEATURES,
} from './types';

interface OpenclawJsonShape {
  openai?: Partial<OpenAIConfig>;
  env?: Record<string, string>;
  [key: string]: unknown;
}

function withDefaults(partial: Partial<OpenAIConfig> | undefined): OpenAIConfig {
  const features = { ...DEFAULT_OPENAI_CONFIG.features };
  if (partial?.features) {
    for (const key of OPENAI_FEATURES) {
      const incoming = partial.features[key];
      if (incoming?.model) {
        features[key] = { ...features[key], ...incoming };
      }
    }
  }
  return {
    apiKey: partial?.apiKey ?? DEFAULT_OPENAI_CONFIG.apiKey,
    defaultModel: partial?.defaultModel ?? DEFAULT_OPENAI_CONFIG.defaultModel,
    features,
    budget: { ...DEFAULT_OPENAI_CONFIG.budget, ...(partial?.budget ?? {}) },
  };
}

export async function readConfig(): Promise<OpenAIConfig> {
  const raw = await readOpenclawJson<OpenclawJsonShape>();
  return withDefaults(raw.openai);
}

export async function getRedactedConfig(): Promise<RedactedOpenAIConfig> {
  const cfg = await readConfig();
  const apiKey = resolveApiKey(cfg);
  return {
    hasApiKey: Boolean(apiKey),
    apiKeySource: cfg.apiKey,
    defaultModel: cfg.defaultModel,
    features: cfg.features,
    budget: cfg.budget,
  };
}

export function resolveApiKey(cfg: OpenAIConfig): string | undefined {
  return resolveEnvValue(cfg.apiKey);
}

export interface ResolvedFeature {
  feature: OpenAIFeature;
  model: string;
  voice?: string;
  apiKey: string;
}

export async function resolveModel(feature: OpenAIFeature): Promise<ResolvedFeature> {
  const cfg = await readConfig();
  const featureCfg: FeatureConfig = cfg.features[feature] ?? { model: cfg.defaultModel };
  const apiKey = resolveApiKey(cfg);
  if (!apiKey) {
    throw new Error(
      `OpenAI API key not available — set ${cfg.apiKey} (e.g. add OPENAI_API_KEY to ~/.openclaw/openclaw.json env block or process env)`,
    );
  }
  return {
    feature,
    model: featureCfg.model || cfg.defaultModel,
    ...(featureCfg.voice ? { voice: featureCfg.voice } : {}),
    apiKey,
  };
}

export interface ConfigPatch {
  defaultModel?: string;
  features?: Partial<Record<OpenAIFeature, Partial<FeatureConfig>>>;
  budget?: Partial<BudgetConfig>;
  apiKey?: string;
}

export async function patchConfig(patch: ConfigPatch): Promise<RedactedOpenAIConfig> {
  await patchOpenclawJson<OpenclawJsonShape>((current) => {
    const merged = withDefaults(current.openai);
    if (patch.defaultModel) merged.defaultModel = patch.defaultModel;
    if (patch.apiKey !== undefined) merged.apiKey = patch.apiKey;
    if (patch.budget) merged.budget = { ...merged.budget, ...patch.budget };
    if (patch.features) {
      for (const [key, value] of Object.entries(patch.features)) {
        if (!OPENAI_FEATURES.includes(key as OpenAIFeature)) continue;
        const f = key as OpenAIFeature;
        if (!value) continue;
        merged.features[f] = { ...merged.features[f], ...value };
      }
    }
    current.openai = merged;
    return current;
  });
  return getRedactedConfig();
}

export function listFeatures(): readonly OpenAIFeature[] {
  return OPENAI_FEATURES;
}
