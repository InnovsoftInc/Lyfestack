import type { AgentRole } from '@lyfestack/shared';
import type { ModelType } from './AIClient';
import { aiClient } from './AIClient';

export interface AgentRequest {
  userId: string;
  taskType: string;
  payload: Record<string, unknown>;
}

export interface AgentResponse {
  agentRole: AgentRole;
  content: string;
  metadata: Record<string, unknown>;
  tokensUsed?: number;
}

export abstract class BaseAgent {
  abstract readonly role: AgentRole;
  abstract readonly systemPrompt: string;
  abstract readonly allowedActions: string[];
  abstract readonly modelType: ModelType;
  readonly maxTokens: number = 1024;

  async execute(request: AgentRequest): Promise<AgentResponse> {
    this.validateAction(request.taskType);
    const userMessage = this.buildPrompt(request);
    const content = await aiClient.chat(this.modelType, this.systemPrompt, userMessage, this.maxTokens);
    return {
      agentRole: this.role,
      content,
      metadata: { taskType: request.taskType, userId: request.userId },
    };
  }

  protected validateAction(action: string) {
    if (!this.allowedActions.includes(action)) {
      throw new Error(`Agent ${this.role} does not support action: ${action}`);
    }
  }

  protected buildPrompt(request: AgentRequest): string {
    return `Task: ${request.taskType}\n\nContext:\n${JSON.stringify(request.payload, null, 2)}`;
  }
}
