import { v4 as uuidv4 } from 'uuid';
import { TaskType, TaskStatus, ApprovalState, GoalStatus } from '@lyfestack/shared';
import { TemplateDefinition } from '../templates/TemplateRegistry';

export interface GeneratedTask {
  id: string;
  goalId: string;
  userId: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  approvalState: ApprovalState;
  scheduledFor: string;
  durationMinutes: number;
  createdAt: string;
}

export interface GeneratedGoal {
  id: string;
  userId: string;
  templateId: string;
  title: string;
  description: string;
  status: GoalStatus;
  targetDate: string;
  progressScore: number;
  createdAt: string;
}

export interface GeneratedPlan {
  id: string;
  userId: string;
  title: string;
  description: string;
  goalIds: string[];
  goal: GeneratedGoal;
  status: 'active';
  startDate: string;
  endDate: string;
  milestones: GeneratedTask[];
  weeklyTaskBlueprint: GeneratedTask[];
  totalScheduledTasks: number;
  createdAt: string;
}

export interface PlanInput {
  userId: string;
  templateId: string;
  goalTitle: string;
  startDate: string;
}

const TASK_DURATION_MINUTES: Record<TaskType, number> = {
  [TaskType.ACTION]: 30,
  [TaskType.HABIT]: 20,
  [TaskType.MILESTONE]: 60,
  [TaskType.REFLECTION]: 15,
  [TaskType.SOCIAL]: 20,
};

const WEEKLY_FREQUENCY: Record<TaskType, number> = {
  [TaskType.ACTION]: 3,
  [TaskType.HABIT]: 5,
  [TaskType.MILESTONE]: 1,
  [TaskType.REFLECTION]: 1,
  [TaskType.SOCIAL]: 2,
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0] as string;
}

function buildMilestoneTasks(
  milestones: TemplateDefinition['milestones'],
  goalId: string,
  userId: string,
  startDate: string,
  now: string,
): GeneratedTask[] {
  return milestones.map((m) => ({
    id: uuidv4(),
    goalId,
    userId,
    title: m.title,
    description: m.description,
    type: TaskType.MILESTONE,
    status: TaskStatus.PENDING,
    approvalState: ApprovalState.APPROVED,
    scheduledFor: addDays(startDate, m.weekNumber * 7),
    durationMinutes: TASK_DURATION_MINUTES[TaskType.MILESTONE],
    createdAt: now,
  }));
}

function buildWeeklyBlueprint(
  taskTypes: TaskType[],
  goalId: string,
  userId: string,
  startDate: string,
  now: string,
): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];

  for (const type of taskTypes) {
    if (type === TaskType.MILESTONE) continue;
    const freq = WEEKLY_FREQUENCY[type] ?? 1;
    for (let i = 0; i < freq; i++) {
      tasks.push({
        id: uuidv4(),
        goalId,
        userId,
        title: `${type.charAt(0) + type.slice(1).toLowerCase()} session ${i + 1}`,
        description: `Weekly recurring ${type.toLowerCase()} task`,
        type,
        status: TaskStatus.PENDING,
        approvalState: ApprovalState.PENDING,
        scheduledFor: addDays(startDate, i % 7),
        durationMinutes: TASK_DURATION_MINUTES[type],
        createdAt: now,
      });
    }
  }

  return tasks;
}

export function generatePlan(input: PlanInput, template: TemplateDefinition): GeneratedPlan {
  const now = new Date().toISOString();
  const planId = uuidv4();
  const goalId = uuidv4();

  const endDate = addDays(input.startDate, template.durationDays);

  const goal: GeneratedGoal = {
    id: goalId,
    userId: input.userId,
    templateId: template.id,
    title: input.goalTitle,
    description: template.description,
    status: GoalStatus.ACTIVE,
    targetDate: endDate,
    progressScore: 0,
    createdAt: now,
  };

  const milestones = buildMilestoneTasks(
    template.milestones,
    goalId,
    input.userId,
    input.startDate,
    now,
  );

  const weeklyTaskBlueprint = buildWeeklyBlueprint(
    template.defaultTaskTypes,
    goalId,
    input.userId,
    input.startDate,
    now,
  );

  const weeksTotal = Math.ceil(template.durationDays / 7);
  const tasksPerWeek = weeklyTaskBlueprint.length;
  const totalScheduledTasks = milestones.length + weeksTotal * tasksPerWeek;

  return {
    id: planId,
    userId: input.userId,
    title: `Plan: ${input.goalTitle}`,
    description: `${template.durationDays}-day plan generated from the ${template.name} template.`,
    goalIds: [goalId],
    goal,
    status: 'active',
    startDate: input.startDate,
    endDate,
    milestones,
    weeklyTaskBlueprint,
    totalScheduledTasks,
    createdAt: now,
  };
}
