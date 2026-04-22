import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './base.agent';

export class CoachingAgent extends BaseAgent {
  readonly role = AgentRole.COACH;
  readonly systemPrompt =
    'You are a personal life coach. You provide empathetic, evidence-based guidance to help users overcome obstacles, stay motivated, and reflect on their progress. You ask powerful questions, challenge limiting beliefs, and celebrate wins.';
  readonly allowedActions = [
    'provide_motivation',
    'analyze_obstacle',
    'suggest_accountability_strategy',
    'lead_reflection_session',
    'reframe_setback',
  ];

  constructor() {
    super();
    this.completionOpts = { temperature: 0.75, maxTokens: 768 };
  }
}

export const coachingAgent = new CoachingAgent();
