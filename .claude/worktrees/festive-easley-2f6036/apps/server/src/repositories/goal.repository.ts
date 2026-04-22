import type { Goal } from '@lyfestack/shared';
import { GoalStatus } from '@lyfestack/shared';
import { BaseRepository } from './base.repository';

export class GoalRepository extends BaseRepository<Goal> {
  protected table = 'goals';

  async findByUserId(userId: string): Promise<Goal[]> {
    const { data, error } = await this.db.from(this.table).select('*').eq('user_id', userId);
    if (error) throw error;
    return (data ?? []) as Goal[];
  }

  async findActiveByUserId(userId: string): Promise<Goal[]> {
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('user_id', userId)
      .eq('status', GoalStatus.ACTIVE);
    if (error) throw error;
    return (data ?? []) as Goal[];
  }
}

export const goalRepository = new GoalRepository();
