import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';
import { UserRepository } from '../repositories/user.repository';
import { pushService } from '../integrations/push/push.service';

export async function runDailyBriefJob(): Promise<void> {
  logger.info('Daily brief job — checking for users due for briefs');

  try {
    const supabase = getSupabaseClient();
    const userRepo = new UserRepository(supabase);

    const usersWithTokens = await userRepo.findAllWithPushTokens();
    if (usersWithTokens.length === 0) {
      logger.debug('No users with push tokens — skipping brief notifications');
      return;
    }

    const now = new Date();
    const hour = now.getHours();

    // Only send briefs in the morning window (6 AM – 10 AM in server local time)
    // For production, this should respect each user's timezone
    if (hour < 6 || hour >= 10) {
      logger.debug({ hour }, 'Outside morning brief window — skipping');
      return;
    }

    let sent = 0;
    for (const user of usersWithTokens) {
      try {
        // In production: check if brief was already sent today, query task count from DB
        await pushService.sendDailyBrief(
          user.pushToken,
          0, // taskCount — wire to task repository for real count
          `Good morning! Your Lyfestack brief is ready.`,
        );
        sent++;
      } catch (err) {
        logger.warn({ userId: user.id, err }, 'Failed to send daily brief push');
      }
    }

    logger.info({ sent, total: usersWithTokens.length }, 'Daily brief notifications sent');
  } catch (err) {
    logger.error({ err }, 'Daily brief job failed');
  }
}
