export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fetchAllMatches, mapStage, parseTeamLabel, countryFlag } from '@/lib/football-api';

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const data = await fetchAllMatches();
  const matches: unknown[] = data.matches ?? [];
  let updated = 0;

  for (const m of matches as Record<string, unknown>[]) {
    const externalId = String(m.id);
    const stage      = mapStage(m.stage as string);
    if (stage === 'GROUP') continue; // labels only needed for knockout

    const homeTla  = (m.homeTeam as Record<string, string>)?.tla ?? null;
    const awayTla  = (m.awayTeam as Record<string, string>)?.tla ?? null;
    const homeName = (m.homeTeam as Record<string, string>)?.name ?? null;
    const awayName = (m.awayTeam as Record<string, string>)?.name ?? null;

    const homeLabel = homeTla ? null : parseTeamLabel(homeName);
    const awayLabel = awayTla ? null : parseTeamLabel(awayName);

    const existing = await db.match.findFirst({ where: { externalId } });
    if (!existing) continue;

    // Upsert teams if tla is known
    for (const [tla, name] of [[homeTla, homeName], [awayTla, awayName]] as [string | null, string | null][]) {
      if (!tla) continue;
      await db.team.upsert({
        where: { id: tla },
        create: { id: tla, name: name ?? tla, group: 'X', flag: countryFlag(tla) },
        update: {},
      });
    }

    await db.match.update({
      where: { id: existing.id },
      data: {
        homeTeamId: homeTla ?? existing.homeTeamId,
        awayTeamId: awayTla ?? existing.awayTeamId,
        homeLabel: homeTla ? null : (homeLabel ?? existing.homeLabel),
        awayLabel: awayTla ? null : (awayLabel ?? existing.awayLabel),
      },
    });
    updated++;
  }

  return NextResponse.json({ ok: true, updated });
}
