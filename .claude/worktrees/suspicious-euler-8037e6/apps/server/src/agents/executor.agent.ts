import { AgentRole } from '@lyfestack/shared';
import type { Task } from '@lyfestack/shared';
import { BaseAgent } from './base.agent';

export interface ExecutionAnalysis {
  canAutoExecute: boolean;
  instructions: string;
}

export class ExecutorAgent extends BaseAgent {
  readonly role = AgentRole.EXECUTOR;
  readonly systemPrompt = `You are the Lyfestack Executor Agent. Your job is to take approved tasks and carry them out — scheduling calendar events, drafting content, sending updates via integrations, and tracking completion. You always confirm before making external changes unless the user has granted autonomous trust.`;

  async analyzeTask(task: Task): Promise<ExecutionAnalysis> {
    const raw = await this.chat([
      {
        role: 'user',
        content: `Analyze this task and determine if it can be auto-executed via integrations, or needs user action.
Task: ${task.title}
Description: ${task.description ?? ''}
Type: ${task.type}

Respond with JSON: { "canAutoExecute": boolean, "instructions": "what will happen or what the user needs to do" }`,
      },
    ]);
    return this.parseJSON<ExecutionAnalysis>(raw);
  }
}

export const executorAgent = new ExecutorAgent();
