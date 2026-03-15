import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { addDays, addMinutes, setHours, setMinutes } from 'date-fns';

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

  console.log('Base seed:', { org: org.slug, companies: [groupGmbh.slug, solutions.slug] });

  // ── Demo Data: 5 Users, 2 Teams, Event Types, Bookings ──

  const usersData = [
    { name: 'Anna Schmidt', email: 'anna.schmidt@seibert.group' },
    { name: 'Ben Weber', email: 'ben.weber@seibert.group' },
    { name: 'Clara Fischer', email: 'clara.fischer@seibert.group' },
    { name: 'David Müller', email: 'david.mueller@seibert.group' },
    { name: 'Eva König', email: 'eva.koenig@seibert.group' },
  ];

  const users = [];
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { email: u.email, name: u.name, organizationId: org.id },
    });
    users.push(user);

    await prisma.companyMembership.upsert({
      where: { userId_companyId: { userId: user.id, companyId: groupGmbh.id } },
      update: {},
      create: { userId: user.id, companyId: groupGmbh.id, role: 'USER' },
    });
  }
  console.log(`Upserted ${users.length} demo users`);

  const [anna, ben, clara, david, eva] = users;

  // Team 1: AppCare Support (Anna, Ben, Clara) — SEQUENTIAL
  let team1 = await prisma.team.findFirst({ where: { name: 'AppCare Support', companyId: groupGmbh.id } });
  if (!team1) {
    team1 = await prisma.team.create({
      data: {
        name: 'AppCare Support',
        companyId: groupGmbh.id,
        rrConfig: { create: { mode: 'SEQUENTIAL' } },
      },
    });
    console.log('Created team: AppCare Support');
  }

  for (const user of [anna, ben, clara]) {
    await prisma.teamMembership.upsert({
      where: { userId_teamId: { userId: user.id, teamId: team1.id } },
      update: {},
      create: { userId: user.id, teamId: team1.id, weight: 100 },
    });
  }

  // Team 2: Sales Engineering (David, Eva) — LEAST_BUSY
  let team2 = await prisma.team.findFirst({ where: { name: 'Sales Engineering', companyId: groupGmbh.id } });
  if (!team2) {
    team2 = await prisma.team.create({
      data: {
        name: 'Sales Engineering',
        companyId: groupGmbh.id,
        rrConfig: { create: { mode: 'LEAST_BUSY' } },
      },
    });
    console.log('Created team: Sales Engineering');
  }

  for (const user of [david, eva]) {
    await prisma.teamMembership.upsert({
      where: { userId_teamId: { userId: user.id, teamId: team2.id } },
      update: {},
      create: { userId: user.id, teamId: team2.id, weight: 100 },
    });
  }

  // Event Types
  const et1 = await prisma.eventType.upsert({
    where: { companyId_slug: { companyId: groupGmbh.id, slug: 'appcare-beratung' } },
    update: {},
    create: {
      title: 'AppCare Beratungstermin',
      slug: 'appcare-beratung',
      description: 'Persönliche Beratung zu AppCare Produkten',
      duration: 30,
      companyId: groupGmbh.id,
      teamId: team1.id,
      autoMeetLink: true,
      allowComment: true,
    },
  });

  const et2 = await prisma.eventType.upsert({
    where: { companyId_slug: { companyId: groupGmbh.id, slug: 'sales-demo' } },
    update: {},
    create: {
      title: 'Sales Demo',
      slug: 'sales-demo',
      description: 'Produktdemo für Interessenten',
      duration: 45,
      companyId: groupGmbh.id,
      teamId: team2.id,
      autoMeetLink: true,
      allowComment: true,
    },
  });

  console.log('Upserted event types');

  // Test bookings
  const now = new Date();
  const bookingsData = [
    // Team 1 — upcoming
    { et: et1, user: anna, customer: 'Max Mustermann', email: 'max@example.com', dayOffset: 1, hour: 10, status: 'CONFIRMED' as const },
    { et: et1, user: ben, customer: 'Lisa Beispiel', email: 'lisa@example.com', dayOffset: 2, hour: 14, status: 'CONFIRMED' as const },
    { et: et1, user: clara, customer: 'Thomas Test', email: 'thomas@test.de', dayOffset: 3, hour: 11, status: 'CONFIRMED' as const },
    // Team 1 — past
    { et: et1, user: anna, customer: 'Julia Vergangen', email: 'julia@example.com', dayOffset: -3, hour: 9, status: 'COMPLETED' as const },
    { et: et1, user: ben, customer: 'Peter Abgesagt', email: 'peter@example.com', dayOffset: -1, hour: 15, status: 'CANCELLED' as const },
    // Team 2 — upcoming
    { et: et2, user: david, customer: 'Firma ABC GmbH', email: 'kontakt@abc-gmbh.de', dayOffset: 1, hour: 13, status: 'CONFIRMED' as const },
    { et: et2, user: eva, customer: 'Startup XYZ', email: 'hello@xyz.io', dayOffset: 4, hour: 10, status: 'CONFIRMED' as const },
    // Team 2 — past
    { et: et2, user: david, customer: 'Alte Demo AG', email: 'info@altedemo.de', dayOffset: -5, hour: 14, status: 'COMPLETED' as const },
  ];

  let created = 0;
  for (const b of bookingsData) {
    const startTime = setMinutes(setHours(addDays(now, b.dayOffset), b.hour), 0);
    const endTime = addMinutes(startTime, b.et.duration);
    const token = randomBytes(32).toString('hex');

    const existing = await prisma.booking.findFirst({
      where: { assignedUserId: b.user.id, startTime },
    });
    if (existing) continue;

    await prisma.booking.create({
      data: {
        eventTypeId: b.et.id,
        assignedUserId: b.user.id,
        startTime,
        endTime,
        status: b.status,
        bookingToken: token,
        tokenExpiresAt: startTime,
        formData: {
          create: {
            name: b.customer,
            email: b.email,
            data: {},
          },
        },
      },
    });
    created++;
  }

  console.log(`Created ${created} test bookings`);
  console.log('Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
