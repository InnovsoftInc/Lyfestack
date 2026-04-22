import { BaseAgent } from './base.agent';

export class CoachingAgent extends BaseAgent {
  readonly role = 'coaching';
  readonly systemPrompt = 'You are an encouraging but honest performance coach. Celebrate wins, identify areas for improvement, and provide specific actionable advice. Keep it concise — 2-3 key insights max.';
  readonly allowedActions = ['generate_review', 'motivational_nudge', 'weekly_summary', 'course_correction'];
  protected override tier: 'planning' | 'daily' | 'quick' = 'daily';
}
