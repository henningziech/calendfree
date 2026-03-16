// shared/src/schemas/admin.ts
import { z } from 'zod';
import { SlugSchema, BrandingConfigSchema } from './organization.js';
import { RoleSchema } from './auth.js';

// Company management
export const UpdateCompanySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: SlugSchema.optional(),
  customDomain: z.string().max(255).nullable().optional(),
});
export type UpdateCompany = z.infer<typeof UpdateCompanySchema>;

// Team management
export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(255),
  roundRobinMode: z.enum(['SEQUENTIAL', 'LEAST_BUSY', 'WEIGHTED']).default('SEQUENTIAL'),
});
export type CreateTeam = z.infer<typeof CreateTeamSchema>;

export const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});
export type UpdateTeam = z.infer<typeof UpdateTeamSchema>;

export const AddTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  weight: z.number().int().min(1).max(100).default(100),
});
export type AddTeamMember = z.infer<typeof AddTeamMemberSchema>;

export const UpdateTeamMemberSchema = z.object({
  weight: z.number().int().min(1).max(100),
});
export type UpdateTeamMember = z.infer<typeof UpdateTeamMemberSchema>;

export const UpdateRoundRobinSchema = z.object({
  mode: z.enum(['SEQUENTIAL', 'LEAST_BUSY', 'WEIGHTED']),
});
export type UpdateRoundRobin = z.infer<typeof UpdateRoundRobinSchema>;

// User / membership management
export const InviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: RoleSchema.default('USER'),
});
export type InviteUser = z.infer<typeof InviteUserSchema>;

export const UpdateMembershipRoleSchema = z.object({
  role: RoleSchema,
});
export type UpdateMembershipRole = z.infer<typeof UpdateMembershipRoleSchema>;

// Event type management
export const CreateEventTypeSchema = z.object({
  title: z.string().min(1).max(255),
  slug: SlugSchema,
  description: z.string().max(2000).optional(),
  duration: z.number().int().min(5).max(480).default(30),
  bufferBefore: z.number().int().min(0).max(120).default(0),
  bufferAfter: z.number().int().min(0).max(120).default(0),
  minNotice: z.number().int().min(0).max(720).default(4),
  maxAdvance: z.number().int().min(1).max(365).default(60),
  autoMeetLink: z.boolean().default(true),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  teamId: z.string().uuid().nullable().optional(),
  roundRobinMode: z.enum(['SEQUENTIAL', 'LEAST_BUSY', 'WEIGHTED']).default('SEQUENTIAL'),
  /** Bookable hours per weekday. If null, defaults to Mo-Fr 9-17. */
  bookableHours: z.record(z.array(z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }))).nullable().optional(),
  allowComment: z.boolean().default(false),
  formFields: z.array(z.object({
    label: z.string().min(1).max(255),
    type: z.enum(['text', 'email', 'phone', 'select', 'textarea']).default('text'),
    required: z.boolean().default(false),
    options: z.array(z.string()).default([]),
  })).default([]),
  eventCategory: z.enum(['PERSONAL', 'TEAM', 'GROUP']).default('PERSONAL'),
  maxInvitees: z.number().int().min(2).max(1000).nullable().optional(),
  showRemainingSpots: z.boolean().default(false),
});
export type CreateEventType = z.infer<typeof CreateEventTypeSchema>;

export const UpdateEventTypeSchema = CreateEventTypeSchema.partial().omit({ slug: true, formFields: true });
export type UpdateEventType = z.infer<typeof UpdateEventTypeSchema>;

// Availability
export const UpdateAvailabilitySchema = z.object({
  weeklySchedule: z.record(z.array(z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }))).optional(),
  maxPerDay: z.number().int().min(1).max(50).nullable().optional(),
  maxPerWeek: z.number().int().min(1).max(200).nullable().optional(),
  blockedHolidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  holidayCountry: z.string().min(2).max(5).nullable().optional(),
});
export type UpdateAvailability = z.infer<typeof UpdateAvailabilitySchema>;

// API Key
export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  expiresAt: z.string().datetime().nullable().optional(),
});
export type CreateApiKey = z.infer<typeof CreateApiKeySchema>;
