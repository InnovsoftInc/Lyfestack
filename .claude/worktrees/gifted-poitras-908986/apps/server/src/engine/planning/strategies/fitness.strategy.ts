import type { DiagnosticAnswer, TemplateDefinition } from '../../../templates/template.types';
import type { IPlanningStrategy } from '../planning.strategy';
import { getAnswer, scaleTaskLoad } from '../planning.strategy';
import type { PlanDraft, TaskDraft } from '../planning.types';
import type { UserContext } from '../planning.types';
import { TaskType } from '@lyfestack/shared';

export class FitnessStrategy implements IPlanningStrategy {
  generate(
    template: TemplateDefinition,
    answers: DiagnosticAnswer[],
    context: UserContext,
  ): PlanDraft {
    const daysPerWeek = Number(getAnswer(answers, 'dq-fitness-days') ?? 3);
    const hasGym = Boolean(getAnswer(answers, 'dq-fitness-equipment'));
    const goalType = String(getAnswer(answers, 'dq-fitness-goal') ?? 'General health');

    const workoutLabel = hasGym ? 'Gym workout' : 'Home workout';
    const totalWeeks = Math.ceil(template.durationDays / 7);
    const taskCount = scaleTaskLoad(daysPerWeek * totalWeeks, context.engagementVelocity, context.currentTaskLoad);

    const milestones = template.milestones.map((title, i) => ({
      title,
      dueDayOffset: Math.round(((i + 1) / template.milestones.length) * template.durationDays),
    }));

    const tasks: TaskDraft[] = [];
    for (let i = 0; i < taskCount; i++) {
      const week = Math.floor(i / daysPerWeek);
      const dayInWeek = i % daysPerWeek;
      const dayOffset = week * 7 + dayInWeek * Math.floor(7 / daysPerWeek);
      const intensity = week < 2 ? 'light' : week < 4 ? 'moderate' : 'intense';

      tasks.push({
        title: `${intensity} ${workoutLabel} — ${goalType} focus`,
        description: `Week ${week + 1} ${intensity} training session targeting ${goalType.toLowerCase()}.`,
        type: TaskType.HABIT,
        durationMinutes: 30 + week * 5,
        dayOffset,
        milestoneIndex: week < 1 ? 0 : week < 4 ? 1 : week < 8 ? 2 : 3,
      });
    }

    // Add weekly reflection tasks
    for (let week = 0; week < totalWeeks; week += 2) {
      tasks.push({
        title: 'Weekly fitness check-in',
        description: 'Log progress, note energy levels, and adjust next week\'s plan.',
        type: TaskType.REFLECTION,
        durationMinutes: 15,
        dayOffset: week * 7 + 6,
      });
    }

    return {
      title: `${goalType} — ${template.name}`,
      description: `A personalized ${daysPerWeek}-days/week fitness plan focused on ${goalType.toLowerCase()}.`,
      estimatedDurationDays: template.durationDays,
      milestones,
      tasks,
    };
  }
}
