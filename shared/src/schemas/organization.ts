import { z } from 'zod/v4';

export const SlugSchema = z.string()
  .min(2).max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: SlugSchema,
});
export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;

export const CreateCompanySchema = z.object({
  name: z.string().min(1).max(255),
  slug: SlugSchema,
});
export type CreateCompany = z.infer<typeof CreateCompanySchema>;

export const BrandingConfigSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontFamily: z.string().max(100).optional(),
  showPoweredBy: z.boolean().optional(),
  footerText: z.string().max(200).nullable().optional(),
});
export type BrandingConfig = z.infer<typeof BrandingConfigSchema>;
