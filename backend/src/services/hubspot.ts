// backend/src/services/hubspot.ts

interface HubSpotConfig {
  apiKey: string;
  portalId?: string;
}

/** Find or create a HubSpot contact by email. */
export async function upsertContact(
  hsConfig: HubSpotConfig,
  data: { email: string; name: string },
): Promise<{ contactId: string }> {
  // Search for existing contact
  const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hsConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: data.email }] }],
    }),
  });

  const searchData = await searchRes.json();
  if (searchData.results?.length > 0) {
    return { contactId: searchData.results[0].id };
  }

  // Create new contact
  const [firstName, ...lastParts] = data.name.split(' ');
  const lastName = lastParts.join(' ') || '';

  const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hsConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { email: data.email, firstname: firstName, lastname: lastName },
    }),
  });

  const createData = await createRes.json();
  return { contactId: createData.id };
}

/** Create a meeting activity in HubSpot. */
export async function createMeeting(
  hsConfig: HubSpotConfig,
  data: { contactId: string; title: string; startTime: Date; endTime: Date; meetLink?: string | null },
): Promise<void> {
  await fetch('https://api.hubapi.com/crm/v3/objects/meetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hsConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        hs_meeting_title: data.title,
        hs_meeting_start_time: data.startTime.toISOString(),
        hs_meeting_end_time: data.endTime.toISOString(),
        hs_meeting_location: data.meetLink ?? '',
      },
      associations: [{
        to: { id: data.contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 200 }],
      }],
    }),
  });
}
