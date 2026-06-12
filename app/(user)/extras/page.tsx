import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExtraBetForm } from '@/components/extra-bet-form';
import { TeamPickForm } from '@/components/team-pick-form';

export const revalidate = 60;

const BET_META = {
  WORLD_CUP_WINNER: { label: 'Campeón del Mundial', hint: 'Escribe el código del equipo (ej: ESP)' },
  TOP_SCORER:       { label: 'Máximo goleador',     hint: 'Nombre del jugador' },
  BEST_GOALKEEPER:  { label: 'Mejor portero',       hint: 'Nombre del jugador' },
};

const FIXED_KEYS = Object.keys(BET_META) as (keyof typeof BET_META)[];

type FinishedMatch = {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore:  number | null;
  awayScore:  number | null;
  stage:      string;
  knockoutWinnerId: string | null;
};

type TeamStats = { pts: number; wins: number; draws: number; rounds: number; gf: number; total: number };

function computeTeamStats(teamId: string, matches: FinishedMatch[]): TeamStats {
  let pts = 0, wins = 0, draws = 0, rounds = 0, gf = 0;
  for (const m of matches) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const isHome = m.homeTeamId === teamId;
    const isAway = m.awayTeamId === teamId;
    if (!isHome && !isAway) continue;

    const scored   = isHome ? m.homeScore : m.awayScore;
    const conceded = isHome ? m.awayScore : m.homeScore;
    gf += scored;

    if (scored > conceded)        { pts += 3; wins++; }
    else if (scored === conceded) { pts += 1; draws++; }

    if (m.stage !== 'GROUP' && m.knockoutWinnerId === teamId) rounds++;
  }
  return { pts, wins, draws, rounds, gf, total: pts + rounds };
}

