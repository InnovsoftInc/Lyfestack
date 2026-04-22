import type { SupabaseClient } from '@supabase/supabase-js';
import type { GoalTemplate } from '@lyfestack/shared';
import { BaseRepository } from './base.repository';

interface GoalTemplateRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  duration_days: number;
  diagnostic_questions: unknown[];
  milestones: string[];
  allowed_actions: string[];
  leading_indicators: unknown[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalTemplateData {
  name: string;
  description?: string | null | undefined;
  category: string;
  duration_days?: number | undefined;
  diagnostic_questions?: unknown[] | undefined;
  milestones?: string[] | undefined;
  allowed_actions?: string[] | undefined;
  leading_indicators?: unknown[] | undefined;
  is_active?: boolean | undefined;
}

export class GoalTemplateRepository extends BaseRepository<GoalTemplate, CreateGoalTemplateData> {
  constructor(client: SupabaseClient) {
    super(client, 'goal_templates');
  }

  protected mapRow(row: Record<string, unknown>): GoalTemplate {
    const r = row as unknown as GoalTemplateRow;
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? '',
      category: r.category,
      icon: '',
      durationDays: r.duration_days,
      diagnosticQuestions: Array.isArray(r.diagnostic_questions) ? (r.diagnostic_questions as GoalTemplate['diagnosticQuestions']) : [],
      milestones: Array.isArray(r.milestones) ? r.milestones : [],
      defaultTaskTypes: Array.isArray(r.allowed_actions) ? r.allowed_actions : [],
      allowedActions: Array.isArray(r.allowed_actions) ? r.allowed_actions : [],
      automationRules: [],
      leadingIndicators: Array.isArray(r.leading_indicators) ? (r.leading_indicators as GoalTemplate['leadingIndicators']) : [],
    };
  }

  async findByCategory(category: string): Promise<GoalTemplate[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return ((data as Record<string, unknown>[]) ?? []).map((row) => this.mapRow(row));
  }

  async findAllActive(): Promise<GoalTemplate[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true });

    if (error) throw error;
    return ((data as Record<string, unknown>[]) ?? []).map((row) => this.mapRow(row));
  }

  async deactivate(id: string): Promise<GoalTemplate | null> {
    return this.update(id, { is_active: false } as Partial<CreateGoalTemplateData>);
  }
}
