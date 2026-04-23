import { create } from 'zustand';
import {
  openaiApi,
  type ConfigPatch,
  type FeatureTestResult,
  type OpenAIFeature,
  type OpenAIModel,
  type RedactedOpenAIConfig,
} from '../services/openai.api';

interface OpenAIStore {
  config: RedactedOpenAIConfig | null;
  models: OpenAIModel[];
  modelsLoadedAt: number | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  testResults: Partial<Record<OpenAIFeature, { result: FeatureTestResult | null; error: string | null; testedAt: number }>>;

  load: () => Promise<void>;
  reloadModels: (force?: boolean) => Promise<void>;
  patch: (patch: ConfigPatch) => Promise<void>;
  test: (feature: OpenAIFeature) => Promise<void>;
}

export const useOpenAIStore = create<OpenAIStore>((set, get) => ({
  config: null,
  models: [],
  modelsLoadedAt: null,
  loading: false,
  saving: false,
  error: null,
  testResults: {},

  load: async () => {
    set({ loading: true, error: null });
    try {
      const [config, models] = await Promise.all([
        openaiApi.getConfig(),
        openaiApi.listModels(false),
      ]);
      set({ config, models, modelsLoadedAt: Date.now(), loading: false });
    } catch (err: any) {
      set({ loading: false, error: err?.message ?? 'Failed to load OpenAI config' });
    }
  },

  reloadModels: async (force = false) => {
    try {
      const models = await openaiApi.listModels(force);
      set({ models, modelsLoadedAt: Date.now() });
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to reload models' });
    }
  },

  patch: async (patch) => {
    set({ saving: true, error: null });
    try {
      const config = await openaiApi.patchConfig(patch);
      set({ config, saving: false });
    } catch (err: any) {
      set({ saving: false, error: err?.message ?? 'Failed to save OpenAI config' });
      throw err;
    }
  },

  test: async (feature) => {
    set((s) => ({
      testResults: {
        ...s.testResults,
        [feature]: { result: null, error: null, testedAt: Date.now() },
      },
    }));
    try {
      const result = await openaiApi.testFeature(feature);
      set((s) => ({
        testResults: {
          ...s.testResults,
          [feature]: { result, error: null, testedAt: Date.now() },
        },
      }));
    } catch (err: any) {
      set((s) => ({
        testResults: {
          ...s.testResults,
          [feature]: {
            result: null,
            error: err?.message ?? 'Test failed',
            testedAt: Date.now(),
          },
        },
      }));
    }
    void get();
  },
}));
