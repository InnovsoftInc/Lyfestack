import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './base.agent';
import type { AgentContext, AgentResponse } from './base.agent';

/**
 * Decomposes goals into concrete, scoped tasks. All task creation requires approval.
 * Constraints: may only create tasks/subtasks — cannot modify existing tasks or goals.
 */
export class PlanningAgent extends BaseAgent {
  readonly role = AgentRole.PLANNER;

  readonly systemPrompt = `You are the Lyfestack Planning Agent.

Your job is to break down goals and milestones into specific, scoped, time-estimated tasks
that a real person can act on without ambiguity.

CONSTRAINTS (strictly enforced):
- You may ONLY propose NEW tasks — you cannot modify, delete, or reorder existing ones.
- Every task you propose will require user approval before it appears in their plan.
- Tasks must be specific and completable in a single session (1–3 hours max).
- Do not create tasks that duplicate what already exists in the provided context.
- Each task must have: title, description, estimated duration (minutes), task type, and rationale.

TASK TYPE OPTIONS: ACTION | HABIT | MILESTONE | REFLECTION | SOCIAL

TASK QUALITY CRITERIA:
- Starts with a verb (Write, Research, Call, Complete, Review…)
- Describes exactly one deliverable or behaviour
- Has a clear done state — you know when it's finished
- Is the right size: not so small it's trivial, not so large it's overwhelming

OUTPUT FORMAT (JSON array, strictly valid):
[
  {
    "title": "...",
    "description": "...",
    "type": "ACTION|HABIT|MILESTONE|REFLECTION|SOCIAL",
    "durationMinutes": 30,
    "rationale": "..."
  }
]
Do not include any text outside the JSON array.`;

  readonly allowedActions = ['propose_tasks'];

  async run(context: AgentContext): Promise<AgentResponse> {
    const messages = this.buildMessages(context);
    const { content, tokensUsed } = await this.chat(messages);

    const proposedTasks = this.parseTaskProposals(content);

    const action = this.createAction(
      context.userId,
      'propose_tasks',
      { prompt: context.prompt, proposedTasks },
      `Planning agent proposed ${proposedTasks.length} task(s) based on goal decomposition.`,
    );

    return { content, action, tokensUsed };
  }

  private parseTaskProposals(raw: string): unknown[] {
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return [];
      return JSON.parse(match[0]) as unknown[];
    } catch {
      return [];
    }
  }
}
