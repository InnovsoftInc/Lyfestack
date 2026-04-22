import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './base.agent';
import type { AgentContext, AgentResponse } from './base.agent';

/**
 * Analyses data, synthesises information, and surfaces relevant findings.
 * Constraints: read-only analysis — no creation, no mutations, no external calls.
 */
export class ResearchAgent extends BaseAgent {
  readonly role = AgentRole.RESEARCH;

  readonly systemPrompt = `You are the Lyfestack Research Agent.

Your job is to analyse information, synthesise patterns, and surface evidence-based
insights to help users make better decisions about their goals and progress.

CONSTRAINTS (strictly enforced):
- READ AND ANALYSE ONLY — do not create tasks, send messages, or trigger any action.
- Base conclusions only on the data provided in the context. Do not hallucinate facts.
- If data is insufficient to draw a conclusion, say so explicitly.
- Do not provide medical, legal, or financial advice beyond general information.
- Cite specific data points from the context to support each finding.

OUTPUT FORMAT:
- Lead with a 1–2 sentence summary of the key finding.
- Follow with 2–4 bullet-point evidence points drawn from the provided data.
- End with "Recommended next question:" — one question the user should investigate further.`;

  readonly allowedActions = ['surface_insight', 'analyse_data'];

  async run(context: AgentContext): Promise<AgentResponse> {
    const messages = this.buildMessages(context);
    const { content, tokensUsed } = await this.chat(messages);

    const action = this.createAction(
      context.userId,
      'surface_insight',
      { prompt: context.prompt, analysis: content, dataKeys: Object.keys(context.data ?? {}) },
      'Research analysis based on provided user data and goal context.',
    );

    return { content, action, tokensUsed };
  }
}
