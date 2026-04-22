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
  scheduledFor?: string;
  completedAt?: string;
  durationMinutes?: number;
  createdAt: string;
  updatedAt: string;
}
