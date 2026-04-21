import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@lyfestack/shared';
import { TrustTier } from '@lyfestack/shared';
import { BaseRepository } from './base.repository';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  timezone: string;
  trust_tier: string;
  engagement_velocity: number;
  adaptive_task_cap: number;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  timezone?: string;
  trust_tier?: string;
}

export interface UpdateUserData {
  name?: string | null;
  avatar_url?: string | null;
  timezone?: string;
  trust_tier?: TrustTier;
  engagement_velocity?: number;
  adaptive_task_cap?: number;
}

export class UserRepository extends BaseRepository<User, CreateUserData> {
  constructor(client: SupabaseClient) {
    super(client, 'users');
  }

  protected mapRow(row: Record<string, unknown>): User {
    const r = row as unknown as UserRow;
    const user: User = {
      id: r.id,
      email: r.email,
      displayName: r.name ?? '',
      timezone: r.timezone,
      trustTier: r.trust_tier as TrustTier,
      onboardingCompleted: false,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
    if (r.avatar_url !== null) user.avatarUrl = r.avatar_url;
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data ? this.mapRow(data as Record<string, unknown>) : null;
  }

  async updateProfile(id: string, data: UpdateUserData): Promise<User | null> {
    const dbData: Record<string, unknown> = {};
    if (data.name !== undefined)                dbData['name']                = data.name;
    if (data.avatar_url !== undefined)           dbData['avatar_url']          = data.avatar_url;
    if (data.timezone !== undefined)             dbData['timezone']            = data.timezone;
    if (data.trust_tier !== undefined)           dbData['trust_tier']          = data.trust_tier;
    if (data.engagement_velocity !== undefined)  dbData['engagement_velocity'] = data.engagement_velocity;
    if (data.adaptive_task_cap !== undefined)    dbData['adaptive_task_cap']   = data.adaptive_task_cap;

    return this.update(id, dbData as Partial<CreateUserData>);
  }

  async updateTrustTier(id: string, tier: TrustTier): Promise<User | null> {
    return this.update(id, { trust_tier: tier } as Partial<CreateUserData>);
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .in('id', ids);

    if (error) throw error;
    return ((data as Record<string, unknown>[]) ?? []).map((row) => this.mapRow(row));
  }
}
