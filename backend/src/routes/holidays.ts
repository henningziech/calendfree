// backend/src/routes/holidays.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { getAccessToken } from '../services/calendar.js';
import { redis } from '../redis.js';
import { requireAuth } from '../middleware/auth.js';

const ErrorResponse = z.object({ error: z.string() });

interface HolidayEvent {
  name: string;
  date: string;
  countryCode: string;
}

const COUNTRY_CALENDAR_MAP: Record<string, string> = {
  de: 'de.german',
  at: 'de.austrian',
  ch: 'de.ch',
  us: 'en.usa',
  gb: 'en.uk',
};

/**
 * Fetch public holidays from Google Calendar for a given country and year.
 */
export async function holidayRoutes(app: FastifyInstance) {
  app.get('/api/holidays', {
    preHandler: [requireAuth],
    schema: {
      summary: 'Get public holidays',
      description: 'Fetches public holidays from Google Calendar for a given country and year. Results are cached for 30 days.',
      tags: ['System'],
      security: [{ session: [] }, { apiKey: [] }],
      querystring: z.object({
        country: z.string().optional().describe('Country code (de, at, ch, us, gb). Defaults to de.'),
        year: z.string().optional().describe('Year (2020-2100). Defaults to current year.'),
      }),
      response: {
        200: z.array(z.object({
          name: z.string().describe('Holiday name'),
          date: z.string().describe('Date in YYYY-MM-DD format'),
          countryCode: z.string().describe('Country code'),
        })),
        400: ErrorResponse,
        500: ErrorResponse,
        502: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { id: userId } = request.session.user!;

    const { country = 'de', year } = request.query as { country?: string; year?: string };
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();

    if (isNaN(targetYear) || targetYear < 2020 || targetYear > 2100) {
      return reply.status(400).send({ error: 'Invalid year' });
    }

    const cacheKey = `holidays:${country}:${targetYear}`;

    // Check Redis cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    const calendarPrefix = COUNTRY_CALENDAR_MAP[country];
    if (!calendarPrefix) {
      return reply.status(400).send({ error: `Unsupported country: ${country}` });
    }

    const calendarId = `${calendarPrefix}%23holiday%40group.v.calendar.google.com`;
    const timeMin = `${targetYear}-01-01T00:00:00Z`;
    const timeMax = `${targetYear}-12-31T23:59:59Z`;

    try {
      const accessToken = await getAccessToken(userId);
      const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const body = await res.text();
        app.log.error(`Google Calendar holidays fetch failed: ${res.status} ${body}`);
        return reply.status(502).send({ error: 'Failed to fetch holidays from Google Calendar' });
      }

      const data = await res.json() as { items?: Array<{ summary: string; start: { date?: string; dateTime?: string } }> };
      const holidays: HolidayEvent[] = (data.items ?? [])
        .filter((item) => item.start?.date) // All-day events only
        .map((item) => ({
          name: item.summary,
          date: item.start.date!,
          countryCode: country,
        }));

      // Cache for 30 days
      await redis.set(cacheKey, JSON.stringify(holidays), 'EX', 30 * 24 * 60 * 60);

      return reply.send(holidays);
    } catch (err: any) {
      app.log.error(`Holiday fetch error: ${err.message}`);
      return reply.status(500).send({ error: 'Failed to fetch holidays' });
    }
  });
}
