import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './base.agent';

export interface CoachMessage {
  type: 'motivation' | 'accountability' | 'celebration' | 'reframe';
  message: string;
  callToAction?: string | undefined;
}

export interface CoachContext {
  goalTitle: string;
  streak: number;
  score: number;
  recentWin?: string | undefined;
  recentBlock?: string | undefined;
}

export class CoachAgent extends BaseAgent {
  readonly role = AgentRole.COACH;
  readonly systemPrompt = `You are the Lyfestack Coach Agent — the user's personal growth partner. You deliver the right message at the right time: celebrate wins, gently hold accountability, reframe setbacks as data, and remind users why they started. Your tone is warm, direct, and real — like a trusted friend who believes in them more than they believe in themselves.`;

  async motivate(context: CoachContext): Promise<CoachMessage> {
    const raw = await this.chat([
      {
        role: 'user',
        content: `Generate a coaching message:
Goal: ${context.goalTitle}
Streak: ${context.streak} days
Score: ${context.score}/100
${context.recentWin ? `Recent win: ${context.recentWin}` : ''}
${context.recentBlock ? `Current blocker: ${context.recentBlock}` : ''}

Respond with JSON:
{
  "type": "motivation|accountability|celebration|reframe",
  "message": "personal coaching message (2-3 sentences)",
  "callToAction": "one specific action to take right now (optional, omit if not relevant)"
}`,
      },
    ]);
    return this.parseJSON<CoachMessage>(raw);
  }
}

export const coachAgent = new CoachAgent();
