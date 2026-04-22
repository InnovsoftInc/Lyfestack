import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { TaskStatus, ApprovalState } from '@lyfestack/shared';
import type { DailyBrief, Task } from '@lyfestack/shared';
import { rankTasks } from '../services/scoring.service';
import type { ScoringInput } from '../services/scoring.service';
import { logger } from '../utils/logger';

export interface UserSnapshot {
  userId: string;
  displayName: string;
  timezone: string;
  activeTasks: Task[];
  goalProgressScores: Record<string, number>;
}

export interface DailyLoopConfig {
  /** Cron expression — default is 6 AM UTC */
  schedule: string;
  /** Max tasks surfaced in the daily brief */
  maxBriefTasks: number;
}

const DEFAULT_CONFIG: DailyLoopConfig = {
  schedule: '0 6 * * *',
  maxBriefTasks: 5,
};

function buildGreeting(name: string, date: Date): string {
  const hour = date.getUTCHours();
  const day = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;

  let timeGreet = 'Good morning';
  if (hour >= 12 && hour < 17) timeGreet = 'Good afternoon';
  else if (hour >= 17) timeGreet = 'Good evening';

  const suffix = isWeekend
    ? 'Hope you have a restful weekend ahead.'
    : `Let's make ${day} count.`;

  return `${timeGreet}, ${name}. ${suffix}`;
}

function buildInsights(snapshot: UserSnapshot, topTasks: Task[]): string[] {
  const insights: string[] = [];

  const completedToday = snapshot.activeTasks.filter((t) => t.status === TaskStatus.COMPLETED);
  if (completedToday.length > 0) {
    insights.push(`You've already completed ${completedToday.length} task${completedToday.length > 1 ? 's' : ''} today — great momentum.`);
  }

  const pendingApproval = snapshot.activeTasks.filter(
    (t) => t.approvalState === ApprovalState.PENDING,
  );
  if (pendingApproval.length > 0) {
    insights.push(`${pendingApproval.length} task${pendingApproval.length > 1 ? 's need' : ' needs'} your approval before it can start.`);
  }

  const overdue = snapshot.activeTasks.filter((t) => {
    if (!t.scheduledFor) return false;
    return new Date(t.scheduledFor) < new Date() && t.status === TaskStatus.PENDING;
  });
  if (overdue.length > 0) {
    insights.push(`${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} — consider rescheduling or skipping.`);
  }

  const goalIds = [...new Set(topTasks.map((t) => t.goalId))];
  goalIds.forEach((goalId) => {
    const progress = snapshot.goalProgressScores[goalId];
    if (progress !== undefined && progress >= 80) {
      insights.push(`You're in the final stretch on one of your goals (${progress}% complete) — push through!`);
    }
  });

  if (insights.length === 0) {
    insights.push('Stay consistent — small daily actions compound into big results.');
  }

  return insights;
}

function buildSummary(topTasks: Task[], total: number): string {
  if (total === 0) return 'No active tasks today. Consider setting up your first goal.';
  const shown = topTasks.length;
  return `You have ${total} active task${total !== 1 ? 's' : ''}. Here are your top ${shown} for today, ranked by priority.`;
}

function taskToScoringInput(task: Task): ScoringInput {
  const input: ScoringInput = {
    taskId: task.id,
    impact: 7,
    effort: Math.min(10, Math.max(1, Math.round((task.durationMinutes ?? 30) / 10))),
    blockedByCount: task.approvalState === ApprovalState.PENDING ? 1 : 0,
    unlocksCount: 0,
    confidence: task.approvalState === ApprovalState.APPROVED ? 1 : 0.6,
  };
  if (task.scheduledFor !== undefined) {
    input.dueDate = task.scheduledFor;
  }
  return input;
}

export function generateDailyBrief(snapshot: UserSnapshot, config = DEFAULT_CONFIG): DailyBrief {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]!;

  const actionable = snapshot.activeTasks.filter(
    (t) =>
      t.status === TaskStatus.PENDING ||
      t.status === TaskStatus.APPROVED ||
      t.status === TaskStatus.IN_PROGRESS,
  );

  const scoringInputs = actionable.map(taskToScoringInput);
  const ranked = rankTasks(scoringInputs);
  const topIds = new Set(ranked.slice(0, config.maxBriefTasks).map((s) => s.taskId));
  const topTasks = actionable.filter((t) => topIds.has(t.id));

  const greeting = buildGreeting(snapshot.displayName, now);
  const summary = buildSummary(topTasks, actionable.length);
  const insights = buildInsights(snapshot, topTasks);

  return {
    id: uuidv4(),
    userId: snapshot.userId,
    date: dateStr,
    greeting,
    summary,
    tasks: topTasks,
    insights,
    generatedAt: now.toISOString(),
  };
}

export class DailyLoopEngine {
  private task: ReturnType<typeof cron.schedule> | null = null;
  private readonly config: DailyLoopConfig;
  private readonly fetchUsers: () => Promise<UserSnapshot[]>;
  private readonly onBrief: (brief: DailyBrief) => Promise<void>;

  constructor(
    fetchUsers: () => Promise<UserSnapshot[]>,
    onBrief: (brief: DailyBrief) => Promise<void>,
    config: Partial<DailyLoopConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fetchUsers = fetchUsers;
    this.onBrief = onBrief;
  }

  start(): void {
    if (this.task) return;

    if (!cron.validate(this.config.schedule)) {
      throw new Error(`Invalid cron schedule: "${this.config.schedule}"`);
    }

    this.task = cron.schedule(this.config.schedule, () => void this.runCycle());
    logger.info({ schedule: this.config.schedule }, 'Daily loop engine started');
  }

  stop(): void {
    this.task?.stop();
    this.task = null;
    logger.info('Daily loop engine stopped');
  }

  async runCycle(): Promise<void> {
    logger.info('Daily loop: generating briefs');
    let users: UserSnapshot[];

    try {
      users = await this.fetchUsers();
    } catch (err) {
      logger.error({ err }, 'Daily loop: failed to fetch users');
      return;
    }

    await Promise.allSettled(
      users.map(async (snapshot) => {
        try {
          const brief = generateDailyBrief(snapshot, this.config);
          await this.onBrief(brief);
          logger.debug({ userId: snapshot.userId }, 'Daily loop: brief generated');
        } catch (err) {
          logger.error({ err, userId: snapshot.userId }, 'Daily loop: brief generation failed');
        }
      }),
    );

    logger.info({ count: users.length }, 'Daily loop: cycle complete');
  }
}
