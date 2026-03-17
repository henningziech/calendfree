// backend/src/routes/admin/company.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';
import { CreateCompanySchema, UpdateCompanySchema, BrandingConfigSchema } from '@calendfree/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'public', 'uploads', 'logos');

const ErrorResponse = z.object({ error: z.string() });

const BrandingResponse = z.object({
  id: z.string().describe('Branding config ID'),
  companyId: z.string().describe('Associated company ID'),
  logoUrl: z.string().nullable().describe('Logo image URL'),
  primaryColor: z.string().nullable().describe('Primary brand color'),
  accentColor: z.string().nullable().describe('Accent brand color'),
  backgroundColor: z.string().nullable().describe('Background color'),
  textColor: z.string().nullable().describe('Text color'),
  fontFamily: z.string().nullable().describe('Font family'),
  showPoweredBy: z.boolean().describe('Whether to show powered-by badge'),
  footerText: z.string().nullable().describe('Custom footer text'),
});

const CompanyResponse = z.object({
  id: z.string().describe('Company ID'),
  name: z.string().describe('Company display name'),
  slug: z.string().describe('Company URL slug'),
  customDomain: z.string().nullable().describe('Custom domain for booking pages'),
  language: z.string().nullable().describe('Preferred language code'),
  organizationId: z.string().describe('Parent organization ID'),
  createdAt: z.string().describe('Creation timestamp (ISO 8601)'),
  updatedAt: z.string().describe('Last update timestamp (ISO 8601)'),
});