export default async function ExtrasPage() {
  const session = await auth();
  const userId  = session!.user.id;
  const isAdmin = session!.user.role === 'ADMIN';

  const settings = await db.setting.findMany();
  const sm       = new Map(settings.map(s => [s.key, s.value]));

  const deadlineStr  = sm.get('extra_bet_deadline') ?? '2026-07-19T21:00:00Z';
  const deadline     = new Date(deadlineStr);
  const deadlinePast = new Date() >= deadline;

  const myBets = isAdmin ? [] : await db.extraBet.findMany({ where: { userId } });
  const myBetMap = new Map(myBets.map(b => [b.type, b]));

  const [allBets, allUsers, contestsRaw, allTeams, allPickEntries, finishedMatches] = await Promise.all([
    db.extraBet.findMany({
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
    db.user.findMany({ where: { active: true, role: 'USER' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.teamPickContest.findMany({ orderBy: { createdAt: 'asc' } }),
    db.team.findMany({ select: { id: true, name: true, flag: true }, orderBy: { name: 'asc' } }),
    db.teamPickEntry.findMany({ include: { user: { select: { id: true, name: true } } } }),
    db.match.findMany({
      where: { status: 'FINISHED' },
      select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, stage: true, knockoutWinnerId: true },
    }),
  ]);

  // Build unified ordered list (fixed bets + contests, sorted by contest_order setting)
  const storedOrder: string[] = JSON.parse(sm.get('contest_order') ?? '[]');
  const allIds = [
    ...storedOrder,
    ...FIXED_KEYS.filter(k => !storedOrder.includes(k)),
    ...contestsRaw.map(c => c.id).filter(id => !storedOrder.includes(id)),
  ];
  type UnifiedItem =
    | { kind: 'fixed'; id: keyof typeof BET_META }
    | { kind: 'contest'; contest: typeof contestsRaw[0] };
  const unifiedItems: UnifiedItem[] = [];
  for (const id of allIds) {
    if ((FIXED_KEYS as string[]).includes(id)) { unifiedItems.push({ kind: 'fixed', id: id as keyof typeof BET_META }); continue; }
    const c = contestsRaw.find(x => x.id === id);
    if (c) unifiedItems.push({ kind: 'contest', contest: c });
  }

  const myPickMap = new Map(allPickEntries.filter(e => e.userId === userId).map(e => [e.contestId, { teamIds: e.teamIds, points: e.points }]));
  const teamMap   = new Map(allTeams.map(t => [t.id, t]));

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Apuestas extra</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {deadlinePast
            ? 'Plazo cerrado automáticamente.'
            : `Plazo hasta el ${deadline.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}`}
        </p>
      </div>

      <div className="grid gap-6">
        {unifiedItems.map(item => {
          if (item.kind === 'fixed') {
            const type     = item.id;
            const info     = BET_META[type];
            const pts      = Number(sm.get(`extra_pts_${type}`) ?? 10);
            const typeOpen = sm.get(`extra_open_${type}`) !== 'false';
            const canBet   = !isAdmin && typeOpen && !deadlinePast;
            const myBet    = myBetMap.get(type);
            const typeBets = allBets.filter(b => b.type === type);
            const canSeeOthers = isAdmin || !!myBet || !typeOpen || deadlinePast;

            return (
              <Card key={type}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{info.label}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">+{pts} pts</Badge>
                      {!isAdmin && (typeOpen && !deadlinePast
                        ? <Badge variant="outline" className="text-green-600 border-green-600">Abierta</Badge>
                        : <Badge variant="outline">Cerrada</Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription>{info.hint}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isAdmin && (
                    <div>
                      {myBet?.resolved ? (
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{myBet.value}</span>
                          <span className={`font-bold ${(myBet.points ?? 0) > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {(myBet.points ?? 0) > 0 ? `+${myBet.points} pts` : '0 pts'}
                          </span>
                        </div>
                      ) : myBet && !canBet ? (
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{myBet.value}</span>
                          <Badge variant="outline">Pendiente de resolución</Badge>
                        </div>
                      ) : null}
                      {canBet && !myBet?.resolved && (
                        <ExtraBetForm type={type} existing={myBet?.value} />
                      )}
                    </div>
                  )}

                  {canSeeOthers ? (
                    <div className="border-t pt-3 space-y-1">
                      <p className="text-xs text-muted-foreground mb-2">{typeBets.length}/{allUsers.length} han apostado</p>
                      <div className="divide-y text-sm">
                        {allUsers.map(u => {
                          const bet  = typeBets.find(b => b.userId === u.id);
                          const isMe = u.id === userId;
                          return (
                            <div key={u.id} className={`flex items-center justify-between py-1.5 ${isMe ? 'font-medium' : ''}`}>
                              <span>{u.name}{isMe && ' (tú)'}</span>
                              {bet ? (
                                <span className="flex items-center gap-2">
                                  <span>{bet.value}</span>
                                  {bet.resolved && (
                                    <span className={`text-xs font-bold ${(bet.points ?? 0) > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                                      {(bet.points ?? 0) > 0 ? `+${bet.points}pts` : '0pts'}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Sin apuesta</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="border-t pt-3">
                      <p className="text-sm text-muted-foreground">Haz tu apuesta para ver la de los demás.</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {allUsers.map(u => (
                          <Badge key={u.id} variant={typeBets.some(b => b.userId === u.id) ? 'secondary' : 'outline'} className="text-xs">
                            {u.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          }

          // Contest card
          const contest        = item.contest;
          const teamOptions    = contest.teamIds.map(tid => {
            const t = teamMap.get(tid);
            return { value: tid, label: t ? `${t.flag} ${t.name}` : tid };
          });
          const myPick         = myPickMap.get(contest.id) ?? null;
          const contestEntries = allPickEntries.filter(e => e.contestId === contest.id);
          const myEntry        = contestEntries.find(e => e.userId === userId);
          const canSeeAll      = isAdmin || !!myEntry || !contest.open || contest.resolved;

          type Standing = { userId: string; userName: string; teamIds: string[]; stats: TeamStats };
          const standings: Standing[] = contestEntries.map(e => {
            const combinedStats = e.teamIds.reduce<TeamStats>(
              (acc, tid) => {
                const s = computeTeamStats(tid, finishedMatches);
                return {
                  pts:    acc.pts    + s.pts,
                  wins:   acc.wins   + s.wins,
                  draws:  acc.draws  + s.draws,
                  rounds: acc.rounds + s.rounds,
                  gf:     acc.gf     + s.gf,
                  total:  acc.total  + s.total,
                };
              },
              { pts: 0, wins: 0, draws: 0, rounds: 0, gf: 0, total: 0 }
            );
            return { userId: e.userId, userName: e.user.name, teamIds: e.teamIds, stats: combinedStats };
          }).sort((a, b) =>
            b.stats.total - a.stats.total ||
            b.stats.rounds - a.stats.rounds ||
            b.stats.gf - a.stats.gf
          );

          return (
            <Card key={contest.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{contest.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">+{contest.pts} pts al ganador</Badge>
                    {contest.resolved
                      ? <Badge className="bg-green-600">Resuelto</Badge>
                      : contest.open
                        ? <Badge variant="outline" className="text-green-600 border-green-600">Abierto</Badge>
                        : <Badge variant="outline">Cerrado</Badge>
                    }
                  </div>
                </div>
                <CardDescription>
                  El equipo con más puntos al final del torneo gana. Victoria +3 · Empate +1 · Pasar ronda +1
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isAdmin && (
                  <TeamPickForm
                    contest={contest}
                    teamOptions={teamOptions}
                    initialPick={myPick ?? null}
                    userId={userId}
                  />
                )}

                {canSeeAll && standings.length > 0 ? (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">{contestEntries.length}/{allUsers.length} han seleccionado</p>
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2 text-left">#</th>
                            <th className="px-3 py-2 text-left">Jugador</th>
                            <th className="px-3 py-2 text-left">Equipo(s)</th>
                            <th className="px-2 py-2 text-center" title="Victorias">V</th>
                            <th className="px-2 py-2 text-center" title="Empates">E</th>
                            <th className="px-2 py-2 text-center" title="Rondas superadas">R</th>
                            <th className="px-2 py-2 text-center" title="Goles a favor">GF</th>
                            <th className="px-2 py-2 text-center font-bold" title="Pts partido + rondas">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {standings.map((s, i) => {
                            const isMe     = s.userId === userId;
                            const isWinner = contest.resolved && i === 0;
                            return (
                              <tr key={s.userId} className={`${isMe ? 'bg-primary/5 font-medium' : ''} ${isWinner ? 'bg-green-50 dark:bg-green-950/20' : ''}`}>
                                <td className="px-3 py-2 text-muted-foreground">{isWinner ? '🏆' : i + 1}</td>
                                <td className="px-3 py-2">{s.userName}{isMe && ' (tú)'}</td>
                                <td className="px-3 py-2">
                                  {s.teamIds.map(tid => { const t = teamMap.get(tid); return t ? `${t.flag} ${t.name}` : tid; }).join(' + ')}
                                </td>
                                <td className="px-2 py-2 text-center text-green-600">{s.stats.wins || '—'}</td>
                                <td className="px-2 py-2 text-center text-yellow-600">{s.stats.draws || '—'}</td>
                                <td className="px-2 py-2 text-center text-blue-600">{s.stats.rounds || '—'}</td>
                                <td className="px-2 py-2 text-center">{s.stats.gf || '—'}</td>
                                <td className="px-2 py-2 text-center font-bold">{s.stats.total}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : !canSeeAll ? (
                  <div className="border-t pt-3">
                    <p className="text-sm text-muted-foreground">Selecciona tu equipo para ver la clasificación.</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {allUsers.map(u => (
                        <Badge key={u.id} variant={contestEntries.some(e => e.userId === u.id) ? 'secondary' : 'outline'} className="text-xs">
                          {u.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
