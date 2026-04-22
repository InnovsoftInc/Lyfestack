import type { Task } from './task';

export interface DailyBrief {
  id: string;
  userId: string;
  date: string;
  greeting: string;
  summary: string;
  tasks: Task[];
  insights: string[];
  generatedAt: string;
}
