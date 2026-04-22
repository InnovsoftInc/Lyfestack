import { config } from '../config/config';
import { ExternalServiceError } from '../errors/AppError';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

interface OpenRouterChoice {
  message: { content: string };
}

interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
}

interface OpenRouterResponse {
  model: string;
  choices: OpenRouterChoice[];
  usage: OpenRouterUsage;
}

export class AIClient {
  private readonly baseUrl = 'https://openrouter.ai/api/v1';

  async complete(messages: ChatMessage[], opts: CompletionOptions = {}): Promise<CompletionResult> {
    if (!config.OPENROUTER_API_KEY) {
      throw new ExternalServiceError('OpenRouter', 'OPENROUTER_API_KEY not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lyfestack.app',
        'X-Title': 'Lyfestack',
      },
      body: JSON.stringify({
        model: opts.model ?? config.OPENROUTER_MODEL,
        messages,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ExternalServiceError('OpenRouter', `HTTP ${response.status}: ${text}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const firstChoice = data.choices[0];
    const content = firstChoice?.message.content ?? '';

    return {
      content,
      model: data.model,
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
    };
  }
}

export const aiClient = new AIClient();
