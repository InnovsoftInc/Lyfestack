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

// ── AIClient — routes through OpenClaw ───────────────────────────────────────

// ── AIClient — routes through OpenClaw ───────────────────────────────────────

export class AIClient {
  private readonly provider: IAIProvider;

  constructor() {
    if (config.OPENCLAW_GATEWAY_URL) {
      this.provider = new OpenClawProvider();
    } else {
      // Defer error to call time so the server can still start without AI configured
      this.provider = {
        complete: () => {
          throw new ExternalServiceError(
            'AI',
            'No AI provider configured: set OPENCLAW_GATEWAY_URL',
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
