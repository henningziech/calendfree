// backend/src/services/calendar.ts
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../db.js';
import { decrypt, encrypt } from '../utils/encryption.js';
import { config } from '../config.js';

/**
 * Create an authenticated OAuth2 client for a specific user.
 * Decrypts stored tokens and handles token refresh automatically.
 */
export async function getAuthenticatedClient(userId: string): Promise<OAuth2Client> {
  const tokens = await prisma.googleTokens.findUnique({ where: { userId } });
  if (!tokens || !tokens.connected) {
    throw new Error(`User ${userId} has no connected Google account`);
  }

  const client = new OAuth2Client({
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    redirectUri: config.GOOGLE_REDIRECT_URI,
  });

  client.setCredentials({
    access_token: decrypt(tokens.accessToken),
    refresh_token: decrypt(tokens.refreshToken),
    expiry_date: tokens.expiresAt.getTime(),
  });

  // Listen for token refresh events to persist new tokens
  client.on('tokens', async (newTokens) => {
    const updateData: Record<string, unknown> = {};
    if (newTokens.access_token) {
      updateData.accessToken = encrypt(newTokens.access_token);
    }
    if (newTokens.refresh_token) {
      updateData.refreshToken = encrypt(newTokens.refresh_token);
    }
    if (newTokens.expiry_date) {
      updateData.expiresAt = new Date(newTokens.expiry_date);
    }
    await prisma.googleTokens.update({
      where: { userId },
      data: updateData,
    });
  });

  return client;
}

/**
 * Query Google Calendar FreeBusy API for a user's busy times.
 * Returns an array of { start, end } intervals in UTC.
 */
export async function getFreeBusy(
  userId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<Array<{ start: Date; end: Date }>> {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: 'primary' }],
    },
  });

  const busySlots = response.data.calendars?.primary?.busy ?? [];
  return busySlots.map((slot) => ({
    start: new Date(slot.start!),
    end: new Date(slot.end!),
  }));
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
  const auth = await getAuthenticatedClient(params.userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const eventBody: calendar_v3.Schema$Event = {
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

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: eventBody,
    conferenceDataVersion: params.autoMeetLink ? 1 : 0,
    sendUpdates: 'all',
  });

  const meetLink = response.data.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === 'video',
  )?.uri ?? null;

  return {
    eventId: response.data.id!,
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
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
    sendUpdates: 'all',
  });
}
