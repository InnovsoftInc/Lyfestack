import { request } from './api';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export interface SignupPayload {
  email: string;
  password: string;
  name?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function signup(payload: SignupPayload): Promise<AuthResult> {
  const res = await request<{ data: { token: string; user: AuthUser } }>('/auth/signup', {
    method: 'POST',
    body: payload,
    skipAuth: true,
  });
  return res.data;
}

export async function login(payload: LoginPayload): Promise<AuthResult> {
  const res = await request<{ data: { token: string; user: AuthUser } }>('/auth/login', {
    method: 'POST',
    body: payload,
    skipAuth: true,
  });
  return res.data;
}

export async function logout(): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' });
}

export async function getMe(): Promise<AuthUser> {
  const res = await request<{ data: AuthUser }>('/auth/me');
  return res.data;
}
