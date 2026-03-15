import { apiRequest } from './client';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  organizationId: string;
  activeCompanyId: string | null;
  activeRole: 'ORG_ADMIN' | 'COMPANY_ADMIN' | 'USER' | null;
}

export async function getCurrentUser(): Promise<SessionUser> {
  return apiRequest('/auth/me');
}

export async function logout(): Promise<void> {
  await apiRequest('/auth/logout', { method: 'POST' });
}

export function getLoginUrl(): string {
  return '/api/auth/google';
}
