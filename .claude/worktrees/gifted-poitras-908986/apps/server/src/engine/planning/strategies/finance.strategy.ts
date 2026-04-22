import type { DiagnosticAnswer, TemplateDefinition } from '../../../templates/template.types';
import type { IPlanningStrategy } from '../planning.strategy';
import { getAnswer } from '../planning.strategy';
import type { PlanDraft, TaskDraft } from '../planning.types';
import type { UserContext } from '../planning.types';
import { TaskType } from '@lyfestack/shared';

export class FinanceStrategy implements IPlanningStrategy {
  generate(
    template: TemplateDefinition,
    answers: DiagnosticAnswer[],
    context: UserContext,
  ): PlanDraft {
    const hasDebt = Boolean(getAnswer(answers, 'dq-finance-debt'));
    const savingsRate = Number(getAnswer(answers, 'dq-finance-savings') ?? 0);
    const goalType = String(getAnswer(answers, 'dq-finance-goal') ?? 'Emergency fund');

    const milestones = template.milestones.map((title, i) => ({
      title,
      dueDayOffset: Math.round(((i + 1) / template.milestones.length) * template.durationDays),
    }));

    const tasks: TaskDraft[] = [];

    // Week 1: foundation
    tasks.push(
      {
        title: 'Audit all income sources and expenses',
        description: 'List every income source and recurring expense for the last 3 months.',
        type: TaskType.ACTION,
        durationMinutes: 60,
        dayOffset: 1,
        milestoneIndex: 0,
      },
      {
        title: 'Create monthly budget template',
        description: 'Set up 50/30/20 budget categories tailored to your income.',
        type: TaskType.ACTION,
        durationMinutes: 45,
        dayOffset: 3,
        milestoneIndex: 0,
      },
    );

    if (hasDebt) {
      tasks.push({
        title: 'List all debts with interest rates',
        description: 'Organize debts by interest rate to prioritize payoff strategy.',
        type: TaskType.ACTION,
        durationMinutes: 30,
        dayOffset: 5,
        milestoneIndex: 0,
      });
    }

    // Monthly tracking tasks
    for (let month = 1; month <= 3; month++) {
      tasks.push(
        {
          title: `Month ${month}: Track all spending`,
          description: `Log every transaction in your budget categories for month ${month}.`,
          type: TaskType.HABIT,
          durationMinutes: 10,
          dayOffset: (month - 1) * 30 + 7,
          milestoneIndex: 1,
        },
        {
          title: `Month ${month}: Budget review and adjustment`,
          description: `Review spending vs budget and make adjustments for next month.`,
          type: TaskType.REFLECTION,
          durationMinutes: 30,
          dayOffset: month * 30 - 1,
          milestoneIndex: month < 3 ? 1 : 3,
        },
      );
    }

    const savingsGap = Math.max(0, 20 - savingsRate);
    const savingsTarget = goalType === 'Emergency fund' ? 'emergency fund' : goalType.toLowerCase();

    return {
      title: `${goalType} — ${template.name}`,
      description: `A ${template.durationDays}-day plan to build your ${savingsTarget}. ${savingsGap > 0 ? `Target: increase savings rate by ${savingsGap}%.` : 'Maintain strong savings discipline.'}`,
      estimatedDurationDays: template.durationDays,
      milestones,
      tasks,
    };
  }
}
