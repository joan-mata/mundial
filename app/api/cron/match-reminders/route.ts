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
  const in65   = new Date(now.getTime() + 65 * 60 * 1000);

  // Cubre ventana 1h-antes y ventana kickoff
  const upcomingMatches = await db.match.findMany({
    where: {
      status:     { in: ['SCHEDULED', 'LIVE'] },
      kickoff:    { gte: new Date(now.getTime() - 5 * 60 * 1000), lte: in65 },
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

    // Ventana ~1h: 57-61 min (4 min < cron de 5 min → dispara una sola vez)
    const isOneHour = minutesLeft >= 57 && minutesLeft <= 61;
    // Ventana kickoff: 0-4 min
    const isKickoff = minutesLeft >= 0 && minutesLeft <= 4;

    if (!isOneHour && !isKickoff) continue;

    const homeTeam = teamMap.get(match.homeTeamId!);
    const awayTeam = teamMap.get(match.awayTeamId!);
    const homeName = homeTeam?.name ?? match.homeTeamId!;
    const awayName = awayTeam?.name ?? match.awayTeamId!;
    const homeFlag = homeTeam?.flag ?? '';
    const awayFlag = awayTeam?.flag ?? '';

    for (const user of users) {
      const hasPred = predSet.has(`${user.id}:${match.id}`);

      if (isOneHour && !hasPred) {
        await remindBeforeKickoff(user.telegramChatId!, user.telegramToken!, {
          homeTeam:    homeName,
          awayTeam:    awayName,
          minutesLeft: minutesLeft,
          kickoff:     match.kickoff,
        }).catch(e => console.error('[match-reminders] remind:', e));
        sent++;
      } else if (isKickoff && hasPred) {
        await announceMatchKickoff(user.telegramChatId!, user.telegramToken!, {
          homeTeam: homeName, awayTeam: awayName, homeFlag, awayFlag,
        }).catch(e => console.error('[match-reminders] kickoff:', e));
        sent++;
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
