import type { FullGoalTemplate } from '../../../templates/templates.data';
import type { DiagnosticAnswers, GeneratedPlan, PlannedTask, UserContext } from '../types';
import { BasePlanningStrategy } from './base.strategy';

export class FitnessStrategy extends BasePlanningStrategy {
  protected getWeeklyTasks(week: number, _template: FullGoalTemplate, answers: DiagnosticAnswers): PlannedTask[] {
    const daysPerWeek = Math.min(6, Math.max(2, Number(answers['q_workout_days'] ?? 4)));
    const goal = String(answers['q_fitness_goal'] ?? 'General health & energy');
    const tasks: PlannedTask[] = [];

    const workoutTitle = goal.includes('muscle') ? 'Strength training session' : goal.includes('cardio') || goal.includes('endurance') ? 'Cardio / endurance session' : 'Workout session';
    tasks.push({ title: workoutTitle, description: `Complete today\'s planned ${goal.toLowerCase()} workout`, type: 'HABIT', weekNumber: week, durationMinutes: 45, isRecurring: true });

    if (daysPerWeek >= 4) {
      tasks.push({ title: 'Active recovery / stretching', description: '15-20 min mobility or light walk on rest days', type: 'HABIT', weekNumber: week, durationMinutes: 20, isRecurring: true });
    }

    if (week % 4 === 0) {
      tasks.push({ title: 'Progress check-in', description: 'Take measurements / photos, update progress log', type: 'REFLECTION', weekNumber: week, durationMinutes: 15, isRecurring: false });
    }

    return tasks;
  }

  protected getSuccessCriteria(week: number, _template: FullGoalTemplate): string {
    if (week <= 2) return '0 missed planned workouts this week';
    if (week <= 5) return 'Habit forming — no skipped days';
    if (week === 6) return 'Progress check complete, on track';
    return 'Approaching goal milestone';
  }

  generate(template: FullGoalTemplate, answers: DiagnosticAnswers, context: UserContext): GeneratedPlan {
    const goal = String(answers['q_fitness_goal'] ?? 'General health & energy');
    const daysPerWeek = Number(answers['q_workout_days'] ?? 4);

    const focuses = Array.from({ length: template.durationWeeks }, (_, i) => {
      const week = i + 1;
      if (week === 1) return 'Start — don\'t optimize yet, just show up';
      if (week === 2) return 'Build the workout habit';
      if (week === 3) return '21-day consistency streak';
      if (week === 6) return 'Halfway progress check';
      if (week === 12) return 'Final push to goal';
      return `${goal} — week ${week}`;
    });

    const initialTasks: PlannedTask[] = [
      { title: 'Create workout schedule', description: `Block ${daysPerWeek} workout days in your calendar`, type: 'ACTION', weekNumber: 1, durationMinutes: 15, isRecurring: false },
      { title: 'Baseline measurements', description: 'Record starting weight, key measurements, or fitness test', type: 'ACTION', weekNumber: 1, durationMinutes: 15, isRecurring: false },
      { title: 'First workout', description: `Complete first ${goal.toLowerCase()} session`, type: 'ACTION', weekNumber: 1, durationMinutes: 45, isRecurring: false },
    ];

    return this.buildBase(template, context, focuses, initialTasks);
  }
}
