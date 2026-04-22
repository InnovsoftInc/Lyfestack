import { v4 as uuidv4 } from 'uuid';
import { TaskType } from '@lyfestack/shared';
import { GeneratedPlan, GeneratedTask } from './PlanningEngine';

export interface DailyBriefTask {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  durationMinutes: number;
  scheduledFor: string;
}

export interface DailyBriefResult {
  id: string;
  userId: string;
  date: string;
  greeting: string;
  summary: string;
  tasks: DailyBriefTask[];
  insights: string[];
  generatedAt: string;
}

export interface DailyLoopInput {
  userId: string;
  date: string;
  plan: GeneratedPlan;
  currentStreak?: number | undefined;
  currentScore?: number | undefined;
}

const DAY_SCHEDULES: Record<TaskType, number[]> = {
  [TaskType.HABIT]: [0, 1, 2, 3, 4],
  [TaskType.ACTION]: [0, 2, 4],
  [TaskType.REFLECTION]: [6],
  [TaskType.SOCIAL]: [1, 3],
  [TaskType.MILESTONE]: [],
};

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getUTCDay();
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 86400000;
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

function getGreeting(dateStr: string): string {
  const hour = new Date().getUTCHours();
  const dow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dow[new Date(dateStr).getUTCDay()] ?? 'Today';
  if (hour < 12) return `Good morning — here's your ${dayName} brief.`;
  if (hour < 17) return `Good afternoon — here's what's on for ${dayName}.`;
  return `Good evening — here's your ${dayName} plan.`;
}

function selectTodaysTasks(
  plan: GeneratedPlan,
  date: string,
): DailyBriefTask[] {
  const dow = getDayOfWeek(date);
  const selected: DailyBriefTask[] = [];

  for (const task of plan.milestones) {
    if (task.scheduledFor === date) {
      selected.push(toBriefTask(task));
    }
  }

  for (const task of plan.weeklyTaskBlueprint) {
    const schedule = DAY_SCHEDULES[task.type] ?? [];
    if (schedule.includes(dow)) {
      selected.push({ ...toBriefTask(task), scheduledFor: date });
    }
  }

  return selected;
}

function toBriefTask(task: GeneratedTask): DailyBriefTask {
  return {
    id: uuidv4(),
    title: task.title,
    description: task.description,
    type: task.type,
    durationMinutes: task.durationMinutes,
    scheduledFor: task.scheduledFor,
  };
}

function buildInsights(
  plan: GeneratedPlan,
  date: string,
  streak: number,
  score: number,
): string[] {
  const insights: string[] = [];
  const daysIn = daysBetween(plan.startDate, date);
  const progress = Math.round((daysIn / plan.goal.targetDate.length) * 100);

  if (streak >= 7) {
    insights.push(`You're on a ${streak}-day streak — keep the momentum going.`);
  } else if (streak === 0) {
    insights.push('Today is a fresh start — every expert was once a beginner.');
  }

  if (score >= 80) {
    insights.push(`Progress score ${score} — you're executing at a high level.`);
  } else if (score < 50 && daysIn > 7) {
    insights.push('Your score has room to grow — consistency is the fastest lever.');
  }

  const nextMilestone = plan.milestones.find((m) => m.scheduledFor >= date);
  if (nextMilestone) {
    const daysToMilestone = daysBetween(date, nextMilestone.scheduledFor);
    insights.push(
      `Next milestone "${nextMilestone.title}" is ${daysToMilestone} day${daysToMilestone === 1 ? '' : 's'} away.`,
    );
  }

  if (insights.length === 0) {
    insights.push(`Day ${daysIn + 1} of ${plan.goal.title} — stay focused on today.`);
  }

  void progress;
  return insights;
}

export function generateDailyBrief(input: DailyLoopInput): DailyBriefResult {
  const { userId, date, plan, currentStreak = 0, currentScore = 0 } = input;
  const now = new Date().toISOString();

  const tasks = selectTodaysTasks(plan, date);
  const totalMinutes = tasks.reduce((sum, t) => sum + t.durationMinutes, 0);
  const insights = buildInsights(plan, date, currentStreak, currentScore);
  const greeting = getGreeting(date);

  const summary =
    tasks.length === 0
      ? 'Rest day — no tasks scheduled. Use this time to reflect or prepare.'
      : `${tasks.length} task${tasks.length > 1 ? 's' : ''} scheduled today, ~${totalMinutes} minutes total.`;

  return {
    id: uuidv4(),
    userId,
    date,
    greeting,
    summary,
    tasks,
    insights,
    generatedAt: now,
  };
}
