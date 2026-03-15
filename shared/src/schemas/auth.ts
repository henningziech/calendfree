import { z } from 'zod';

export const RoleSchema = z.enum(['ORG_ADMIN', 'COMPANY_ADMIN', 'USER']);
export type Role = z.infer<typeof RoleSchema>;

export const SessionUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().nullable(),
  organizationId: z.string().uuid(),
  /** Active company context — user can switch between companies they belong to */
  activeCompanyId: z.string().uuid().nullable(),
  /** Role in the active company (null if no company selected) */
  activeRole: RoleSchema.nullable(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

export const GoogleTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.date(),
  scopes: z.array(z.string()),
});
export type GoogleTokens = z.infer<typeof GoogleTokensSchema>;
