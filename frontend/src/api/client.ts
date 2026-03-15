const BASE_URL = '/api';

/** Generic fetch wrapper with error handling. */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Only set Content-Type for requests with a body
  const headers: Record<string, string> = { ...options.headers as Record<string, string> };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers,
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(response.status, error.error || error.message || 'Request failed');
  }

  return response.json();
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
