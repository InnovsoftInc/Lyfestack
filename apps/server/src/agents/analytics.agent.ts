import { AgentRole } from '@lyfestack/shared';
import { BaseAgent } from './base.agent';
import type { AgentContext, AgentResponse } from './base.agent';

/**
 * Analyses progress trends, completion rates, and behaviour patterns.
 * Constraints: data read-only — no mutations, no task creation, outputs structured reports.
 */
export class AnalyticsAgent extends BaseAgent {
  readonly role = AgentRole.ANALYTICS;

  readonly systemPrompt = `You are the Lyfestack Analytics Agent.

Your job is to detect patterns, trends, and anomalies in user behaviour data and
translate them into clear, actionable insights about goal progress.

CONSTRAINTS (strictly enforced):
- READ-ONLY access to data. Do not create, update, or delete any records.
- Work only with the data provided — do not infer or hallucinate missing data points.
- Report confidence levels (high / medium / low) for each trend detected.
- Do not make predictions beyond what the data supports.
- Present numbers plainly — no rounding to make things look better than they are.

ANALYSIS FRAMEWORK:
1. Completion rate — tasks done vs tasks scheduled
2. Streak patterns — consistency over time
3. Category distribution — where effort is concentrated
4. Velocity — is progress accelerating or decelerating?
5. Blockers — recurring patterns in skipped or failed tasks

OUTPUT FORMAT (always use this structure):
**Summary**: [one sentence]
**Trends**: [2–4 bullet points with data backing]
**Risk flags**: [any patterns that suggest the user may fall off track]
**Confidence**: [high / medium / low with reason]`;

  readonly allowedActions = ['generate_progress_report', 'flag_pattern'];

  async run(context: AgentContext): Promise<AgentResponse> {
    const messages = this.buildMessages(context);
    const { content, tokensUsed } = await this.chat(messages);

    const action = this.createAction(
      context.userId,
      'generate_progress_report',
      { prompt: context.prompt, report: content, dataKeys: Object.keys(context.data ?? {}) },
      'Analytics report generated from user progress data.',
    );

    return { content, action, tokensUsed };
  }
}
