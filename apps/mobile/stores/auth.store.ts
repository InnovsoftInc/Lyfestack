import { create } from 'zustand';
import type { User } from '@lyfestack/shared';
import { authApi, setAuthToken, getAuthToken, setRefreshToken, getRefreshToken, registerUnauthorizedHandler } from '../services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  authToken: string | null;
  isLoading: boolean;
  isRestoring: boolean;
  error: string | null;
  confirmationPending: boolean;
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
  isRestoring: true,
  error: null,
  confirmationPending: false,

  signup: async (email, password, name) => {
    set({ isLoading: true, error: null, confirmationPending: false });
    try {
      const result = await authApi.signup(email, password, name);
      if ('confirmationRequired' in result) {
        set({ isLoading: false, confirmationPending: true });
        return;
      }
      await setAuthToken(result.accessToken);
      await setRefreshToken(result.refreshToken);
      set({ user: result.user, isAuthenticated: true, authToken: result.accessToken, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Sign up failed' });
      throw err;
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authApi.login(email, password);
      await setAuthToken(result.accessToken);
      await setRefreshToken(result.refreshToken);
      set({ user: result.user, isAuthenticated: true, authToken: result.accessToken, isLoading: false });
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
    await setRefreshToken(null);
    set({ user: null, isAuthenticated: false, authToken: null });
  },

  restoreSession: async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        set({ isRestoring: false });
        return;
      }
      const user = await authApi.me();
      set({ user, isAuthenticated: true, authToken: token, isRestoring: false });
    } catch {
      await setAuthToken(null);
      await setRefreshToken(null);
      set({ user: null, isAuthenticated: false, authToken: null, isRestoring: false });
    }
  },

  setUser: (user, token) =>
    set({ user, isAuthenticated: !!user, authToken: token ?? null }),
}));

registerUnauthorizedHandler(async () => {
  await setAuthToken(null);
  await setRefreshToken(null);
  useAuthStore.setState({ user: null, isAuthenticated: false, authToken: null });
});
