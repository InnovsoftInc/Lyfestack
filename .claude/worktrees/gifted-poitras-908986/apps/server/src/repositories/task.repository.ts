import type { SupabaseClient } from '@supabase/supabase-js';
import type { Task } from '@lyfestack/shared';
import { TaskStatus, TaskType, ApprovalState } from '@lyfestack/shared';
import { BaseRepository } from './base.repository';

interface TaskRow {
  id: string;
  goal_id: string;
  user_id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  approval_state: string;
  scheduled_for: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  confidence_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskData {
  goal_id: string;
  user_id: string;
  title: string;
  description?: string | null | undefined;
  type?: TaskType | undefined;
  status?: TaskStatus | undefined;
  approval_state?: ApprovalState | undefined;
  scheduled_for?: string | null | undefined;
  duration_minutes?: number | null | undefined;
  confidence_score?: number | null | undefined;
}

export class TaskRepository extends BaseRepository<Task, CreateTaskData> {
  constructor(client: SupabaseClient) {
    super(client, 'tasks');
  }

  protected mapRow(row: Record<string, unknown>): Task {
    const r = row as unknown as TaskRow;
    const task: Task = {
      id: r.id,
      goalId: r.goal_id,
      userId: r.user_id,
      title: r.title,
      type: r.type as TaskType,
      status: r.status as TaskStatus,
      approvalState: r.approval_state as ApprovalState,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
    if (r.description !== null)   task.description     = r.description;
    if (r.scheduled_for !== null) task.scheduledFor    = r.scheduled_for;
    if (r.completed_at !== null)  task.completedAt     = r.completed_at;
    if (r.duration_minutes !== null) task.durationMinutes = r.duration_minutes;
    return task;
  }

  async findByGoalId(goalId: string): Promise<Task[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return ((data as Record<string, unknown>[]) ?? []).map((row) => this.mapRow(row));
  }

  async findByUserId(userId: string): Promise<Task[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_for', { ascending: true });

    if (error) throw error;
    return ((data as Record<string, unknown>[]) ?? []).map((row) => this.mapRow(row));
  }

  async findPendingApproval(userId: string): Promise<Task[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('status', TaskStatus.PENDING_APPROVAL)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return ((data as Record<string, unknown>[]) ?? []).map((row) => this.mapRow(row));
  }

  async findScheduledForDate(userId: string, date: string): Promise<Task[]> {
    const start = `${date}T00:00:00.000Z`;
    const end   = `${date}T23:59:59.999Z`;

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_for', start)
      .lte('scheduled_for', end)
      .order('scheduled_for', { ascending: true });

    if (error) throw error;
    return ((data as Record<string, unknown>[]) ?? []).map((row) => this.mapRow(row));
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task | null> {
    return this.update(id, { status } as Partial<CreateTaskData>);
  }

  async approve(id: string): Promise<Task | null> {
    return this.update(id, {
      approval_state: ApprovalState.APPROVED,
      status: TaskStatus.APPROVED,
    } as Partial<CreateTaskData>);
  }

  async reject(id: string): Promise<Task | null> {
    return this.update(id, {
      approval_state: ApprovalState.REJECTED,
      status: TaskStatus.SKIPPED,
    } as Partial<CreateTaskData>);
  }
}
