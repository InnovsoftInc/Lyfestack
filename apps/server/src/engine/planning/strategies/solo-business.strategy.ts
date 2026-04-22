import type { FullGoalTemplate } from '../../../templates/templates.data';
import type { DiagnosticAnswers, GeneratedPlan, PlannedTask, UserContext } from '../types';
import { BasePlanningStrategy } from './base.strategy';

export class SoloBusinessStrategy extends BasePlanningStrategy {
  protected getWeeklyTasks(week: number, _template: FullGoalTemplate, answers: DiagnosticAnswers): PlannedTask[] {
    const bottleneck = String(answers['q_bottleneck'] ?? 'Getting leads');
    const tasks: PlannedTask[] = [];

    if (bottleneck.includes('lead') || week <= 4) {
      tasks.push({ title: 'Send 5 outreach messages', description: 'Personalized cold outreach or warm follow-ups', type: 'ACTION', weekNumber: week, durationMinutes: 45, isRecurring: true });
    }

    tasks.push({ title: 'Content post', description: 'Publish one piece of content on your primary channel', type: 'ACTION', weekNumber: week, durationMinutes: 60, isRecurring: true });
    tasks.push({ title: 'Pipeline review', description: 'Update CRM / prospect list, next actions for each lead', type: 'HABIT', weekNumber: week, durationMinutes: 30, isRecurring: true });

    if (week >= 4) {
      tasks.push({ title: 'Sales call / follow-up', description: 'Book or conduct a discovery call', type: 'ACTION', weekNumber: week, durationMinutes: 60, isRecurring: false });
    }

    return tasks;
  }

  protected getSuccessCriteria(week: number, _template: FullGoalTemplate): string {
    if (week <= 2) return 'Offer document written and offer tested in conversation';
    if (week <= 6) return 'At least one lead in active conversation';
    if (week <= 10) return 'Revenue goal 50% reached';
    return 'Monthly revenue target hit';
  }

  generate(template: FullGoalTemplate, answers: DiagnosticAnswers, context: UserContext): GeneratedPlan {
    const revenueTarget = Number(answers['q_revenue_target'] ?? 5000);
    const focuses = [
      'Define your offer with precision',
      'Build your outreach system',
      'First 10 outreach messages sent',
      'First discovery call booked',
      'Refine pitch based on feedback',
      `First paying client — $${Math.round(revenueTarget * 0.2)}/mo`,
      'Systematize delivery',
      'Scale outreach volume',
      'Optimize conversion rate',
      'Build referral system',
      `Reach $${Math.round(revenueTarget * 0.7)}/mo`,
      'Document and automate processes',
      `Hit $${revenueTarget}/mo`,
      'Plan next growth phase',
      'Hire or delegate first task',
      'Revenue stable and predictable',
    ];

    const initialTasks: PlannedTask[] = [
      { title: 'Write offer document', description: 'Define your service, outcome, price, and ideal client', type: 'ACTION', weekNumber: 1, durationMinutes: 90, isRecurring: false },
      { title: 'Build prospect list (20 names)', description: 'Research and compile 20 ideal potential clients', type: 'ACTION', weekNumber: 1, durationMinutes: 60, isRecurring: false },
      { title: 'Send first 5 outreach messages', description: 'Personalized, genuine, no pitch — open a conversation', type: 'ACTION', weekNumber: 1, durationMinutes: 45, isRecurring: false },
    ];

    return this.buildBase(template, context, focuses, initialTasks);
  }
}
