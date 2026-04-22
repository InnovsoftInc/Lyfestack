import { config } from '../../config/config';
import { ExternalServiceError } from '../../errors/AppError';
import { logger } from '../../utils/logger';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

interface OpenRouterResponse {
  choices: Array<{ message: { content: string } }>;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  if (!config.OPENROUTER_API_KEY) {
    throw new ExternalServiceError('OpenRouter', 'API key not configured');
  }

  const body = {
    model: options.model ?? config.OPENROUTER_MODEL,
    messages,
    max_tokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.7,
  };

  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lyfestack.app',
        'X-Title': 'Lyfestack',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.error({ err }, 'OpenRouter request failed');
    throw new ExternalServiceError('OpenRouter', 'Network request failed');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => 'unknown error');
    logger.error({ status: response.status, text }, 'OpenRouter returned error');
    throw new ExternalServiceError('OpenRouter', `HTTP ${response.status}: ${text}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const content = data.choices[0]?.message.content;
  if (content === undefined) {
    throw new ExternalServiceError('OpenRouter', 'Empty response from model');
  }
  return content;
}
