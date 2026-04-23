import { config } from '../config/config';
import { ExternalServiceError } from '../errors/AppError';
import { OpenClawService } from '../integrations/openclaw/openclaw.service';

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

// ── Provider interface ────────────────────────────────────────────────────────

interface IAIProvider {
  complete(messages: ChatMessage[], opts: CompletionOptions): Promise<CompletionResult>;
}

// ── OpenClaw provider ─────────────────────────────────────────────────────────

class OpenClawProvider implements IAIProvider {
  private readonly service = new OpenClawService();

  async complete(messages: ChatMessage[], _opts: CompletionOptions): Promise<CompletionResult> {
    // Concatenate all messages into a single prompt for the main agent
    const prompt = messages
      .map((m) => (m.role === 'system' ? `[System] ${m.content}` : m.content))
      .join('\n\n');

    const content = await this.service.sendMessage('main', prompt);
    return { content, model: 'openclaw/main', promptTokens: 0, completionTokens: 0 };
  }
}

// ── OpenRouter provider ───────────────────────────────────────────────────────

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

class OpenRouterProvider implements IAIProvider {
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

// ── AIClient — routes through OpenClaw when configured, else OpenRouter ───────

export class AIClient {
  private readonly provider: IAIProvider;

  constructor() {
    if (config.OPENCLAW_GATEWAY_URL) {
      this.provider = new OpenClawProvider();
    } else if (config.OPENROUTER_API_KEY) {
      this.provider = new OpenRouterProvider();
    } else {
      // Defer error to call time so the server can still start without AI configured
      this.provider = {
        complete: () => {
          throw new ExternalServiceError(
            'AI',
            'No AI provider configured: set OPENCLAW_GATEWAY_URL or OPENROUTER_API_KEY',
          );
        },
      };
    }
  }

  complete(messages: ChatMessage[], opts: CompletionOptions = {}): Promise<CompletionResult> {
    return this.provider.complete(messages, opts);
  }
}

export const aiClient = new AIClient();
