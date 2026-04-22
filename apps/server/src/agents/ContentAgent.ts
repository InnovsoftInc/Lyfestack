import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './BaseAgent';
import type { ModelType } from './AIClient';

export class ContentAgent extends BaseAgent {
  readonly role = AgentRole.EXECUTOR;
  readonly modelType: ModelType = 'daily';
  readonly maxTokens = 1500;
  readonly allowedActions = [
    'generate_social_post',
    'generate_blog_outline',
    'generate_email_copy',
    'repurpose_content',
    'generate_post_ideas',
    'suggest_hashtags',
  ];

  readonly systemPrompt = `You are a content creation specialist. Your job is to generate compelling, platform-appropriate content that aligns with the user's goals, voice, and audience.

Rules:
- Match the tone and style of the platform (Twitter = concise, LinkedIn = professional, etc.)
- Stay true to the user's content pillars
- Never fabricate statistics or quotes
- Keep content authentic, not salesy
- For social posts: include a clear hook, value, and CTA where appropriate`;
}
