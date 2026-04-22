import type { SupabaseClient } from '@supabase/supabase-js';
import type { DailyBrief } from '@lyfestack/shared';
import { BaseRepository } from './base.repository';

interface DailyBriefRow {
  id: string;
  user_id: string;
  date: string;
  greeting: string;
  summary: string;
  insights: string[];
  generated_at: string;
  created_at: string;
}

export interface CreateDailyBriefData {
  user_id: string;
  date: string;
  greeting?: string | undefined;
  summary?: string | undefined;
  insights?: string[] | undefined;
  generated_at?: string | undefined;
}

export class DailyBriefRepository extends BaseRepository<DailyBrief, CreateDailyBriefData> {
  constructor(client: SupabaseClient) {
    super(client, 'daily_briefs');
  }

  protected mapRow(row: Record<string, unknown>): DailyBrief {
    const r = row as unknown as DailyBriefRow;
    return {
      id: r.id,
      userId: r.user_id,
      date: r.date,
      greeting: r.greeting,
      summary: r.summary,
      tasks: [],
      insights: Array.isArray(r.insights) ? r.insights : [],
      generatedAt: r.generated_at,
    };
  }

  async findByUserAndDate(userId: string, date: string): Promise<DailyBrief | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data ? this.mapRow(data as Record<string, unknown>) : null;
  }

  async findRecentByUserId(userId: string, limit = 7): Promise<DailyBrief[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return ((data as Record<string, unknown>[]) ?? []).map((row) => this.mapRow(row));
  }

  async upsertForDate(userId: string, date: string, content: Omit<CreateDailyBriefData, 'user_id' | 'date'>): Promise<DailyBrief> {
    const existing = await this.findByUserAndDate(userId, date);
    if (existing) {
      const updated = await this.update(existing.id, content as Partial<CreateDailyBriefData>);
      return updated ?? existing;
    }
    return this.create({ user_id: userId, date, ...content });
  }
}
