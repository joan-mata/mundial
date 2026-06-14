export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { remindBeforeKickoff, announceMatchKickoff } from '@/lib/telegram';
import { NextResponse } from 'next/server';
import { checkCronSecret } from '@/lib/cron-auth';


export async function POST(req: Request) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now    = new Date();
  const in75   = new Date(now.getTime() + 75 * 60 * 1000);

  // Partidos SCHEDULED o LIVE cuyo kickoff está en los próximos 75 min
  // LIVE se incluye porque sync-results puede actualizar el status antes que este cron
  const upcomingMatches = await db.match.findMany({
    where: {
      status:     { in: ['SCHEDULED', 'LIVE'] },
      kickoff:    { gte: now, lte: in75 },
      homeTeamId: { not: null },
      awayTeamId: { not: null },
    },
  });

  if (upcomingMatches.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const users = await db.user.findMany({
    where: { active: true, telegramChatId: { not: null }, telegramToken: { not: null } },
    select: { id: true, telegramChatId: true, telegramToken: true },
  });

  if (users.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // Pre-fetch predicciones para estos partidos
  const matchIds = upcomingMatches.map(m => m.id);
  const preds = await db.prediction.findMany({
    where: { matchId: { in: matchIds } },
    select: { userId: true, matchId: true },
  });
  const predSet = new Set(preds.map(p => `${p.userId}:${p.matchId}`));

  // Pre-fetch team names
  const matchTeamIds = upcomingMatches.flatMap(m => [m.homeTeamId!, m.awayTeamId!]).filter(Boolean);
  const teams = await db.team.findMany({
    where: { id: { in: matchTeamIds } },
    select: { id: true, name: true, flag: true },
  });
  const teamMap = new Map(teams.map(t => [t.id, t]));

  let sent = 0;
  for (const match of upcomingMatches) {
    const minutesLeft = Math.round((match.kickoff.getTime() - now.getTime()) / 60000);

    // Ventana "1h antes": 55-65 min
    const isOneHour = minutesLeft >= 55 && minutesLeft <= 65;
    // Ventana "inicio": 0-5 min
    const isKickoff = minutesLeft >= 0 && minutesLeft <= 5;

    if (!isOneHour && !isKickoff) continue;

    const homeTeam = teamMap.get(match.homeTeamId!);
    const awayTeam = teamMap.get(match.awayTeamId!);
    const homeName = homeTeam?.name ?? match.homeTeamId!;
    const awayName = awayTeam?.name ?? match.awayTeamId!;
    const homeFlag = homeTeam?.flag ?? '';
    const awayFlag = awayTeam?.flag ?? '';

    for (const user of users) {
      const hasPred = predSet.has(`${user.id}:${match.id}`);

      if (isKickoff) {
        // Announce kickoff to ALL users
        await announceMatchKickoff(user.telegramChatId!, user.telegramToken!, {
          homeTeam: homeName, awayTeam: awayName, homeFlag, awayFlag,
        }).catch(e => console.error('[match-reminders] announce:', e));
        sent++;
      } else if (isOneHour && !hasPred) {
        // Remind only users who haven't predicted yet
        await remindBeforeKickoff(user.telegramChatId!, user.telegramToken!, {
          homeTeam:    homeName,
          awayTeam:    awayName,
          minutesLeft: minutesLeft,
          kickoff:     match.kickoff,
        }).catch(e => console.error('[match-reminders] remind:', e));
        sent++;
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
