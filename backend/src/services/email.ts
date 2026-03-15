// backend/src/services/email.ts
import { google } from 'googleapis';
import { getAuthenticatedClient } from './calendar.js';

/**
 * Send an email via Gmail API using the specified user's OAuth tokens.
 * The email appears to come FROM the user (consultant), not from a system address.
 */
export async function sendEmail(params: {
  userId: string;
  to: string;
  subject: string;
  htmlBody: string;
  replyTo?: string;
}): Promise<{ messageId: string }> {
  const auth = await getAuthenticatedClient(params.userId);
  const gmail = google.gmail({ version: 'v1', auth });

  // Build RFC 2822 compliant email
  const messageParts = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
  ];

  if (params.replyTo) {
    messageParts.push(`Reply-To: ${params.replyTo}`);
  }

  messageParts.push('', params.htmlBody);
  const rawMessage = messageParts.join('\r\n');

  // Base64url encode
  const encoded = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });

  return { messageId: response.data.id! };
}