export async function companyRoutes(app: FastifyInstance) {
  /** POST /api/admin/companies — Create company (ORG_ADMIN only) */
  app.post('/api/admin/companies', {
    schema: {
      summary: 'Create company',
      description: 'Creates a new company within the current organization. Requires ORG_ADMIN role.',
      tags: ['Companies'],
      security: [{ session: [] }, { apiKey: [] }],
      body: CreateCompanySchema,
    },
    preHandler: [requireRole('ORG_ADMIN')],
  }, async (request, reply) => {
    const user = request.session.user!;
    const body = CreateCompanySchema.parse(request.body);

    const company = await prisma.company.create({
      data: { ...body, organizationId: user.organizationId },
    });
    return reply.status(201).send(company);
  });

  /** GET /api/admin/companies — List companies */
  app.get('/api/admin/companies', {
    schema: {
      summary: 'List companies',
      description: 'Lists companies accessible to the current user. ORG_ADMIN sees all companies in the organization; COMPANY_ADMIN sees only their own.',
      tags: ['Companies'],
      security: [{ session: [] }, { apiKey: [] }],
    },
    preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')],
  }, async (request) => {
    const user = request.session.user!;

    // ORG_ADMIN sees all companies, COMPANY_ADMIN sees only their own
    if (user.activeRole === 'ORG_ADMIN') {
      return prisma.company.findMany({
        where: { organizationId: user.organizationId },
        include: { branding: true },
      });
    }

    const memberships = await prisma.companyMembership.findMany({
      where: { userId: user.id },
      include: { company: { include: { branding: true } } },
    });
    return memberships.map((m) => m.company);
  });

  /** GET /api/admin/companies/:id — Get company details */
  app.get('/api/admin/companies/:id', {
    schema: {
      summary: 'Get company details',
      description: 'Returns detailed company information including branding and teams. COMPANY_ADMIN can only view companies they are a member of.',
      tags: ['Companies'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('Company ID'),
      }),
    },
    preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    // COMPANY_ADMIN can only view their own company
    if (user.activeRole === 'COMPANY_ADMIN') {
      const membership = await prisma.companyMembership.findFirst({
        where: { userId: user.id, companyId: id },
      });
      if (!membership) return reply.status(403).send({ error: 'Not authorized' });
    }

    const company = await prisma.company.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        branding: true,
        teams: {
          include: {
            _count: { select: { memberships: true } },
          },
        },
      },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });
    return company;
  });

  /** PATCH /api/admin/companies/:id — Update company */
  app.patch('/api/admin/companies/:id', {
    schema: {
      summary: 'Update company',
      description: 'Updates company properties such as name, slug, custom domain, or language. Only fields provided in the request body are updated.',
      tags: ['Companies'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('Company ID'),
      }),
      body: UpdateCompanySchema,
    },
    preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    const body = UpdateCompanySchema.parse(request.body);

    const company = await prisma.company.updateMany({
      where: { id, organizationId: user.organizationId },
      data: body,
    });
    if (company.count === 0) return reply.status(404).send({ error: 'Company not found' });

    return prisma.company.findUnique({ where: { id } });
  });

  /** GET /api/admin/companies/:companyId/bookings — Recent bookings for a company */
  app.get('/api/admin/companies/:companyId/bookings', {
    schema: {
      summary: 'Get company bookings',
      description: 'Returns the 20 most recent bookings for a company, ordered by start time descending. Includes event type, customer, and assigned user details.',
      tags: ['Companies'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        companyId: z.string().describe('Company ID'),
      }),
    },
    preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')],
  }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const user = request.session.user!;

    // COMPANY_ADMIN can only view their own company
    if (user.activeRole === 'COMPANY_ADMIN') {
      const membership = await prisma.companyMembership.findFirst({
        where: { userId: user.id, companyId },
      });
      if (!membership) return reply.status(403).send({ error: 'Not authorized' });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        eventType: { companyId },
      },
      include: {
        eventType: { select: { title: true, slug: true, duration: true, teamId: true, team: { select: { name: true } }, company: { select: { slug: true } } } },
        formData: { select: { name: true, email: true, data: true } },
        assignedUser: { select: { name: true, email: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 20,
    });

    return bookings;
  });

  /** DELETE /api/admin/companies/:id — Delete company (ORG_ADMIN only) */
  app.delete('/api/admin/companies/:id', {
    schema: {
      summary: 'Delete company',
      description: 'Permanently deletes a company and all associated data. Requires ORG_ADMIN role.',
      tags: ['Companies'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('Company ID'),
      }),
    },
    preHandler: [requireRole('ORG_ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const result = await prisma.company.deleteMany({
      where: { id, organizationId: user.organizationId },
    });
    if (result.count === 0) return reply.status(404).send({ error: 'Company not found' });
    return { success: true };
  });

  /** PUT /api/admin/companies/:id/branding — Update company branding */
  app.put('/api/admin/companies/:id/branding', {
    schema: {
      summary: 'Update company branding',
      description: 'Creates or updates branding configuration for a company, including colors, fonts, logo URL, and footer text.',
      tags: ['Companies'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('Company ID'),
      }),
      body: BrandingConfigSchema,
    },
    preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    const body = BrandingConfigSchema.parse(request.body);

    // Verify company belongs to user's organization
    const company = await prisma.company.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    const branding = await prisma.brandingConfig.upsert({
      where: { companyId: id },
      update: body,
      create: { ...body, companyId: id },
    });
    return branding;
  });

  /** POST /api/admin/companies/:id/branding/logo — Upload company logo */
  app.post('/api/admin/companies/:id/branding/logo', {
    schema: {
      summary: 'Upload company logo',
      description: 'Uploads a logo image for the company. Accepts PNG, JPEG, GIF, and WebP formats. Replaces any existing logo.',
      tags: ['Companies'],
      security: [{ session: [] }, { apiKey: [] }],
      consumes: ['multipart/form-data'],
      params: z.object({
        id: z.string().describe('Company ID'),
      }),
      body: z.object({
        file: z.any().describe('Binary file upload (PNG, JPEG, GIF, WebP)'),
      }),
    },
    preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    // Verify company belongs to user's organization
    const company = await prisma.company.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { branding: true },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    const file = await request.file();
    if (!file) return reply.status(400).send({ error: 'No file uploaded' });

    const buffer = await file.toBuffer();

    // Validate by magic bytes using file-type
    const { fileTypeFromBuffer } = await import('file-type');
    const type = await fileTypeFromBuffer(buffer);
    const allowedMimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!type || !allowedMimes.includes(type.mime)) {
      return reply.status(400).send({ error: 'Invalid file type. Allowed: PNG, JPEG, GIF, WebP' });
    }

    // Create uploads directory
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    // Delete previous logo if exists
    if (company.branding?.logoUrl) {
      const oldPath = path.join(__dirname, '..', '..', '..', 'public', company.branding.logoUrl);
      await fs.unlink(oldPath).catch(() => {});
    }

    // Save file
    const filename = `${id}-${Date.now()}.${type.ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    await fs.writeFile(filepath, buffer);

    const logoUrl = `/uploads/logos/${filename}`;
    const branding = await prisma.brandingConfig.upsert({
      where: { companyId: id },
      update: { logoUrl },
      create: { logoUrl, companyId: id },
    });

    return branding;
  });

  /** DELETE /api/admin/companies/:id/branding/logo — Remove company logo */
  app.delete('/api/admin/companies/:id/branding/logo', {
    schema: {
      summary: 'Delete company logo',
      description: 'Removes the company logo file from the server and clears the logo URL from the branding configuration.',
      tags: ['Companies'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('Company ID'),
      }),
    },
    preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    // Verify company belongs to user's organization
    const company = await prisma.company.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { branding: true },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    if (company.branding?.logoUrl) {
      const oldPath = path.join(__dirname, '..', '..', '..', 'public', company.branding.logoUrl);
      await fs.unlink(oldPath).catch(() => {});
    }

    if (company.branding) {
      await prisma.brandingConfig.update({
        where: { companyId: id },
        data: { logoUrl: null },
      });
    }

    return { success: true };
  });
}
