import type { TaskStatus, TaskType, ApprovalState } from '../enums/task.enums';

export interface Task {
  id: string;
  goalId: string;
  userId: string;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  approvalState: ApprovalState;
  priority?: number;
  dueDate?: string;
  scheduledFor?: string;
  estimatedMinutes?: number;
  confidenceScore?: number;
  completedAt?: string;
  durationMinutes?: number;
  agentGenerated?: boolean;
  rollbackPlan?: string;
  createdAt: string;
  updatedAt: string;
}
