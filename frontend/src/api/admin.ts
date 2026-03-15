import { apiRequest } from './client';

// Organization
export async function getOrganization() {
  return apiRequest<any>('/admin/org');
}

export async function updateOrgBranding(branding: any) {
  return apiRequest('/admin/org/branding', { method: 'PUT', body: JSON.stringify(branding) });
}

// Companies
export async function getCompanies() {
  return apiRequest<any[]>('/admin/companies');
}

export async function createCompany(data: { name: string; slug: string }) {
  return apiRequest('/admin/companies', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCompany(id: string, data: any) {
  return apiRequest(`/admin/companies/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteCompany(id: string) {
  return apiRequest(`/admin/companies/${id}`, { method: 'DELETE' });
}

// Teams
export async function getTeams(companyId: string) {
  return apiRequest<any[]>(`/admin/companies/${companyId}/teams`);
}

export async function createTeam(companyId: string, data: { name: string; roundRobinMode?: string }) {
  return apiRequest(`/admin/companies/${companyId}/teams`, { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteTeam(id: string) {
  return apiRequest(`/admin/teams/${id}`, { method: 'DELETE' });
}

export async function updateRoundRobin(teamId: string, mode: string) {
  return apiRequest(`/admin/teams/${teamId}/round-robin`, { method: 'PUT', body: JSON.stringify({ mode }) });
}

export async function addTeamMember(teamId: string, userId: string, weight: number = 100) {
  return apiRequest(`/admin/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify({ userId, weight }) });
}

export async function removeTeamMember(teamId: string, userId: string) {
  return apiRequest(`/admin/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
}

// Users
export async function getCompanyUsers(companyId: string) {
  return apiRequest<any[]>(`/admin/companies/${companyId}/users`);
}

export async function inviteUser(companyId: string, data: { email: string; name: string; role: string }) {
  return apiRequest(`/admin/companies/${companyId}/users`, { method: 'POST', body: JSON.stringify(data) });
}

export async function removeUser(companyId: string, userId: string) {
  return apiRequest(`/admin/companies/${companyId}/users/${userId}`, { method: 'DELETE' });
}

// Event Types
export async function getEventTypes(companyId: string) {
  return apiRequest<any[]>(`/admin/companies/${companyId}/event-types`);
}

export async function createEventType(companyId: string, data: any) {
  return apiRequest(`/admin/companies/${companyId}/event-types`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateEventType(id: string, data: any) {
  return apiRequest(`/admin/event-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function toggleEventType(id: string) {
  return apiRequest(`/admin/event-types/${id}/toggle`, { method: 'PATCH' });
}

export async function deleteEventType(id: string) {
  return apiRequest(`/admin/event-types/${id}`, { method: 'DELETE' });
}

// User profile
export async function getMyProfile() {
  return apiRequest<any>('/me');
}

export async function updateMyAvailability(data: any) {
  return apiRequest('/me/availability', { method: 'PATCH', body: JSON.stringify(data) });
}

export async function updateMyTimezone(timezone: string) {
  return apiRequest('/me/timezone', { method: 'PATCH', body: JSON.stringify({ timezone }) });
}

// API Keys
export async function getMyApiKeys() {
  return apiRequest<any[]>('/me/api-keys');
}

export async function createApiKey(name: string) {
  return apiRequest('/me/api-keys', { method: 'POST', body: JSON.stringify({ name }) });
}

export async function deleteApiKey(id: string) {
  return apiRequest(`/me/api-keys/${id}`, { method: 'DELETE' });
}

// Team Detail
export async function getTeamDetail(teamId: string) {
  return apiRequest<any>(`/admin/teams/${teamId}`);
}

export interface TeamBookingsParams {
  page?: number;
  limit?: number;
  status?: 'upcoming' | 'all';
  userId?: string;
}

export interface TeamBookingsResponse {
  bookings: any[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getTeamBookings(teamId: string, params: TeamBookingsParams = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.status) qs.set('status', params.status);
  if (params.userId) qs.set('userId', params.userId);
  const query = qs.toString();
  return apiRequest<TeamBookingsResponse>(`/admin/teams/${teamId}/bookings${query ? `?${query}` : ''}`);
}
