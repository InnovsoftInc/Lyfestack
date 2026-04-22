import { request } from './api';

export interface DiagnosticAnswer {
  questionId: string;
  value: string | number | boolean;
}

export interface CreateGoalPayload {
  title: string;
  description: string;
  templateId?: string;
  diagnosticAnswers?: DiagnosticAnswer[];
  targetDate?: string;
}

export interface GoalMilestone {
  id: string;
  goalId: string;
  title: string;
  dueDate?: string;
  completedAt?: string;
}

export interface Goal {
  id: string;
  userId: string;
  templateId?: string;
  title: string;
  description: string;
  status: string;
  targetDate?: string;
  progressScore: number;
  diagnosticAnswers?: Record<string, unknown>;
  milestones: GoalMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  id: string;
  userId: string;
  title: string;
  description: string;
  goalIds: string[];
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export async function createGoal(payload: CreateGoalPayload): Promise<Goal> {
  const res = await request<{ goal: Goal }>('/api/goals', {
    method: 'POST',
    body: payload,
  });
  return res.goal;
}

export async function getGoals(): Promise<Goal[]> {
  const res = await request<{ goals: Goal[] }>('/api/goals');
  return res.goals;
}

export async function getGoal(id: string): Promise<Goal> {
  const res = await request<{ goal: Goal }>(`/api/goals/${id}`);
  return res.goal;
}

export async function updateGoal(id: string, patch: Partial<Pick<Goal, 'title' | 'description' | 'status' | 'targetDate'>>): Promise<Goal> {
  const res = await request<{ goal: Goal }>(`/api/goals/${id}`, {
    method: 'PATCH',
    body: patch,
  });
  return res.goal;
}

export async function generatePlan(
  goalId: string,
  templateId: string,
  answers: DiagnosticAnswer[],
  userId: string,
): Promise<Plan> {
  const res = await request<{ plan: Plan }>(`/api/goals/${goalId}/plan`, {
    method: 'POST',
    body: { templateId, answers, userId },
  });
  return res.plan;
}
