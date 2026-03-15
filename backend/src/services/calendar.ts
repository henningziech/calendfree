// backend/src/services/calendar.ts
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../db.js';
import { decrypt, encrypt } from '../utils/encryption.js';
import { config } from '../config.js';

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Get a valid access token for a user. Handles refresh automatically.
 */
async function getAccessToken(userId: string): Promise<string> {
  const tokens = await prisma.googleTokens.findUnique({ where: { userId } });
  if (!tokens || !tokens.connected) {
    throw new Error(`User ${userId} has no connected Google account`);
  }

  const accessToken = decrypt(tokens.accessToken);
  const refreshToken = decrypt(tokens.refreshToken);

  // If token is still valid (with 5 min buffer), use it
  if (tokens.expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return accessToken;
  }

  // Token expired — refresh it
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json() as any;
  if (!data.access_token) {
    // Token revoked or invalid — mark as disconnected
    await prisma.googleTokens.update({
      where: { userId },
      data: { connected: false },
    });
    throw new Error(`Token refresh failed for user ${userId}: ${data.error_description ?? data.error}`);
  }

  // Persist new tokens
  await prisma.googleTokens.update({
    where: { userId },
    data: {
      accessToken: encrypt(data.access_token),
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      ...(data.refresh_token ? { refreshToken: encrypt(data.refresh_token) } : {}),
    },
  });

  return data.access_token;
}

/** Helper: make an authenticated request to Google Calendar API. */
async function calendarFetch(userId: string, path: string, options: RequestInit = {}): Promise<any> {
  const token = await getAccessToken(userId);
  const res = await fetch(`${CALENDAR_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(`Calendar API ${res.status}: ${err.error?.message ?? res.statusText}`);
  }

  return res.json();
}

/**
 * Create an authenticated OAuth2 client for a specific user.
 * (Kept for backward compatibility with google-auth-library consumers)
 */
export async function getAuthenticatedClient(userId: string): Promise<OAuth2Client> {
  const token = await getAccessToken(userId);
  const client = new OAuth2Client({
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    redirectUri: config.GOOGLE_REDIRECT_URI,
  });
  client.setCredentials({ access_token: token });
  return client;
}

/**
 * Get busy times from a user's Google Calendar.
 * Uses events.list API directly via fetch (avoids googleapis library auth issues).
 */
export async function getFreeBusy(
  userId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<Array<{ start: Date; end: Date }>> {
  const busySlots: Array<{ start: Date; end: Date }> = [];
  let pageToken = '';

  do {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      fields: 'items(start,end,status,transparency),nextPageToken',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const data = await calendarFetch(userId, `/calendars/primary/events?${params}`);

    for (const event of data.items ?? []) {
      if (event.status === 'cancelled') continue;
      if (event.transparency === 'transparent') continue;

      const start = event.start?.dateTime ?? event.start?.date;
      const end = event.end?.dateTime ?? event.end?.date;
      if (start && end) {
        busySlots.push({ start: new Date(start), end: new Date(end) });
      }
    }

    pageToken = data.nextPageToken ?? '';
  } while (pageToken);

  return busySlots;
}

/**
 * Create a Google Calendar event for a booking.
 * Optionally generates a Google Meet link.
 */
export async function createCalendarEvent(params: {
  userId: string;
  summary: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendeeEmail: string;
  attendeeName: string;
  autoMeetLink: boolean;
}): Promise<{ eventId: string; meetLink: string | null }> {
  const eventBody: Record<string, any> = {
    summary: params.summary,
    description: params.description,
    start: { dateTime: params.startTime.toISOString() },
    end: { dateTime: params.endTime.toISOString() },
    attendees: [
      { email: params.attendeeEmail, displayName: params.attendeeName },
    ],
  };

  if (params.autoMeetLink) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: `calendfree-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const qs = new URLSearchParams({
    conferenceDataVersion: params.autoMeetLink ? '1' : '0',
    sendUpdates: 'all',
  });

  const data = await calendarFetch(params.userId, `/calendars/primary/events?${qs}`, {
    method: 'POST',
    body: JSON.stringify(eventBody),
  });

  const meetLink = data.conferenceData?.entryPoints?.find(
    (ep: any) => ep.entryPointType === 'video',
  )?.uri ?? null;

  return {
    eventId: data.id,
    meetLink,
  };
}

/**
 * Delete a Google Calendar event.
 */
export async function deleteCalendarEvent(
  userId: string,
  eventId: string,
): Promise<void> {
  const token = await getAccessToken(userId);
  const res = await fetch(
    `${CALENDAR_BASE}/calendars/primary/events/${eventId}?sendUpdates=all`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete calendar event: ${res.status}`);
  }
}
