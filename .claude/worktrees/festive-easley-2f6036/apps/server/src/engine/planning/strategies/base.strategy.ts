import type { FullGoalTemplate, TemplateMilestone } from '../../../templates/templates.data';
import type { DiagnosticAnswers, GeneratedPlan, PlannedTask, PlanningStrategy, UserContext, WeeklyTarget } from '../types';

export abstract class BasePlanningStrategy implements PlanningStrategy {
  protected addWeeks(date: Date, weeks: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + weeks * 7);
    return d;
  }

  protected formatDate(date: Date): string {
    return date.toISOString().split('T')[0]!;
  }

  protected buildMilestones(template: FullGoalTemplate, startDate: Date) {
    return template.milestones.map((m: TemplateMilestone) => ({
      title: m.title,
      weekNumber: m.weekNumber,
      description: m.description,
      dueDate: this.formatDate(this.addWeeks(startDate, m.weekNumber)),
    }));
  }

  protected buildWeeklyTargets(
    template: FullGoalTemplate,
    _answers: DiagnosticAnswers,
    weeklyFocuses: string[],
  ): WeeklyTarget[] {
    return Array.from({ length: template.durationWeeks }, (_, i) => {
      const weekNumber = i + 1;
      const focus = weeklyFocuses[i] ?? `Week ${weekNumber}: Maintain momentum`;
      return {
        weekNumber,
        focus,
        tasks: this.getWeeklyTasks(weekNumber, template, _answers),
        successCriteria: this.getSuccessCriteria(weekNumber, template),
      };
    });
  }

  protected abstract getWeeklyTasks(week: number, template: FullGoalTemplate, answers: DiagnosticAnswers): PlannedTask[];
  protected abstract getSuccessCriteria(week: number, template: FullGoalTemplate): string;

  abstract generate(template: FullGoalTemplate, answers: DiagnosticAnswers, context: UserContext): GeneratedPlan;

  protected buildBase(
    template: FullGoalTemplate,
    context: UserContext,
    weeklyFocuses: string[],
    initialTasks: PlannedTask[],
  ): GeneratedPlan {
    const startDate = new Date();
    const targetDate = this.addWeeks(startDate, template.durationWeeks);
    const milestones = this.buildMilestones(template, startDate);
    const weeklyTargets = this.buildWeeklyTargets(template, {}, weeklyFocuses);

    return {
      templateId: template.id,
      userId: context.userId,
      title: template.name,
      description: template.description,
      durationWeeks: template.durationWeeks,
      startDate: this.formatDate(startDate),
      targetDate: this.formatDate(targetDate),
      milestones,
      weeklyTargets,
      initialDailyTasks: initialTasks,
    };
  }
}
