import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';
import { UserRepository } from '../repositories/user.repository';
import { pushService } from '../integrations/push/push.service';

export interface StreakRecord {
  userId: string;
  currentStreak: number;
  lastActivityDate: string;
}

// In-memory streak store — replace with DB-backed store for production
const streakStore = new Map<string, StreakRecord>();

export function updateStreak(userId: string): StreakRecord {
  const today = new Date().toISOString().slice(0, 10);
  const existing = streakStore.get(userId);

  if (!existing) {
    const record: StreakRecord = { userId, currentStreak: 1, lastActivityDate: today };
    streakStore.set(userId, record);
    return record;
  }

  const lastDate = new Date(existing.lastActivityDate);
  const todayDate = new Date(today);
  const diffDays = Math.floor(
    (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return existing; // Already recorded today
  }

  if (diffDays === 1) {
    existing.currentStreak += 1;
  } else {
    existing.currentStreak = 1; // Streak broken
  }

  existing.lastActivityDate = today;
  return existing;
}

export function getStreak(userId: string): StreakRecord | null {
  return streakStore.get(userId) ?? null;
}

export async function runStreakCheckJob(): Promise<void> {
  logger.info('Streak check job — evaluating user streaks');

  try {
    const supabase = getSupabaseClient();
    const userRepo = new UserRepository(supabase);
    const usersWithTokens = await userRepo.findAllWithPushTokens();

    if (usersWithTokens.length === 0) {
      logger.debug('No users with push tokens — skipping streak check');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    let alertsSent = 0;

    for (const user of usersWithTokens) {
      try {
        const streak = streakStore.get(user.id);
        if (!streak) continue;

        const lastDate = streak.lastActivityDate;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);

        // User was active yesterday but not yet today — streak at risk
        const atRisk = lastDate === yesterdayStr;
        // Celebrate milestones: 7, 14, 30, 60, 90 day streaks
        const isMilestone = [7, 14, 30, 60, 90].includes(streak.currentStreak);

        if (atRisk || isMilestone) {
          await pushService.sendStreakAlert(user.pushToken, streak.currentStreak, atRisk);
          alertsSent++;
        }
      } catch (err) {
        logger.warn({ userId: user.id, err }, 'Failed to send streak alert');
      }
    }

    logger.info({ alertsSent, total: usersWithTokens.length }, 'Streak check complete');
  } catch (err) {
    logger.error({ err }, 'Streak check job failed');
  }
}
