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

export async function getCompanyDetail(id: string) {
  return apiRequest(`/admin/companies/${id}`);
}

export async function getCompanyBookings(companyId: string) {
  return apiRequest(`/admin/companies/${companyId}/bookings`);
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

// User Detail (Admin)
export async function getUserDetail(userId: string) {
  return apiRequest<any>(`/admin/users/${userId}`);
}

export async function updateUserStatus(userId: string, status: 'AVAILABLE' | 'ABSENT', absentUntil?: string) {
  return apiRequest(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, absentUntil }),
  });
}

export async function getUserBookings(userId: string) {
  return apiRequest<any[]>(`/admin/users/${userId}/bookings`);
}

export async function deleteUser(userId: string) {
  return apiRequest(`/admin/users/${userId}`, { method: 'DELETE' });
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

// Holidays
export async function getHolidays(country: string = 'de', year?: number): Promise<Array<{ name: string; date: string; countryCode: string }>> {
  const params = new URLSearchParams({ country });
  if (year) params.set('year', String(year));
  return apiRequest(`/holidays?${params}`);
}

// Self-service status
export async function updateMyStatus(status: 'AVAILABLE' | 'ABSENT', absentUntil?: string | null) {
  return apiRequest('/me/status', {
    method: 'PATCH',
    body: JSON.stringify({ status, absentUntil }),
  });
}

// Vacations
export async function getMyVacations(): Promise<Array<{ id: string; startDate: string; endDate: string; label: string | null }>> {
  return apiRequest('/me/vacations');
}

export async function createVacation(data: { startDate: string; endDate: string; label?: string | null }) {
  return apiRequest('/me/vacations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteVacation(id: string) {
  return apiRequest(`/me/vacations/${id}`, { method: 'DELETE' });
}

export async function updateMyLanguage(language: string): Promise<void> {
  await apiRequest('/me/language', {
    method: 'PATCH',
    body: JSON.stringify({ language }),
  });
}

// Branding
export async function updateCompanyBranding(companyId: string, data: Record<string, unknown>) {
  return apiRequest(`/admin/companies/${companyId}/branding`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function uploadCompanyLogo(companyId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`/api/admin/companies/${companyId}/branding/logo`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || 'Upload failed');
  }
  return response.json();
}

export async function deleteCompanyLogo(companyId: string) {
  return apiRequest(`/admin/companies/${companyId}/branding/logo`, { method: 'DELETE' });
}

// Team management
export async function updateTeamName(teamId: string, name: string) {
  return apiRequest(`/admin/teams/${teamId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function updateTeamMemberRole(teamId: string, userId: string, role: 'MEMBER' | 'OWNER') {
  return apiRequest(`/admin/teams/${teamId}/members/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

// Routing Forms
export async function getRoutingForms() {
  return apiRequest<any[]>('/admin/routing-forms');
}

export async function createRoutingForm(data: any) {
  return apiRequest('/admin/routing-forms', { method: 'POST', body: JSON.stringify(data) });
}

export async function getRoutingForm(id: string) {
  return apiRequest(`/admin/routing-forms/${id}`);
}

export async function updateRoutingForm(id: string, data: any) {
  return apiRequest(`/admin/routing-forms/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteRoutingForm(id: string) {
  return apiRequest(`/admin/routing-forms/${id}`, { method: 'DELETE' });
}
