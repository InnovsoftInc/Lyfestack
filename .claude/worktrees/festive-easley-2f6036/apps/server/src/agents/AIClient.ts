import OpenAI from 'openai';
import { config } from '../config/config';

export type ModelType = 'planning' | 'coaching' | 'daily' | 'classification';

const MODEL_MAP: Record<ModelType, string> = {
  planning: 'anthropic/claude-sonnet-4',   // complex reasoning for plans
  coaching: 'anthropic/claude-sonnet-4',   // nuanced coaching responses
  daily: 'openai/gpt-4o-mini',             // fast, cheap for daily task generation
  classification: 'anthropic/claude-haiku-3', // quick intent classification
};

export class AIClient {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: config.OPENROUTER_API_KEY ?? '',
      defaultHeaders: {
        'HTTP-Referer': 'https://lyfestack.app',
        'X-Title': 'Lyfestack',
      },
    });
  }

  async chat(
    modelType: ModelType,
    systemPrompt: string,
    userMessage: string,
    maxTokens = 1024,
  ): Promise<string> {
    const model = MODEL_MAP[modelType];
    const response = await this.client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    return response.choices[0]?.message.content ?? '';
  }
}

export const aiClient = new AIClient();
