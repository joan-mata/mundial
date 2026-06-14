export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { fetchMatch, mapStatus, parseTeamLabel, countryFlag } from '@/lib/football-api';
import { resolveMatch } from '@/lib/recalculate';
import { NextResponse } from 'next/server';
import type { KnockoutMethod } from '@prisma/client';
import { checkCronSecret } from '@/lib/cron-auth';
import { revalidatePath } from 'next/cache';
import { notifyMatchFinished } from '@/lib/telegram';


async function sendMatchNotifications(matchId: string) {
  const m = await db.match.findUnique({
    where: { id: matchId },
    include: {
      predictions: {
        include: { user: { select: { id: true, telegramChatId: true, telegramToken: true } } },
      },
    },
  });
  if (!m || m.homeScore === null || m.awayScore === null) return;

  const homeName = m.homeTeamId ?? m.homeLabel ?? 'Local';
  const awayName = m.awayTeamId ?? m.awayLabel ?? 'Visitante';

  for (const pred of m.predictions) {
    if (!pred.user.telegramChatId || !pred.user.telegramToken || pred.points === null) continue;
    const agg = await db.prediction.aggregate({
      where: { userId: pred.user.id, points: { not: null } },
      _sum: { points: true },
    });
    await notifyMatchFinished(pred.user.telegramChatId, pred.user.telegramToken, {
      homeTeam:      homeName,
      awayTeam:      awayName,
      homeScore:     m.homeScore,
      awayScore:     m.awayScore,
      predHomeScore: pred.homeScore,
      predAwayScore: pred.awayScore,
      pointsEarned:  pred.points,
      totalPoints:   agg._sum.points ?? 0,
    }).catch(e => console.error('[sync-results] telegram notify:', e));
  }
}

export async function POST(req: Request) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now       = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);

  // Normal window: SCHEDULED/LIVE matches from the last 24h
  // Extra: FINISHED+unresolved with null scores (API delayed the result on first sync)
  const matches = await db.match.findMany({
    where: {
      externalId: { not: null },
      OR: [
        { status: { in: ['SCHEDULED', 'LIVE'] }, kickoff: { gte: yesterday, lte: now } },
        { status: 'FINISHED', homeScore: null,      resolved: false },
        { status: 'FINISHED', homeScore: { not: null }, resolved: false },
      ],
    },
  });

  let resolved = 0;

  for (const match of matches) {
    if (!match.externalId) continue;
    if (!/^\d+$/.test(match.externalId)) continue;

    // Fast path: already have scores, just resolve without hitting the API
    if (match.status === 'FINISHED' && match.homeScore !== null && match.awayScore !== null && !match.resolved) {
      try {
        await resolveMatch(match.id);
        await sendMatchNotifications(match.id);
        resolved++;
      } catch (e) {
        console.error(`[sync-results] resolve fast-path ${match.id}:`, e);
      }
      continue;
    }

    try {
      const data      = await fetchMatch(match.externalId);
      const newStatus = mapStatus(data.status);

      const homeScore = data.score?.fullTime?.home ?? null;
      const awayScore = data.score?.fullTime?.away ?? null;

      // ── Knockout data (prórroga / penaltis) ──────────────────────────────
      const isKnockout = match.stage !== 'GROUP';
      let knockoutWinnerId: string | null = match.knockoutWinnerId;
      let knockoutMethod:   KnockoutMethod | null = match.knockoutMethod;
      let etHomeScore: number | null = match.etHomeScore;
      let etAwayScore: number | null = match.etAwayScore;

      if (isKnockout && newStatus === 'FINISHED' && homeScore !== null && awayScore !== null) {
        const winner   = data.score?.winner;   // "HOME_TEAM" | "AWAY_TEAM" | "DRAW"
        const duration = data.score?.duration; // "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT"

        if (winner === 'HOME_TEAM') knockoutWinnerId = match.homeTeamId;
        else if (winner === 'AWAY_TEAM') knockoutWinnerId = match.awayTeamId;

        if (duration === 'EXTRA_TIME') {
          knockoutMethod = 'EXTRA_TIME';
          etHomeScore    = data.score?.extraTime?.home ?? null;
          etAwayScore    = data.score?.extraTime?.away ?? null;
        } else if (duration === 'PENALTY_SHOOTOUT') {
          knockoutMethod = 'PENALTIES';
          etHomeScore    = data.score?.extraTime?.home ?? null;
          etAwayScore    = data.score?.extraTime?.away ?? null;
        } else {
          knockoutMethod = null; // decidido en tiempo reglamentario
          etHomeScore    = null;
          etAwayScore    = null;
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      // Capture team IDs when API resolves TBC slots; capture labels when still TBC
      const apiHomeId  = data.homeTeam?.tla ?? null;
      const apiAwayId  = data.awayTeam?.tla ?? null;
      const newHomeId  = apiHomeId ?? match.homeTeamId;
      const newAwayId  = apiAwayId ?? match.awayTeamId;
      const homeLabel  = apiHomeId ? null : (parseTeamLabel(data.homeTeam?.name) ?? match.homeLabel);
      const awayLabel  = apiAwayId ? null : (parseTeamLabel(data.awayTeam?.name) ?? match.awayLabel);

      // Upsert new team rows when resolved by API
      if (apiHomeId && !match.homeTeamId) {
        await db.team.upsert({
          where: { id: apiHomeId },
          create: { id: apiHomeId, name: data.homeTeam.name ?? apiHomeId, group: 'A', flag: countryFlag(apiHomeId) },
          update: {},
        });
      }
      if (apiAwayId && !match.awayTeamId) {
        await db.team.upsert({
          where: { id: apiAwayId },
          create: { id: apiAwayId, name: data.awayTeam.name ?? apiAwayId, group: 'A', flag: countryFlag(apiAwayId) },
          update: {},
        });
      }

      await db.match.update({
        where: { id: match.id },
        data: {
          status: newStatus,
          homeScore,
          awayScore,
          homeTeamId: newHomeId,
          awayTeamId: newAwayId,
          homeLabel,
          awayLabel,
          ...(isKnockout && newStatus === 'FINISHED' && homeScore !== null
            ? { knockoutWinnerId: knockoutWinnerId ?? newHomeId, knockoutMethod, etHomeScore, etAwayScore }
            : {}),
        },
      });

      if (newStatus === 'FINISHED' && homeScore !== null && awayScore !== null && !match.resolved) {
        await resolveMatch(match.id);
        await sendMatchNotifications(match.id);
        resolved++;
        revalidatePath('/dashboard');
      }
    } catch (e) {
      console.error(`[sync-results] match ${match.id}:`, e);
    }
  }

  // After resolving matches, trigger sync-events for remaining live/pending matches
  if (resolved > 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    fetch(`${appUrl}/api/cron/sync-events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    }).catch(e => console.error('[sync-results] trigger sync-events:', e));
  }

  return NextResponse.json({ ok: true, checked: matches.length, resolved });
}
