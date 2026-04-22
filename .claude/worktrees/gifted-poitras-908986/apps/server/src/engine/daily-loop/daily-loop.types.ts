import type { Task } from '@lyfestack/shared';

export interface BriefUser {
  userId: string;
  engagementVelocity: number;
  timezone: string;
}

export interface StoredBrief {
  id: string;
  userId: string;
  date: string;          // YYYY-MM-DD
  greeting: string;
  summary: string;
  tasks: Task[];
  insights: string[];
  generatedAt: string;
  completedTaskIds: Set<string>;
}
