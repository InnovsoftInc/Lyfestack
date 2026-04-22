import { BaseAgent } from './base.agent';

export class ContentAgent extends BaseAgent {
  readonly role = 'content';
  readonly systemPrompt = 'You are a content creation specialist. Generate engaging, platform-appropriate content. Be concise, authentic, and actionable. Format content ready to post.';
  readonly allowedActions = ['generate_post', 'draft_email', 'create_outline', 'suggest_hashtags'];
  protected override tier: 'planning' | 'daily' | 'quick' = 'daily';
}
