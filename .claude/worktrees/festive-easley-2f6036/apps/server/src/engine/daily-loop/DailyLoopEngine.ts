import { supabase } from '../../lib/supabase';
import { goalRepository } from '../../repositories/goal.repository';
import { scoringService } from '../../services/scoring.service';
import type { DailyBrief, Task } from '@lyfestack/shared';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface UserRow {
  id: string;
  timezone: string;
  preferred_brief_hour: number; // 0-23, default 7 (7 AM local)
  engagement_velocity: number;  // 0-1
}

export class DailyLoopEngine {
  /** Returns users whose brief should be generated right now (within ±15 min window). */
  async getUsersDue(): Promise<UserRow[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, timezone, preferred_brief_hour, engagement_velocity')
      .eq('onboarding_completed', true);

    if (error || !data) return [];

    const now = new Date();
    return (data as UserRow[]).filter((user) => {
      try {
        const localHour = new Date(now.toLocaleString('en-US', { timeZone: user.timezone })).getHours();
        const localMinute = new Date(now.toLocaleString('en-US', { timeZone: user.timezone })).getMinutes();
        const targetHour = user.preferred_brief_hour ?? 7;
        return localHour === targetHour && localMinute < 15;
      } catch {
        return false;
      }
    });
  }

  async runForUser(user: UserRow): Promise<DailyBrief | null> {
    try {
      const today = new Date().toISOString().split('T')[0]!;

      // Skip if brief already generated today
      const { data: existing } = await supabase
        .from('daily_briefs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (existing) return null;

      const activeGoals = await goalRepository.findActiveByUserId(user.id);
      const scoredTasks = await scoringService.scoreTasksForUser(user.id, {
        engagementVelocity: user.engagement_velocity ?? 0.5,
      });

      const tasks: Task[] = scoredTasks.map((s) => s.task);
      const brief: DailyBrief = {
        id: uuidv4(),
        userId: user.id,
        date: today,
        greeting: this.buildGreeting(),
        summary: `You have ${activeGoals.length} active goal${activeGoals.length !== 1 ? 's' : ''} and ${tasks.length} prioritized task${tasks.length !== 1 ? 's' : ''} today.`,
        tasks,
        insights: this.buildInsights(scoredTasks.map((s) => s.score)),
        generatedAt: new Date().toISOString(),
      };

      await supabase.from('daily_briefs').insert({
        id: brief.id,
        user_id: brief.userId,
        date: brief.date,
        greeting: brief.greeting,
        summary: brief.summary,
        tasks: brief.tasks,
        insights: brief.insights,
        generated_at: brief.generatedAt,
      });

      // TODO: send push notification when notification service is implemented
      logger.info({ userId: user.id, briefId: brief.id }, 'Daily brief generated');
      return brief;
    } catch (err) {
      logger.error({ userId: user.id, err }, 'Failed to generate daily brief');
      return null;
    }
  }

  async runMorningCycle(): Promise<void> {
    const users = await this.getUsersDue();
    logger.info({ count: users.length }, 'Running morning cycle');
    await Promise.allSettled(users.map((u) => this.runForUser(u)));
  }

  private buildGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning!';
    if (hour < 17) return 'Good afternoon!';
    return 'Good evening!';
  }

  private buildInsights(scores: number[]): string[] {
    if (scores.length === 0) return ['No tasks queued — take time to plan.'];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const insights: string[] = [];
    if (avg > 0.75) insights.push('High-priority day — block distractions and focus.');
    else if (avg > 0.5) insights.push('Moderate priority mix — tackle the top task first.');
    else insights.push('Light day — good time to catch up on smaller items.');
    return insights;
  }
}

export const dailyLoopEngine = new DailyLoopEngine();
