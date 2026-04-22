import { create } from 'zustand';
import { setAuthToken } from '../services/api';
import * as authApi from '../services/auth.api';
import type { AuthUser } from '../services/auth.api';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadMe: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authApi.login({ email, password });
      setAuthToken(result.token);
      set({ user: result.user, token: result.token, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({ error: message, isLoading: false });
    }
  },

  signup: async (email, password, name) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authApi.signup({ email, password, name });
      setAuthToken(result.token);
      set({ user: result.user, token: result.token, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      set({ error: message, isLoading: false });
    }
  },

  logout: async () => {
    const { token } = get();
    if (token) {
      try {
        await authApi.logout();
      } catch {
        // ignore errors on logout
      }
    }
    setAuthToken(null);
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadMe: async () => {
    const { token } = get();
    if (!token) return;
    set({ isLoading: true });
    try {
      const user = await authApi.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      setAuthToken(null);
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
