import type { TrustTier } from '../enums/trust.enums';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  timezone: string;
  trustTier: TrustTier;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrustLevel {
  tier: TrustTier;
  score: number;
  autoApproveThreshold: number;
  updatedAt: string;
}
