import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
];

export function createOAuth2Client(): OAuth2Client {
  return new OAuth2Client({
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    redirectUri: config.GOOGLE_REDIRECT_URI,
  });
}

/** Generate the Google OAuth consent URL. */
export function getAuthUrl(state?: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
}

/** Exchange authorization code for tokens and upsert user. */
export async function handleCallback(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Get user info
  const userInfo = await client.request<{
    email: string;
    name: string;
    picture: string;
  }>({ url: 'https://www.googleapis.com/oauth2/v2/userinfo' });

  const { email, name, picture } = userInfo.data;

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // New user — must be invited to an org first (or be the first user = org admin)
    // For now, auto-create in first org (setup flow will be more sophisticated)
    const org = await prisma.organization.findFirst();
    if (!org) {
      throw new Error('No organization exists. Please run the seed script first.');
    }

    user = await prisma.user.create({
      data: {
        email,
        name,
        avatarUrl: picture,
        organizationId: org.id,
      },
    });
  }

  // Store encrypted tokens
  await prisma.googleTokens.upsert({
    where: { userId: user.id },
    update: {
      accessToken: encrypt(tokens.access_token!),
      refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
      expiresAt: new Date(tokens.expiry_date!),
      scopes: SCOPES,
      connected: true,
    },
    create: {
      userId: user.id,
      accessToken: encrypt(tokens.access_token!),
      refreshToken: encrypt(tokens.refresh_token!),
      expiresAt: new Date(tokens.expiry_date!),
      scopes: SCOPES,
    },
  });

  // Get user's company memberships for session
  const memberships = await prisma.companyMembership.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  const activeMembership = memberships[0] ?? null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    organizationId: user.organizationId,
    activeCompanyId: activeMembership?.companyId ?? null,
    activeRole: activeMembership?.role ?? null,
  };
}
