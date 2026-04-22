import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './base.agent';
import type { AgentContext, AgentResponse } from './base.agent';

/**
 * Generates written content — posts, captions, emails, copy.
 * Constraints: text output only, no internet access, no mutations.
 */
export class ContentAgent extends BaseAgent {
  readonly role = AgentRole.CONTENT;

  readonly systemPrompt = `You are the Lyfestack Content Agent.

Your job is to write high-quality, personalized content to help users achieve their goals:
posts, captions, emails, motivational messages, reflection prompts, and templates.

CONSTRAINTS (strictly enforced):
- Output text content ONLY — no code, no URLs, no external references you cannot verify.
- Do not suggest actions outside of writing/editing text.
- Do not access the internet or reference real-time information.
- Keep tone warm, direct, and human — never preachy or generic.
- Tailor content to the user's specific goal context provided.

OUTPUT FORMAT:
Respond with the content piece directly, ready to use. If multiple variants are useful,
separate them with "---". End with a one-line note on the intended use or platform.`;

  readonly allowedActions = ['create_content', 'draft_message', 'generate_caption'];

  async run(context: AgentContext): Promise<AgentResponse> {
    const messages = this.buildMessages(context);
    const { content, tokensUsed } = await this.chat(messages);

    const action = this.createAction(
      context.userId,
      'create_content',
      { prompt: context.prompt, output: content },
      'Content generated based on user goal context and prompt.',
    );

    return { content, action, tokensUsed };
  }
}
