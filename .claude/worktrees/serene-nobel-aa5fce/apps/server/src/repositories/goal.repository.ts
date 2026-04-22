import type { SupabaseClient } from '@supabase/supabase-js';
import type { Goal, GoalMilestone } from '@lyfestack/shared';
import { GoalStatus } from '@lyfestack/shared';
import { BaseRepository } from './base.repository';

interface GoalRow {
  id: string;
  user_id: string;
  template_id: string | null;
  title: string;
  description: string | null;
  status: string;
  target_date: string | null;
  progress_score: number;
  created_at: string;
  updated_at: string;
}

interface MilestoneRow {
  id: string;
  goal_id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalData {
  user_id: string;
  template_id?: string | null | undefined;
  title: string;
  description?: string | null | undefined;
  status?: GoalStatus | undefined;
  target_date?: string | null | undefined;
}

export class GoalRepository extends BaseRepository<Goal, CreateGoalData> {
  constructor(client: SupabaseClient) {
    super(client, 'goals');
  }

  protected mapRow(row: Record<string, unknown>): Goal {
    const r = row as unknown as GoalRow;
    const goal: Goal = {
      id: r.id,
      userId: r.user_id,
      title: r.title,
      description: r.description ?? '',
      status: r.status as GoalStatus,
      progressScore: r.progress_score,
      milestones: [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
    if (r.template_id !== null) goal.templateId = r.template_id;
    if (r.target_date !== null) goal.targetDate = r.target_date;
    return goal;
  }

  private mapMilestoneRow(row: Record<string, unknown>): GoalMilestone {
    const r = row as unknown as MilestoneRow;
    const m: GoalMilestone = {
      id: r.id,
      goalId: r.goal_id,
      title: r.title,
    };
    if (r.due_date !== null) m.dueDate = r.due_date;
    if (r.completed_at !== null) m.completedAt = r.completed_at;
    return m;
  }

  async findByUserId(userId: string): Promise<Goal[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ((data as Record<string, unknown>[]) ?? []).map((row) => this.mapRow(row));
  }

  async findByUserIdAndStatus(userId: string, status: GoalStatus): Promise<Goal[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ((data as Record<string, unknown>[]) ?? []).map((row) => this.mapRow(row));
  }

  async findWithMilestones(goalId: string): Promise<Goal | null> {
    const goal = await this.findById(goalId);
    if (!goal) return null;

    const { data, error } = await this.client
      .from('milestones')
      .select('*')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    goal.milestones = ((data as Record<string, unknown>[]) ?? []).map((row) =>
      this.mapMilestoneRow(row),
    );
    return goal;
  }

  async updateStatus(id: string, status: GoalStatus): Promise<Goal | null> {
    return this.update(id, { status } as Partial<CreateGoalData>);
  }

  async updateProgress(id: string, score: number): Promise<Goal | null> {
    return this.update(id, { progress_score: score } as unknown as Partial<CreateGoalData>);
  }
}
