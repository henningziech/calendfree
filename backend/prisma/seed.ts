import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create organization
  const org = await prisma.organization.upsert({
    where: { slug: 'seibert-group' },
    update: {},
    create: {
      name: 'Seibert Group',
      slug: 'seibert-group',
    },
  });

  // Create org branding
  await prisma.brandingConfig.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      primaryColor: '#2563EB',
      accentColor: '#7C3AED',
    },
  });

  // Create companies
  const groupGmbh = await prisma.company.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'seibert-group-gmbh' } },
    update: {},
    create: {
      name: 'Seibert Group GmbH',
      slug: 'seibert-group-gmbh',
      organizationId: org.id,
    },
  });

  const solutions = await prisma.company.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'seibert-solutions' } },
    update: {},
    create: {
      name: 'Seibert Solutions GmbH',
      slug: 'seibert-solutions',
      organizationId: org.id,
    },
  });

  // Create admin user (Henning Ziech = Org Admin)
  const admin = await prisma.user.upsert({
    where: { email: 'henning.ziech@seibert.group' },
    update: {},
    create: {
      email: 'henning.ziech@seibert.group',
      name: 'Henning Ziech',
      organizationId: org.id,
    },
  });

  // Ensure availability config exists
  await prisma.availabilityConfig.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id },
  });

  // Make admin org-admin in both companies
  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: admin.id, companyId: groupGmbh.id } },
    update: {},
    create: { userId: admin.id, companyId: groupGmbh.id, role: 'ORG_ADMIN' },
  });

  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: admin.id, companyId: solutions.id } },
    update: {},
    create: { userId: admin.id, companyId: solutions.id, role: 'ORG_ADMIN' },
  });

  console.log('Seed completed:', { org: org.slug, companies: [groupGmbh.slug, solutions.slug] });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
