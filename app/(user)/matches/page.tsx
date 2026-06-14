import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatKickoff, stageLabel } from '@/lib/utils';
import { pixelBackground } from '@/lib/flag-colors';
import { ScrollToToday } from '@/components/scroll-to-today';
import { LiveMinute } from '@/components/live-minute';

export const revalidate = 60;

export default async function MatchesPage() {
  const session = await auth();
  const userId  = session!.user.id;
  const isAdmin = session!.user.role === 'ADMIN';

  const [matches, teams, predictions] = await Promise.all([
    db.match.findMany({ orderBy: { kickoff: 'asc' } }),
    db.team.findMany({ select: { id: true, flag: true, name: true } }),
    isAdmin ? Promise.resolve([]) : db.prediction.findMany({
      where: { userId },
      select: { matchId: true, homeScore: true, awayScore: true, points: true, basePoints: true },
    }),
  ]);

  const teamMap  = new Map(teams.map(t => [t.id, t]));
  const predMap  = new Map(predictions.map(p => [p.matchId, p]));

  const byDate = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = m.kickoff.toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(m);
  }

  return (
    <div className="space-y-8">
      <ScrollToToday />
      <h1 className="text-2xl font-bold">Partidos</h1>

      {Array.from(byDate.entries()).map(([date, dayMatches]) => (
        <div key={date} id={date}>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">
            {new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {dayMatches.map(match => {
              const pred     = predMap.get(match.id);
              const now      = new Date();
              const deadline = new Date(match.kickoff.getTime() - 60_000);
              const isOpen   = !isAdmin && now < deadline && match.status === 'SCHEDULED';
              const isLive   = match.status === 'LIVE';
              const isDone   = match.status === 'FINISHED';
              const homeTeam = teamMap.get(match.homeTeamId ?? '');
              const awayTeam = teamMap.get(match.awayTeamId ?? '');
              const bgStyle  = pixelBackground(match.homeTeamId, match.awayTeamId);

              const predColor = pred && pred.points !== null
                ? pred.points >= 3 ? 'text-green-600'
                : pred.points >= 1 ? 'text-yellow-600'
                : 'text-muted-foreground'
                : 'text-muted-foreground';

              return (
                <Link key={match.id} href={`/matches/${match.id}`}>
                  <Card
                    className={`p-0 overflow-hidden hover:border-primary/40 hover:shadow-md transition-all cursor-pointer h-full ${isLive ? 'border-red-400/60' : ''}`}
                    style={bgStyle}
                  >
                    {/* Status bar */}
                    <div className={`h-0.5 w-full ${isDone ? 'bg-green-500/30' : isLive ? 'bg-red-500' : 'bg-transparent'}`} />

                    <div className="px-3 pt-2 pb-3">
                      {/* Top row: stage + time */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {stageLabel(match.stage)}
                          {match.group && ` · G.${match.group.replace(/^GROUP_/, '')}`}
                        </span>
                        {isLive
                          ? <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                              <LiveMinute kickoff={match.kickoff} />
                            </div>
                          : <span className="tabular-nums text-sm font-bold text-foreground">
                              {match.kickoff.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })}h
                            </span>
                        }
                      </div>

                      {/* Teams + score */}
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        {/* Home */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          {homeTeam?.flag && <span className="text-lg shrink-0 leading-none">{homeTeam.flag}</span>}
                          <span className="font-semibold text-sm truncate leading-tight">
                            {homeTeam?.name ?? match.homeTeamId ?? 'TBC'}
                          </span>
                        </div>

                        {/* Score */}
                        <div className="px-1 text-center shrink-0 w-14">
                          {isDone || isLive ? (
                            <span className={`font-black text-xl tabular-nums tracking-tight ${isLive ? 'text-red-500' : ''}`}>
                              {match.homeScore ?? 0}–{match.awayScore ?? 0}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 text-sm font-medium">vs</span>
                          )}
                        </div>

                        {/* Away */}
                        <div className="flex items-center gap-1.5 min-w-0 justify-end">
                          <span className="font-semibold text-sm truncate leading-tight text-right">
                            {awayTeam?.name ?? match.awayTeamId ?? 'TBC'}
                          </span>
                          {awayTeam?.flag && <span className="text-lg shrink-0 leading-none">{awayTeam.flag}</span>}
                        </div>
                      </div>

                      {/* Prediction row */}
                      <div className="mt-2.5 min-h-[18px] text-xs text-center">
                        {pred ? (
                          <span className={predColor}>
                            Tu: {pred.homeScore}–{pred.awayScore}
                            {pred.points !== null && (
                              <span className="ml-1.5 font-semibold">{pred.points}pts</span>
                            )}
                          </span>
                        ) : isOpen ? (
                          <span className="text-orange-500 font-medium">⚠ Sin predicción</span>
                        ) : isDone ? (
                          <span className="text-muted-foreground/40">—</span>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {matches.length === 0 && (
        <p className="text-muted-foreground text-center py-12">No hay partidos cargados aún.</p>
      )}
    </div>
  );
}
