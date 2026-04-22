import type { FullGoalTemplate } from '../../../templates/templates.data';
import type { DiagnosticAnswers, GeneratedPlan, PlannedTask, UserContext } from '../types';
import { BasePlanningStrategy } from './base.strategy';

export class ProductivityStrategy extends BasePlanningStrategy {
  protected getWeeklyTasks(week: number, _template: FullGoalTemplate, answers: DiagnosticAnswers): PlannedTask[] {
    const focusHours = Number(answers['q_focus_hours'] ?? 3);
    const tasks: PlannedTask[] = [];

    if (week === 1) {
      tasks.push({ title: 'Complete time audit', description: 'Track every 30-min block for 3 days', type: 'ACTION', weekNumber: week, durationMinutes: 15, isRecurring: false });
    }

    tasks.push({
      title: `Deep work block (${focusHours}h)`,
      description: 'Uninterrupted focus time on primary project',
      type: 'HABIT',
      weekNumber: week,
      durationMinutes: focusHours * 60,
      isRecurring: true,
    });
    tasks.push({ title: 'Daily shutdown ritual', description: 'Clear inbox, update task list, set tomorrow\'s top 3', type: 'HABIT', weekNumber: week, durationMinutes: 15, isRecurring: true });

    return tasks;
  }

  protected getSuccessCriteria(week: number, _template: FullGoalTemplate): string {
    const criteria: Record<number, string> = {
      1: 'Time audit completed, top 3 wasters identified',
      2: 'Deep work sessions scheduled in calendar',
      3: 'Zero missed deep work blocks',
      4: 'Primary project 25% complete',
    };
    return criteria[week] ?? 'Maintain daily focus habits';
  }

  generate(template: FullGoalTemplate, answers: DiagnosticAnswers, context: UserContext): GeneratedPlan {
    const focuses = [
      'Audit & eliminate time wasters',
      'Design your focus system',
      'Build the deep work habit',
      'Accelerate primary project',
      'Optimize and protect energy',
      'Compound the gains',
      'Handle blockers and edge cases',
      'Ship primary milestone',
    ];

    const initialTasks: PlannedTask[] = [
      { title: 'Block deep work time in calendar', description: 'Reserve focus blocks for the next 7 days', type: 'ACTION', weekNumber: 1, durationMinutes: 10, isRecurring: false },
      { title: 'Install distraction blocker', description: 'Set up Freedom or similar app', type: 'ACTION', weekNumber: 1, durationMinutes: 15, isRecurring: false },
      { title: 'Write your MIT (Most Important Task)', description: 'Identify the one task that matters most today', type: 'HABIT', weekNumber: 1, durationMinutes: 5, isRecurring: true },
    ];

    return this.buildBase(template, context, focuses, initialTasks);
  }
}
