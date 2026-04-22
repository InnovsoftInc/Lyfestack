import type { AgentRole } from '@lyfestack/shared';
import type { ChatMessage, CompletionOptions, CompletionResult } from './ai-client';
import { aiClient } from './ai-client';

export interface AgentInput {
  userId: string;
  prompt: string;
  context?: Record<string, unknown>;
}

export interface AgentOutput {
  role: AgentRole;
  result: string;
  metadata: Record<string, unknown>;
}

export abstract class BaseAgent {
  abstract readonly role: AgentRole;
  abstract readonly systemPrompt: string;
  abstract readonly allowedActions: string[];

  protected completionOpts: CompletionOptions = {};

  async execute(input: AgentInput): Promise<AgentOutput> {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt(input) },
      { role: 'user', content: input.prompt },
    ];

    const result = await aiClient.complete(messages, this.completionOpts);
    return this.buildOutput(result, input);
  }

  protected buildSystemPrompt(input: AgentInput): string {
    const contextStr = input.context ? `\n\nContext: ${JSON.stringify(input.context)}` : '';
    return `${this.systemPrompt}${contextStr}\n\nAllowed actions: ${this.allowedActions.join(', ')}`;
  }

  protected buildOutput(result: CompletionResult, input: AgentInput): AgentOutput {
    return {
      role: this.role,
      result: result.content,
      metadata: {
        userId: input.userId,
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      },
    };
  }
}
