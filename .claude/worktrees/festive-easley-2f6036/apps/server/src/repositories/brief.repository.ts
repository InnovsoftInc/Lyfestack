import type { DailyBrief } from '@lyfestack/shared';
import { BaseRepository } from './base.repository';

export class BriefRepository extends BaseRepository<DailyBrief> {
  protected table = 'daily_briefs';

  async findByUserAndDate(userId: string, date: string): Promise<DailyBrief | null> {
    const { data } = await this.db
      .from(this.table)
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();
    return data as DailyBrief | null;
  }

  async findTodayForUser(userId: string): Promise<DailyBrief | null> {
    const today = new Date().toISOString().split('T')[0]!;
    return this.findByUserAndDate(userId, today);
  }
}

export const briefRepository = new BriefRepository();
