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
    const org = await prisma.organization.findFirst();
    if (!org) {
      throw new Error('No organization exists. Please run the seed script first.');
    }

    // Check if this is the first user in the org → make them ORG_ADMIN
    const existingUserCount = await prisma.user.count({ where: { organizationId: org.id } });
    const isFirstUser = existingUserCount === 0;

    user = await prisma.user.create({
      data: {
        email,
        name,
        avatarUrl: picture,
        organizationId: org.id,
      },
    });

    // Auto-create company memberships for all companies in the org
    const companies = await prisma.company.findMany({ where: { organizationId: org.id } });
    for (const company of companies) {
      await prisma.companyMembership.create({
        data: {
          userId: user.id,
          companyId: company.id,
          role: isFirstUser ? 'ORG_ADMIN' : 'USER',
        },
      });
    }

    // Auto-create availability config with sensible defaults
    await prisma.availabilityConfig.create({
      data: { userId: user.id },
    });
  } else {
    // Existing user — update profile info from Google
    user = await prisma.user.update({
      where: { id: user.id },
      data: { name, avatarUrl: picture },
    });

    // Ensure availability config exists
    await prisma.availabilityConfig.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
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
