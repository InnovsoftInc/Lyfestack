import type { GoalStatus } from '../enums/goal.enums';

export interface Plan {
  id: string;
  userId: string;
  title: string;
  description?: string;
  goalIds: string[];
  status: GoalStatus;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}
