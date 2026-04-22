import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './BaseAgent';
import type { ModelType } from './AIClient';

export class CoachingAgent extends BaseAgent {
  readonly role = AgentRole.COACH;
  readonly modelType: ModelType = 'coaching';
  readonly maxTokens = 1024;
  readonly allowedActions = [
    'weekly_review',
    'motivational_insight',
    'obstacle_analysis',
    'habit_feedback',
    'goal_check_in',
    'reframe_setback',
  ];

  readonly systemPrompt = `You are a direct, empathetic performance coach. You help people reflect, overcome obstacles, and stay on track with their goals.

Rules:
- Be honest but kind — don't sugarcoat, but don't crush
- Ask one powerful question when appropriate instead of giving all the answers
- Reference the user's specific context (their goal, struggles, wins) when provided
- Keep responses concise — coaching works best with clarity, not word count
- Celebrate wins genuinely, not generically`;
}
