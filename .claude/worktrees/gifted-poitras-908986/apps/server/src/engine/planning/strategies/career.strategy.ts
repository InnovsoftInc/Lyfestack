import type { DiagnosticAnswer, TemplateDefinition } from '../../../templates/template.types';
import type { IPlanningStrategy } from '../planning.strategy';
import { getAnswer } from '../planning.strategy';
import type { PlanDraft, TaskDraft } from '../planning.types';
import type { UserContext } from '../planning.types';
import { TaskType } from '@lyfestack/shared';

export class CareerStrategy implements IPlanningStrategy {
  generate(
    template: TemplateDefinition,
    answers: DiagnosticAnswer[],
    context: UserContext,
  ): PlanDraft {
    const targetRole = String(getAnswer(answers, 'dq-career-target') ?? 'new role');
    const timeline = String(getAnswer(answers, 'dq-career-timeline') ?? 'Within 6 months');
    const urgency = timeline === 'ASAP' || timeline === 'Within 3 months';

    const milestones = template.milestones.map((title, i) => ({
      title,
      dueDayOffset: Math.round(((i + 1) / template.milestones.length) * template.durationDays),
    }));

    const tasks: TaskDraft[] = [
      {
        title: 'Map required skills for target role',
        description: `Research 10 job postings for ${targetRole} and extract common required skills.`,
        type: TaskType.ACTION,
        durationMinutes: 90,
        dayOffset: 1,
        milestoneIndex: 0,
      },
      {
        title: 'Identify skills gap vs current profile',
        description: 'Compare target skills with your current resume and highlight gaps.',
        type: TaskType.ACTION,
        durationMinutes: 60,
        dayOffset: 3,
        milestoneIndex: 0,
      },
      {
        title: 'Set up learning plan',
        description: 'Identify 2-3 courses or resources to fill top skills gaps.',
        type: TaskType.ACTION,
        durationMinutes: 45,
        dayOffset: 7,
        milestoneIndex: 1,
      },
      {
        title: 'Daily learning block',
        description: `Spend 45 minutes on skill-building for ${targetRole}.`,
        type: TaskType.HABIT,
        durationMinutes: 45,
        dayOffset: 8,
        milestoneIndex: 1,
      },
      {
        title: 'Reach out to 5 people in target field',
        description: 'Send personalized LinkedIn messages or emails for informational interviews.',
        type: TaskType.SOCIAL,
        durationMinutes: 60,
        dayOffset: urgency ? 14 : 30,
        milestoneIndex: 3,
      },
      {
        title: 'Build portfolio project',
        description: `Create a tangible work sample demonstrating core skills for ${targetRole}.`,
        type: TaskType.MILESTONE,
        durationMinutes: 120,
        dayOffset: urgency ? 21 : 60,
        milestoneIndex: 2,
      },
      {
        title: 'Update resume and LinkedIn',
        description: 'Reframe your experience narrative toward the target role.',
        type: TaskType.ACTION,
        durationMinutes: 90,
        dayOffset: urgency ? 30 : 90,
        milestoneIndex: 4,
      },
      {
        title: 'Send 10 tailored applications',
        description: 'Apply to 10 positions with customized cover letters.',
        type: TaskType.ACTION,
        durationMinutes: 120,
        dayOffset: urgency ? 45 : 120,
        milestoneIndex: 4,
      },
    ];

    return {
      title: `${targetRole} — ${template.name}`,
      description: `A ${timeline.toLowerCase()} career pivot plan targeting ${targetRole}.`,
      estimatedDurationDays: urgency ? 90 : template.durationDays,
      milestones,
      tasks,
    };
  }
}
