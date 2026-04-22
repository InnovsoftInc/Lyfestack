import { create } from 'zustand';
import type { User } from '@lyfestack/shared';
import { mockUser } from '../utils/mockData';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  authToken: string | null;
  setUser: (user: User | null, token?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: mockUser,
  isAuthenticated: true,
  authToken: null,
  setUser: (user, token) =>
    set({ user, isAuthenticated: !!user, authToken: token ?? null }),
  logout: () => set({ user: null, isAuthenticated: false, authToken: null }),
}));
