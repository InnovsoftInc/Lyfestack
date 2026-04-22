import { v4 as uuidv4 } from 'uuid';
import { templateRegistry } from '../templates/TemplateRegistry';
import type { AllowedAction } from '../templates/types';
import { NotFoundError } from '../errors/AppError';

export interface PlanGenerationInput {
  userId: string;
  templateId: string;
  startDate: string;
  diagnosticAnswers: Record<string, string | number>;
}

export interface PlannedMilestone {
  id: string;
  templateMilestoneId: string;
  title: string;
  description: string;
  targetDate: string;
  successCriteria: string[];
  weekNumber: number;
}

export interface PlannedTask {
  id: string;
  title: string;
  description: string;
  type: string;
  scheduledFor: string;
  durationMinutes: number;
  weekNumber: number;
}

export interface IndicatorSchedule {
  metric: string;
  description: string;
  frequency: 'daily' | 'weekly';
  unit: string;
  targetValue?: number;
}

export interface GeneratedPlan {
  id: string;
  userId: string;
  templateId: string;
  title: string;
  startDate: string;
  endDate: string;
  totalWeeks: number;
  milestones: PlannedMilestone[];
  weekOneTasks: PlannedTask[];
  indicatorSchedule: IndicatorSchedule[];
}

const TASK_DURATION_BY_FREQUENCY: Record<AllowedAction['frequency'], number> = {
  daily: 30,
  weekly: 60,
  monthly: 90,
  'as-needed': 45,
};

const TASK_TYPE_BY_ACTION_TYPE: Record<string, string> = {
  schedule_time_block: 'ACTION',
  create_task_list: 'ACTION',
  weekly_review: 'REFLECTION',
  quarterly_planning: 'REFLECTION',
  distraction_audit: 'REFLECTION',
  daily_journal: 'REFLECTION',
  learning_session: 'HABIT',
  weekly_retrospective: 'REFLECTION',
  book_summary: 'REFLECTION',
  customer_outreach: 'ACTION',
  content_creation: 'ACTION',
  revenue_review: 'REFLECTION',
  product_iteration: 'ACTION',
  strategic_review: 'REFLECTION',
  create_post: 'ACTION',
  engage_audience: 'SOCIAL',
  content_analytics_review: 'REFLECTION',
  repurpose_content: 'ACTION',
  log_workout: 'HABIT',
  log_nutrition: 'HABIT',
  progress_check_in: 'REFLECTION',
  program_adjustment: 'ACTION',
  recovery_session: 'HABIT',
};

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0] ?? isoDate;
}

export function generatePlan(input: PlanGenerationInput): GeneratedPlan {
  const template = templateRegistry.getById(input.templateId);
  if (!template) {
    throw new NotFoundError(`Template '${input.templateId}'`);
  }

  const endDate = addDays(input.startDate, template.durationDays);
  const totalWeeks = Math.ceil(template.durationDays / 7);

  const milestones: PlannedMilestone[] = template.milestones.map((m) => ({
    id: uuidv4(),
    templateMilestoneId: m.id,
    title: m.title,
    description: m.description,
    targetDate: addDays(input.startDate, m.weekOffset * 7),
    successCriteria: m.successCriteria,
    weekNumber: m.weekOffset,
  }));

  const dailyActions = template.allowedActions.filter((a) => a.frequency === 'daily');
  const weeklyActions = template.allowedActions.filter((a) => a.frequency === 'weekly');

  const weekOneTasks: PlannedTask[] = [];

  for (let day = 0; day < 7; day++) {
    const action = dailyActions[day % dailyActions.length];
    if (!action) continue;
    weekOneTasks.push({
      id: uuidv4(),
      title: action.description,
      description: `Day ${day + 1}: ${action.description}`,
      type: TASK_TYPE_BY_ACTION_TYPE[action.type] ?? 'ACTION',
      scheduledFor: addDays(input.startDate, day),
      durationMinutes: TASK_DURATION_BY_FREQUENCY[action.frequency],
      weekNumber: 1,
    });
  }

  const weeklyAction = weeklyActions[0];
  if (weeklyAction) {
    weekOneTasks.push({
      id: uuidv4(),
      title: weeklyAction.description,
      description: `End of week 1: ${weeklyAction.description}`,
      type: TASK_TYPE_BY_ACTION_TYPE[weeklyAction.type] ?? 'REFLECTION',
      scheduledFor: addDays(input.startDate, 6),
      durationMinutes: TASK_DURATION_BY_FREQUENCY[weeklyAction.frequency],
      weekNumber: 1,
    });
  }

  const indicatorSchedule: IndicatorSchedule[] = template.leadingIndicators.map((li) => {
    const base: IndicatorSchedule = {
      metric: li.metric,
      description: li.description,
      frequency: li.targetFrequency,
      unit: li.unit,
    };
    if (li.targetValue !== undefined) {
      base.targetValue = li.targetValue;
    }
    return base;
  });

  return {
    id: uuidv4(),
    userId: input.userId,
    templateId: template.id,
    title: `${template.name} — ${input.startDate}`,
    startDate: input.startDate,
    endDate,
    totalWeeks,
    milestones,
    weekOneTasks,
    indicatorSchedule,
  };
}
