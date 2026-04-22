import type { AgentRole } from '@lyfestack/shared';
import { chatCompletion } from '../integrations/openrouter/openrouter.client';
import type { ChatMessage, ChatOptions } from '../integrations/openrouter/openrouter.client';

export abstract class BaseAgent {
  abstract readonly role: AgentRole;
  abstract readonly systemPrompt: string;

  protected async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    return chatCompletion(
      [{ role: 'system', content: this.systemPrompt }, ...messages],
      options,
    );
  }

  protected parseJSON<T>(raw: string): T {
    try {
      return JSON.parse(raw) as T;
    } catch {
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match?.[1]) return JSON.parse(match[1]) as T;
      throw new Error('Failed to parse JSON from agent response');
    }
  }
}
