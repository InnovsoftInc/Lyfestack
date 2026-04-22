import { create } from 'zustand';
import type { User } from '@lyfestack/shared';
import { authApi, setAuthToken, getAuthToken } from '../services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  authToken: string | null;
  isLoading: boolean;
  error: string | null;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  setUser: (user: User | null, token?: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  authToken: null,
  isLoading: false,
  error: null,

  signup: async (email, password, name) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authApi.signup(email, password, name);
      await setAuthToken(result.token);
      set({ user: result.user, isAuthenticated: true, authToken: result.token, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Sign up failed' });
      throw err;
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authApi.login(email, password);
      await setAuthToken(result.token);
      set({ user: result.user, isAuthenticated: true, authToken: result.token, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Login failed' });
      throw err;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort server-side logout
    }
    await setAuthToken(null);
    set({ user: null, isAuthenticated: false, authToken: null });
  },

  restoreSession: async () => {
    const token = await getAuthToken();
    if (!token) return;
    try {
      const user = await authApi.me();
      set({ user, isAuthenticated: true, authToken: token });
    } catch {
      await setAuthToken(null);
      set({ user: null, isAuthenticated: false, authToken: null });
    }
  },

  setUser: (user, token) =>
    set({ user, isAuthenticated: !!user, authToken: token ?? null }),
}));
