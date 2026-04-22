import type { TrustTier } from '@lyfestack/shared';
import type { TaskType } from '@lyfestack/shared';

export interface UserContext {
  userId: string;
  trustTier: TrustTier;
  engagementVelocity: number;
  currentTaskLoad: number;
}

export interface TaskDraft {
  title: string;
  description: string;
  type: TaskType;
  durationMinutes: number;
  dayOffset: number;
  milestoneIndex?: number;
}

export interface MilestoneDraft {
  title: string;
  dueDayOffset: number;
}

export interface PlanDraft {
  title: string;
  description: string;
  estimatedDurationDays: number;
  milestones: MilestoneDraft[];
  tasks: TaskDraft[];
}
