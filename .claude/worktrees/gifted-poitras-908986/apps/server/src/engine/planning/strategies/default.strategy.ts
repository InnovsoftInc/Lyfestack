import type { DiagnosticAnswer, TemplateDefinition } from '../../../templates/template.types';
import type { IPlanningStrategy } from '../planning.strategy';
import { scaleTaskLoad } from '../planning.strategy';
import type { PlanDraft, TaskDraft } from '../planning.types';
import type { UserContext } from '../planning.types';
import { TaskType } from '@lyfestack/shared';

export class DefaultStrategy implements IPlanningStrategy {
  generate(
    template: TemplateDefinition,
    _answers: DiagnosticAnswer[],
    context: UserContext,
  ): PlanDraft {
    const totalWeeks = Math.ceil(template.durationDays / 7);
    const baseTasksPerWeek = 3;
    const totalTasks = scaleTaskLoad(
      baseTasksPerWeek * totalWeeks,
      context.engagementVelocity,
      context.currentTaskLoad,
    );

    const milestones = template.milestones.map((title, i) => ({
      title,
      dueDayOffset: Math.round(((i + 1) / template.milestones.length) * template.durationDays),
    }));

    const tasks: TaskDraft[] = [];
    const taskTypes = template.defaultTaskTypes as TaskType[];

    for (let i = 0; i < totalTasks; i++) {
      const dayOffset = Math.floor((i / totalTasks) * template.durationDays);
      const typeIndex = i % taskTypes.length;
      const taskType = taskTypes[typeIndex] ?? TaskType.ACTION;
      const phase = i < totalTasks * 0.33 ? 'Foundation' : i < totalTasks * 0.66 ? 'Build' : 'Reinforce';

      tasks.push({
        title: `${phase}: ${template.name} task ${i + 1}`,
        description: `Structured task for ${template.name} — phase ${phase.toLowerCase()}.`,
        type: taskType,
        durationMinutes: 30,
        dayOffset,
        milestoneIndex: Math.min(
          template.milestones.length - 1,
          Math.floor((i / totalTasks) * template.milestones.length),
        ),
      });
    }

    return {
      title: template.name,
      description: template.description,
      estimatedDurationDays: template.durationDays,
      milestones,
      tasks,
    };
  }
}
