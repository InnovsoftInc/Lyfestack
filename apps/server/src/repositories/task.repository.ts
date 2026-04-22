import type { Task } from '@lyfestack/shared';
import { TaskStatus } from '@lyfestack/shared';
import { BaseRepository } from './base.repository';

export class TaskRepository extends BaseRepository<Task> {
  protected table = 'tasks';

  async findByUserId(userId: string): Promise<Task[]> {
    const { data, error } = await this.db.from(this.table).select('*').eq('user_id', userId);
    if (error) throw error;
    return (data ?? []) as Task[];
  }

  async findPendingByUserId(userId: string): Promise<Task[]> {
    const { data, error } = await this.db
      .from(this.table)
      .select('*')
      .eq('user_id', userId)
      .in('status', [TaskStatus.PENDING, TaskStatus.APPROVED]);
    if (error) throw error;
    return (data ?? []) as Task[];
  }

  async findByGoalId(goalId: string): Promise<Task[]> {
    const { data, error } = await this.db.from(this.table).select('*').eq('goal_id', goalId);
    if (error) throw error;
    return (data ?? []) as Task[];
  }
}

export const taskRepository = new TaskRepository();
