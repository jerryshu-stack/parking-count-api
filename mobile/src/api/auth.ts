import { api } from './client';
import type { AuthSession } from './types';

export function register(username: string, password: string): Promise<AuthSession> {
  return api.post<AuthSession>('/auth/register', { username, password });
}

export function login(username: string, password: string): Promise<AuthSession> {
  return api.post<AuthSession>('/auth/login', { username, password });
}

export function logout(): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>('/auth/logout');
}
