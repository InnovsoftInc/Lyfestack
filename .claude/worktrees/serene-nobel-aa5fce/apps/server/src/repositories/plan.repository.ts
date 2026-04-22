import type { SupabaseClient } from '@supabase/supabase-js';
import type { Plan } from '@lyfestack/shared';
import { GoalStatus } from '@lyfestack/shared';
import { BaseRepository } from './base.repository';

interface PlanRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePlanData {
  user_id: string;
  title: string;
  description?: string | null | undefined;
  status?: GoalStatus | undefined;
  start_date: string;
  end_date?: string | null | undefined;
}

export class PlanRepository extends BaseRepository<Plan, CreatePlanData> {
  constructor(client: SupabaseClient) {
    super(client, 'plans');
  }

  protected mapRow(row: Record<string, unknown>): Plan {
    const r = row as unknown as PlanRow;
    const plan: Plan = {
      id: r.id,
      userId: r.user_id,
      title: r.title,
      status: r.status as GoalStatus,
      goalIds: [],
      startDate: r.start_date,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
    if (r.description !== null) plan.description = r.description;
    if (r.end_date !== null)    plan.endDate      = r.end_date;
    return plan;
  }

  async findByUserId(userId: string): Promise<Plan[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ((data as Record<string, unknown>[]) ?? []).map((row) => this.mapRow(row));
  }

  async findWithGoalIds(planId: string): Promise<Plan | null> {
    const plan = await this.findById(planId);
    if (!plan) return null;

    const { data, error } = await this.client
      .from('plan_goals')
      .select('goal_id')
      .eq('plan_id', planId);

    if (error) throw error;
    plan.goalIds = ((data as { goal_id: string }[]) ?? []).map((r) => r.goal_id);
    return plan;
  }

  async addGoal(planId: string, goalId: string): Promise<void> {
    const { error } = await this.client
      .from('plan_goals')
      .insert({ plan_id: planId, goal_id: goalId });
    if (error) throw error;
  }

  async removeGoal(planId: string, goalId: string): Promise<void> {
    const { error } = await this.client
      .from('plan_goals')
      .delete()
      .eq('plan_id', planId)
      .eq('goal_id', goalId);
    if (error) throw error;
  }

  async updateStatus(id: string, status: GoalStatus): Promise<Plan | null> {
    return this.update(id, { status } as Partial<CreatePlanData>);
  }
}
