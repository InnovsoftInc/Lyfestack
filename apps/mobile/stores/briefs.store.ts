import { create } from 'zustand';
import type { DailyBrief } from '@lyfestack/shared';
import { mockBrief, MOCK_STREAK, MOCK_COMPLETION_RATE } from '../utils/mockData';

interface BriefsState {
  brief: DailyBrief | null;
  streak: number;
  completionRate: number;
}

export const useBriefsStore = create<BriefsState>()(() => ({
  brief: mockBrief,
  streak: MOCK_STREAK,
  completionRate: MOCK_COMPLETION_RATE,
}));
