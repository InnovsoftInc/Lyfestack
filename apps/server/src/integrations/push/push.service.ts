import { logger } from '../../utils/logger';
import { config } from '../../config/config';

export type PushNotificationType =
  | 'daily_brief'
  | 'task_reminder'
  | 'streak_alert'
  | 'agent_complete';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushResponse {
  data: ExpoPushTicket[];
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

export class PushService {
  private async send(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (config.EXPO_PUSH_ACCESS_TOKEN) {
      headers['Authorization'] = `Bearer ${config.EXPO_PUSH_ACCESS_TOKEN}`;
    }

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'Expo push request failed');
      return [];
    }

    const json = (await res.json()) as ExpoPushResponse;
    return json.data;
  }

  async sendToToken(
    token: string,
    title: string,
    body: string,
    type: PushNotificationType,
    data?: Record<string, unknown>,
  ): Promise<void> {
    if (!isExpoPushToken(token)) {
      logger.warn({ token }, 'Invalid Expo push token format — skipping');
      return;
    }

    const tickets = await this.send([
      {
        to: token,
        title,
        body,
        sound: 'default',
        priority: 'high',
        data: { type, ...data },
      },
    ]);

    const ticket = tickets[0];
    if (ticket?.status === 'error') {
      logger.warn({ error: ticket.details?.error, message: ticket.message }, 'Push notification error');
    }
  }

  async sendDailyBrief(token: string, taskCount: number, greeting: string): Promise<void> {
    await this.sendToToken(
      token,
      'Your Daily Brief is Ready',
      greeting || `You have ${taskCount} task${taskCount !== 1 ? 's' : ''} today.`,
      'daily_brief',
      { taskCount },
    );
  }

  async sendTaskReminder(token: string, taskTitle: string, taskId: string): Promise<void> {
    await this.sendToToken(
      token,
      'Task Reminder',
      `Don't forget: ${taskTitle}`,
      'task_reminder',
      { taskId },
    );
  }

  async sendStreakAlert(token: string, streakDays: number, atRisk: boolean): Promise<void> {
    const title = atRisk ? 'Streak at Risk!' : `${streakDays}-Day Streak!`;
    const body = atRisk
      ? `Complete a task today to keep your ${streakDays}-day streak alive.`
      : `You've been consistent for ${streakDays} days. Keep it up!`;
    await this.sendToToken(token, title, body, 'streak_alert', { streakDays, atRisk });
  }

  async sendAgentComplete(token: string, actionType: string, summary: string): Promise<void> {
    await this.sendToToken(
      token,
      'Agent Action Complete',
      summary || `${actionType} finished — tap to review.`,
      'agent_complete',
      { actionType },
    );
  }
}

export const pushService = new PushService();
