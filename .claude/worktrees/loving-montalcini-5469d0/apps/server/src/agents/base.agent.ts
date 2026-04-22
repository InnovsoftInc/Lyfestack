import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { AgentRole, ApprovalState } from '@lyfestack/shared';
import type { AgentAction } from '@lyfestack/shared';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentContext {
  userId: string;
  prompt: string;
  /** Optional structured data the agent may reference */
  data?: Record<string, unknown>;
}

export interface AgentResponse {
  content: string;
  action?: AgentAction;
  tokensUsed?: number;
}

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: config.OPENROUTER_API_KEY ?? 'missing-key',
  defaultHeaders: {
    'HTTP-Referer': 'https://lyfestack.app',
    'X-Title': 'Lyfestack',
  },
});

export abstract class BaseAgent {
  abstract readonly role: AgentRole;
  abstract readonly systemPrompt: string;
  /** Actions this agent is permitted to produce */
  abstract readonly allowedActions: string[];

  protected readonly model: string = config.OPENROUTER_MODEL;

  protected async chat(messages: AgentMessage[]): Promise<{ content: string; tokensUsed: number }> {
    if (!config.OPENROUTER_API_KEY) {
      logger.warn({ role: this.role }, 'OpenRouter API key not set — returning stub response');
      return { content: '[Agent response unavailable: OPENROUTER_API_KEY not configured]', tokensUsed: 0 };
    }

    const completion = await openai.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const content = completion.choices[0]?.message?.content ?? '';
    const tokensUsed = completion.usage?.total_tokens ?? 0;
    return { content, tokensUsed };
  }

  protected buildMessages(context: AgentContext): AgentMessage[] {
    const messages: AgentMessage[] = [{ role: 'system', content: this.systemPrompt }];

    if (context.data && Object.keys(context.data).length > 0) {
      messages.push({
        role: 'user',
        content: `Context data:\n${JSON.stringify(context.data, null, 2)}`,
      });
    }

    messages.push({ role: 'user', content: context.prompt });
    return messages;
  }

  protected createAction(
    userId: string,
    action: string,
    payload: Record<string, unknown>,
    rationale: string,
  ): AgentAction {
    if (!this.allowedActions.includes(action)) {
      throw new Error(`Agent ${this.role} is not permitted to produce action "${action}". Allowed: ${this.allowedActions.join(', ')}`);
    }

    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      agentRole: this.role,
      userId,
      action,
      payload,
      approvalState: ApprovalState.PENDING,
      rationale,
      createdAt: now,
    };
  }

  abstract run(context: AgentContext): Promise<AgentResponse>;
}
