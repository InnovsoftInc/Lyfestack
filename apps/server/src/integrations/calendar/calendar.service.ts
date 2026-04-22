import { config } from '../../config/config';
import { logger } from '../../utils/logger';
import type { Task } from '@lyfestack/shared';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

export interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
}

export interface StoredCalendarTokens {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// In-memory token store — replace with DB-backed store for production
const tokenStore = new Map<string, StoredCalendarTokens>();

export class CalendarService {
  private get clientId(): string {
    return config.GOOGLE_CLIENT_ID ?? '';
  }

  private get clientSecret(): string {
    return config.GOOGLE_CLIENT_SECRET ?? '';
  }

  private get redirectUri(): string {
    return `${config.APP_BASE_URL}/integrations/calendar/callback`;
  }

  getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state: userId,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, userId: string): Promise<void> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google token exchange failed: ${text}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    tokenStore.set(userId, {
      userId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? '',
      expiresAt: Date.now() + data.expires_in * 1000,
    });

    logger.info({ userId }, 'Google Calendar connected');
  }

  async disconnect(userId: string): Promise<void> {
    tokenStore.delete(userId);
  }

  isConnected(userId: string): boolean {
    return tokenStore.has(userId);
  }

  private async getValidAccessToken(userId: string): Promise<string | null> {
    const stored = tokenStore.get(userId);
    if (!stored) return null;

    if (Date.now() < stored.expiresAt - 60_000) {
      return stored.accessToken;
    }

    // Refresh the token
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: stored.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      logger.warn({ userId }, 'Google token refresh failed — disconnecting user');
      tokenStore.delete(userId);
      return null;
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    stored.accessToken = data.access_token;
    stored.expiresAt = Date.now() + data.expires_in * 1000;
    return stored.accessToken;
  }

  async syncTasksToCalendar(userId: string, tasks: Task[], timezone = 'UTC'): Promise<void> {
    const accessToken = await this.getValidAccessToken(userId);
    if (!accessToken) {
      logger.warn({ userId }, 'No Google Calendar token — skipping sync');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    for (const task of tasks) {
      // Default to a 30-minute block starting at 9 AM if no scheduled time
      const startTime = task.scheduledFor ?? `${today}T09:00:00`;
      const start = new Date(startTime);
      const end = new Date(start.getTime() + 30 * 60_000);

      const event = {
        summary: task.title,
        description: task.description ?? '',
        start: { dateTime: start.toISOString(), timeZone: timezone },
        end: { dateTime: end.toISOString(), timeZone: timezone },
        extendedProperties: { private: { lyfestackTaskId: task.id } },
      };

      const res = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!res.ok) {
        logger.warn({ userId, taskId: task.id, status: res.status }, 'Failed to sync task to calendar');
      }
    }

    logger.info({ userId, count: tasks.length }, 'Tasks synced to Google Calendar');
  }

  async getUpcomingEvents(userId: string, windowHours = 2): Promise<CalendarEvent[]> {
    const accessToken = await this.getValidAccessToken(userId);
    if (!accessToken) return [];

    const now = new Date();
    const timeMax = new Date(now.getTime() + windowHours * 3600_000);

    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const res = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!res.ok) return [];

    const data = (await res.json()) as { items?: CalendarEvent[] };
    return data.items ?? [];
  }
}

export const calendarService = new CalendarService();
