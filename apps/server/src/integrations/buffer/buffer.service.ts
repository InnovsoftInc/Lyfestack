import { config } from '../../config/config';
import { logger } from '../../utils/logger';

const BUFFER_AUTH_URL = 'https://bufferapp.com/oauth2/authorize';
const BUFFER_TOKEN_URL = 'https://api.bufferapp.com/1/oauth2/token.json';
const BUFFER_API_BASE = 'https://api.bufferapp.com/1';

export interface BufferProfile {
  id: string;
  service: string;
  formatted_username: string;
}

interface StoredBufferTokens {
  userId: string;
  accessToken: string;
}

// In-memory token store — replace with DB-backed store for production
const tokenStore = new Map<string, StoredBufferTokens>();

export class BufferService {
  private get clientId(): string {
    return config.BUFFER_CLIENT_ID ?? '';
  }

  private get clientSecret(): string {
    return config.BUFFER_CLIENT_SECRET ?? '';
  }

  private get redirectUri(): string {
    return `${config.APP_BASE_URL}/integrations/buffer/callback`;
  }

  getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state: userId,
    });
    return `${BUFFER_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, userId: string): Promise<void> {
    const res = await fetch(BUFFER_TOKEN_URL, {
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
      throw new Error(`Buffer token exchange failed: ${text}`);
    }

    const data = (await res.json()) as { access_token: string };

    tokenStore.set(userId, { userId, accessToken: data.access_token });
    logger.info({ userId }, 'Buffer connected');
  }

  async disconnect(userId: string): Promise<void> {
    tokenStore.delete(userId);
  }

  isConnected(userId: string): boolean {
    return tokenStore.has(userId);
  }

  async getProfiles(userId: string): Promise<BufferProfile[]> {
    const stored = tokenStore.get(userId);
    if (!stored) return [];

    const res = await fetch(
      `${BUFFER_API_BASE}/profiles.json?access_token=${stored.accessToken}`,
    );
    if (!res.ok) return [];

    return (await res.json()) as BufferProfile[];
  }

  async schedulePost(
    userId: string,
    content: string,
    scheduledAt: Date,
    profileId?: string,
  ): Promise<{ success: boolean; bufferId?: string }> {
    const stored = tokenStore.get(userId);
    if (!stored) {
      logger.warn({ userId }, 'No Buffer token — cannot schedule post');
      return { success: false };
    }

    // If no profile specified, use the first available one
    let targetProfileId = profileId;
    if (!targetProfileId) {
      const profiles = await this.getProfiles(userId);
      if (profiles.length === 0) {
        logger.warn({ userId }, 'No Buffer profiles found');
        return { success: false };
      }
      targetProfileId = profiles[0].id;
    }

    const body = new URLSearchParams();
    body.set('text', content);
    body.append('profile_ids[]', targetProfileId);
    body.set('access_token', stored.accessToken);
    body.set('scheduled_at', scheduledAt.toISOString());

    const res = await fetch(`${BUFFER_API_BASE}/updates/create.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      logger.warn({ userId, status: res.status }, 'Buffer schedule failed');
      return { success: false };
    }

    const data = (await res.json()) as { update?: { id: string } };
    logger.info({ userId, bufferId: data.update?.id }, 'Post scheduled via Buffer');
    return { success: true, bufferId: data.update?.id };
  }
}

export const bufferService = new BufferService();
