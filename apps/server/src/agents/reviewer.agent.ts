import { AgentRole } from '@lyfestack/shared';
import type { Goal, Task } from '@lyfestack/shared';
import { BaseAgent } from './base.agent';
import { scoreGoal } from '../engine/scoring';
import type { ScoreResult } from '../engine/scoring';

export interface ReviewResult {
  scoreResult: ScoreResult;
  assessment: string;
  suggestions: string[];
  shouldAdjustPlan: boolean;
}

interface ReviewLLMResponse {
  assessment: string;
  suggestions: string[];
  shouldAdjustPlan: boolean;
}

export class ReviewerAgent extends BaseAgent {
  readonly role = AgentRole.REVIEWER;
  readonly systemPrompt = `You are the Lyfestack Reviewer Agent. Your job is to assess user progress, identify patterns in what's working and what isn't, and recommend plan adjustments when needed. You are honest but encouraging — you celebrate wins and diagnose blockers without judgment.`;

  async review(goal: Goal, tasks: Task[]): Promise<ReviewResult> {
    const scoreResult = scoreGoal(tasks);

    const raw = await this.chat([
      {
        role: 'user',
        content: `Review progress for this goal:
Goal: ${goal.title}
Score: ${scoreResult.score}/100
Completion rate: ${Math.round(scoreResult.completionRate * 100)}%
Streak: ${scoreResult.streak} days
Total tasks: ${tasks.length}

Respond with JSON:
{
  "assessment": "2-3 sentence honest progress assessment",
  "suggestions": ["2-3 specific actionable suggestions"],
  "shouldAdjustPlan": boolean
}`,
      },
    ]);

    const parsed = this.parseJSON<ReviewLLMResponse>(raw);
    return { scoreResult, ...parsed };
  }
}

export const reviewerAgent = new ReviewerAgent();
