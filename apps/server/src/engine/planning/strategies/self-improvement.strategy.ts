import type { FullGoalTemplate } from '../../../templates/templates.data';
import type { DiagnosticAnswers, GeneratedPlan, PlannedTask, UserContext } from '../types';
import { BasePlanningStrategy } from './base.strategy';

export class SelfImprovementStrategy extends BasePlanningStrategy {
  protected getWeeklyTasks(week: number, _template: FullGoalTemplate, _answers: DiagnosticAnswers): PlannedTask[] {
    const tasks: PlannedTask[] = [
      { title: 'Morning habit block', description: 'Complete your designed morning routine', type: 'HABIT', weekNumber: week, durationMinutes: 30, isRecurring: true },
      { title: 'Evening reflection', description: 'Journal: 3 wins, 1 lesson', type: 'HABIT', weekNumber: week, durationMinutes: 10, isRecurring: true },
    ];

    if (week <= 4) {
      tasks.push({ title: 'Read 20 pages', description: 'Daily reading session', type: 'HABIT', weekNumber: week, durationMinutes: 25, isRecurring: true });
    }

    if (week >= 3) {
      tasks.push({ title: 'Meditation session', description: '10 minutes of focused breathing', type: 'HABIT', weekNumber: week, durationMinutes: 10, isRecurring: true });
    }

    return tasks;
  }

  protected getSuccessCriteria(week: number, _template: FullGoalTemplate): string {
    if (week <= 3) return 'Morning routine completed every day this week';
    if (week <= 6) return '90%+ habit completion rate';
    return 'Habits feel natural — identity shift underway';
  }

  generate(template: FullGoalTemplate, answers: DiagnosticAnswers, context: UserContext): GeneratedPlan {
    const focuses = [
      'Design your ideal morning routine',
      'Lock in the habit stack',
      'Add mindfulness layer',
      'Build reading habit',
      'Deepen journaling practice',
      'Integrate weekly reflection',
      'Push boundaries — try one hard thing',
      'Evaluate and double down',
      'Share progress — accountability',
      'Refine the system',
      'Final sprint to targets',
      'Celebrate and plan next 90 days',
    ];

    const readingGoal = Number(answers['q_reading_goal'] ?? 12);
    const booksPerMonth = Math.ceil(readingGoal / 12);

    const initialTasks: PlannedTask[] = [
      { title: 'Design morning routine', description: `Draft your ideal AM routine (aim for ${booksPerMonth} books/month)`, type: 'ACTION', weekNumber: 1, durationMinutes: 20, isRecurring: false },
      { title: 'Morning habit block', description: 'Complete your morning routine', type: 'HABIT', weekNumber: 1, durationMinutes: 30, isRecurring: true },
      { title: 'Gratitude journal', description: 'Write 3 things you\'re grateful for', type: 'HABIT', weekNumber: 1, durationMinutes: 5, isRecurring: true },
    ];

    return this.buildBase(template, context, focuses, initialTasks);
  }
}
