import { request } from './api';

export interface BriefTask {
  id: string;
  goalId: string;
  userId: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  approvalState: string;
  priority?: number;
  dueDate?: string;
  estimatedMinutes?: number;
  confidenceScore?: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyBrief {
  id: string;
  userId: string;
  date: string;
  greeting: string;
  summary: string;
  tasks: BriefTask[];
  insights: string[];
  generatedAt: string;
}

export interface TaskStatusUpdate {
  status: 'completed' | 'deferred' | 'approved' | 'rejected';
}

export async function getTodayBrief(): Promise<DailyBrief> {
  const res = await request<{ brief: DailyBrief }>('/api/briefs/today');
  return res.brief;
}

export async function updateTaskStatus(taskId: string, update: TaskStatusUpdate): Promise<BriefTask> {
  const res = await request<{ task: BriefTask }>(`/api/briefs/tasks/${taskId}`, {
    method: 'PATCH',
    body: update,
  });
  return res.task;
}

export async function markTaskComplete(briefId: string, taskId: string): Promise<DailyBrief> {
  const res = await request<{ brief: DailyBrief }>(`/briefs/${briefId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: { status: 'completed' },
  });
  return res.brief;
}

export async function approveTask(taskId: string): Promise<BriefTask> {
  return updateTaskStatus(taskId, { status: 'approved' });
}
