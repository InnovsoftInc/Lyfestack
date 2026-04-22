import { AIClient } from './ai-client';

export interface AgentResult {
  content: string;
  confidenceScore: number;
  metadata?: Record<string, unknown>;
}

export abstract class BaseAgent {
  abstract readonly role: string;
  abstract readonly systemPrompt: string;
  abstract readonly allowedActions: string[];
  protected client: AIClient;
  protected maxTokens: number = 1024;
  protected tier: 'planning' | 'daily' | 'quick' = 'daily';

  constructor(client: AIClient) {
    this.client = client;
  }

  async execute(prompt: string, context?: Record<string, unknown>): Promise<AgentResult> {
    const enrichedPrompt = context
      ? `Context: ${JSON.stringify(context)}\n\nTask: ${prompt}`
      : prompt;

    const content = await this.client.complete(enrichedPrompt, this.systemPrompt, this.tier, this.maxTokens);

    return {
      content,
      confidenceScore: 0.8,
      metadata: { agent: this.role, timestamp: new Date().toISOString() },
    };
  }

  canPerformAction(action: string): boolean {
    return this.allowedActions.includes(action);
  }
}
