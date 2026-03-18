// shared/src/schemas/admin.ts
import { z } from 'zod/v4';
import { SlugSchema, BrandingConfigSchema } from './organization.js';
import { RoleSchema } from './auth.js';

export const LanguageSchema = z.enum(['en', 'de']);
export type Language = z.infer<typeof LanguageSchema>;

// Company management
export const UpdateCompanySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: SlugSchema.optional(),
  customDomain: z.string().max(255).nullable().optional(),
  language: LanguageSchema.optional(),
});
export type UpdateCompany = z.infer<typeof UpdateCompanySchema>;

// Team management
export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(255),
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

export const UpdateTeamMemberRoleSchema = z.object({
  role: z.enum(['MEMBER', 'OWNER']),
});
export type UpdateTeamMemberRole = z.infer<typeof UpdateTeamMemberRoleSchema>;

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
const CreateEventTypeBaseSchema = z.object({
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
  bookableHours: z.record(z.string(), z.array(z.object({
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

export const CreateEventTypeSchema = CreateEventTypeBaseSchema.superRefine((data, ctx) => {
  if (data.eventCategory === 'GROUP' && (data.maxInvitees === null || data.maxInvitees === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'maxInvitees is required for GROUP event types (min 2)',
      path: ['maxInvitees'],
    });
  }
  if (data.eventCategory === 'GROUP' && data.teamId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'GROUP event types cannot have a teamId',
      path: ['teamId'],
    });
  }
  if (data.eventCategory === 'TEAM' && !data.teamId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'TEAM event types require a teamId',
      path: ['teamId'],
    });
  }
});
export type CreateEventType = z.infer<typeof CreateEventTypeSchema>;

export const UpdateEventTypeSchema = CreateEventTypeBaseSchema.partial().omit({ slug: true, formFields: true });
export type UpdateEventType = z.infer<typeof UpdateEventTypeSchema>;

// Availability
export const UpdateAvailabilitySchema = z.object({
  weeklySchedule: z.record(z.string(), z.array(z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }))).optional(),
  maxPerDay: z.number().int().min(1).max(50).nullable().optional(),
  maxPerWeek: z.number().int().min(1).max(200).nullable().optional(),
  blockedHolidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  holidayCountry: z.string().min(2).max(5).nullable().optional(),
  dateSpecificHours: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.array(z.object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    }))
  ).nullable().optional(),
});
export type UpdateAvailability = z.infer<typeof UpdateAvailabilitySchema>;

// API Key
export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  expiresAt: z.string().datetime().nullable().optional(),
});
export type CreateApiKey = z.infer<typeof CreateApiKeySchema>;

// Self-service status
export const UpdateMyStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'ABSENT']),
  absentUntil: z.string().datetime().nullable().optional(),
});
export type UpdateMyStatus = z.infer<typeof UpdateMyStatusSchema>;

export const UpdateMyLanguageSchema = z.object({
  language: LanguageSchema,
});
export type UpdateMyLanguage = z.infer<typeof UpdateMyLanguageSchema>;

// Vacation periods
export const CreateVacationSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().max(255).nullable().optional(),
}).refine((data) => data.startDate <= data.endDate, {
  message: 'startDate must be before or equal to endDate',
  path: ['endDate'],
});
export type CreateVacation = z.infer<typeof CreateVacationSchema>;

// Routing Forms
export const RoutingTargetType = z.enum(['EVENT_TYPE', 'MESSAGE', 'URL']);
export type RoutingTargetType = z.infer<typeof RoutingTargetType>;

export const RoutingOptionSchema = z.object({
  label: z.string().min(1).max(200),
  targetType: RoutingTargetType,
  targetValue: z.string().min(1).max(2000),
  order: z.number().int().min(0),
});
export type RoutingOption = z.infer<typeof RoutingOptionSchema>;

export const CreateRoutingFormSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(1000).optional(),
  question: z.string().min(1).max(500).default('Wofür interessieren Sie sich?'),
  collectName: z.boolean().default(false),
  collectEmail: z.boolean().default(false),
  fallbackType: RoutingTargetType.default('MESSAGE'),
  fallbackValue: z.string().max(2000).default('Bitte kontaktieren Sie uns direkt.'),
  options: z.array(RoutingOptionSchema).min(1, 'At least one option is required'),
});
export type CreateRoutingForm = z.infer<typeof CreateRoutingFormSchema>;

export const UpdateRoutingFormSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(1000).nullable().optional(),
  question: z.string().min(1).max(500).optional(),
  collectName: z.boolean().optional(),
  collectEmail: z.boolean().optional(),
  active: z.boolean().optional(),
  fallbackType: RoutingTargetType.optional(),
  fallbackValue: z.string().max(2000).optional(),
  options: z.array(RoutingOptionSchema).min(1).optional(),
});
export type UpdateRoutingForm = z.infer<typeof UpdateRoutingFormSchema>;

export const ResolveRoutingFormSchema = z.object({
  optionId: z.string().uuid(),
  name: z.string().optional(),
  email: z.string().email().optional(),
});
export type ResolveRoutingForm = z.infer<typeof ResolveRoutingFormSchema>;

// Notification config
export const Reminder1TimingSchema = z.enum(['48h', '24h', '12h', '6h', '2h']);
export type Reminder1Timing = z.infer<typeof Reminder1TimingSchema>;

export const Reminder2TimingSchema = z.enum(['4h', '2h', '1h', '30min', '15min']);
export type Reminder2Timing = z.infer<typeof Reminder2TimingSchema>;

export const FollowUpTimingSchema = z.enum(['30min', '1h', '2h', '6h', '24h']);
export type FollowUpTiming = z.infer<typeof FollowUpTimingSchema>;

export const NotificationTypeSchema = z.enum(['confirmation', 'cancellation', 'reminder1', 'reminder2', 'followUp']);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const UpdateNotificationConfigSchema = z.object({
  confirmationEnabled: z.boolean(),
  confirmationSubject: z.string().max(200).nullable(),
  confirmationBody: z.string().max(5000).nullable(),
  cancellationEnabled: z.boolean(),
  cancellationSubject: z.string().max(200).nullable(),
  cancellationBody: z.string().max(5000).nullable(),
  reminder1Enabled: z.boolean(),
  reminder1Timing: Reminder1TimingSchema,
  reminder1Subject: z.string().max(200).nullable(),
  reminder1Body: z.string().max(5000).nullable(),
  reminder2Enabled: z.boolean(),
  reminder2Timing: Reminder2TimingSchema,
  reminder2Subject: z.string().max(200).nullable(),
  reminder2Body: z.string().max(5000).nullable(),
  followUpEnabled: z.boolean(),
  followUpTiming: FollowUpTimingSchema,
  followUpSubject: z.string().max(200).nullable(),
  followUpBody: z.string().max(5000).nullable(),
});
export type UpdateNotificationConfig = z.infer<typeof UpdateNotificationConfigSchema>;

export const PreviewNotificationSchema = z.object({
  type: NotificationTypeSchema,
  subject: z.string().max(200).nullable().optional(),
  body: z.string().max(5000).nullable().optional(),
});
export type PreviewNotification = z.infer<typeof PreviewNotificationSchema>;
