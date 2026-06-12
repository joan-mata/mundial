import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { fetchAllMatches, mapStatus, mapStage, countryFlag } from '../lib/football-api';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  // Admin user
  const adminUsername = process.env.ADMIN_USERNAME ?? 'admin_mundial';
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName     = process.env.ADMIN_NAME ?? 'Admin';

  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD must be set in .env');
  }

  const hash = await bcrypt.hash(adminPassword, 12);
  await db.user.upsert({
    where:  { username: adminUsername },
    create: { username: adminUsername, name: adminName, passwordHash: hash, role: 'ADMIN', mustChangePassword: false },
    update: { passwordHash: hash, name: adminName, mustChangePassword: false },
  });
  console.log(`✓ Admin user: ${adminUsername}`);

  // Fetch fixture from football-data.org
  let matchData: Record<string, unknown>[] = [];
  if (process.env.FOOTBALL_API_KEY) {
    try {
      console.log('Fetching fixture from football-data.org…');
      const data = await fetchAllMatches();
      matchData = data.matches ?? [];
      console.log(`  → ${matchData.length} matches received`);
    } catch (e) {
      console.warn('  ⚠ Could not fetch from API:', String(e));
      console.warn('  Using empty fixture — run /api/cron/sync-fixture after deploy to load matches');
    }
  } else {
    console.warn('  ⚠ FOOTBALL_API_KEY not set — skipping fixture import');
  }

  let teams = 0, matches = 0;
  type ApiMatch = { id: number; utcDate: string; status: string; stage: string; group: string | null; venue: string; homeTeam: { tla: string; name: string } | null; awayTeam: { tla: string; name: string } | null };
  for (const m of matchData as ApiMatch[]) {
    const home = m.homeTeam;
    const away = m.awayTeam;

    if (home?.tla && home?.name) {
      await db.team.upsert({
        where:  { id: home.tla },
        create: { id: home.tla, name: home.name, group: m.group ?? 'A', flag: countryFlag(home.tla) },
        update: { name: home.name },
      });
      teams++;
    }
    if (away?.tla && away?.name) {
      await db.team.upsert({
        where:  { id: away.tla },
        create: { id: away.tla, name: away.name, group: m.group ?? 'A', flag: countryFlag(away.tla) },
        update: { name: away.name },
      });
      teams++;
    }

    await db.match.upsert({
      where:  { externalId: String(m.id) },
      create: {
        externalId: String(m.id),
        homeTeamId: home?.tla ?? null,
        awayTeamId: away?.tla ?? null,
        kickoff:    new Date(m.utcDate),
        stage:      mapStage(m.stage),
        group:      m.group ?? null,
        venueCity:  m.venue ?? '',
        status:     mapStatus(m.status),
      },
      update: {},
    });
    matches++;
  }

  console.log(`✓ ${teams} teams upserted`);
  console.log(`✓ ${matches} matches upserted`);
  console.log('Seed complete.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
