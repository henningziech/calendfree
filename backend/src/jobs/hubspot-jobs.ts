// backend/src/jobs/hubspot-jobs.ts
import { getQueue } from './queue.js';
import { prisma } from '../db.js';
import { upsertContact, createMeeting } from '../services/hubspot.js';

export const HUBSPOT_JOB = 'hubspot-sync';

export async function registerHubSpotHandlers(): Promise<void> {
  const queue = getQueue();

  await queue.work(HUBSPOT_JOB, async (job) => {
    const { bookingId } = job.data;

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        formData: true,
        eventType: { include: { company: true } },
      },
    });

    if (!booking.formData) return;

    // Check if company has HubSpot configured (stored as encrypted JSON in company metadata)
    // For now, check for a simple env var. Full per-company config will be in settings.
    const hubspotKey = process.env.HUBSPOT_API_KEY;
    if (!hubspotKey) return;

    const hsConfig = { apiKey: hubspotKey };

    const { contactId } = await upsertContact(hsConfig, {
      email: booking.formData.email,
      name: booking.formData.name,
    });

    await createMeeting(hsConfig, {
      contactId,
      title: `${booking.eventType.title} — ${booking.formData.name}`,
      startTime: booking.startTime,
      endTime: booking.endTime,
    });
  });
}

/** Queue a HubSpot sync job for a booking. */
export async function queueHubSpotSync(bookingId: string): Promise<void> {
  const queue = getQueue();
  await queue.send(HUBSPOT_JOB, { bookingId });
}
