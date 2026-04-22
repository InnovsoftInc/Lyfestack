import OpenAI from 'openai';
import { config } from '../config/config';

type ModelTier = 'planning' | 'daily' | 'quick';

const MODEL_MAP: Record<ModelTier, string> = {
  planning: 'anthropic/claude-sonnet-4-20250514',
  daily: 'openai/gpt-4o-mini',
  quick: 'anthropic/claude-haiku-4-20250514',
};

export class AIClient {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: config.OPENROUTER_API_KEY,
    });
  }

  async complete(prompt: string, systemPrompt: string, tier: ModelTier = 'daily', maxTokens: number = 1024): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: MODEL_MAP[tier],
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });
    return response.choices[0]?.message?.content ?? '';
  }
}
