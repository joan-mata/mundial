import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { stageLabel } from '@/lib/utils';

export const revalidate = 300;

export default async function UserPredictionsPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId: targetId } = await params;
  const session = await auth();

  const [targetUser, teams, allPredictions, allUsers] = await Promise.all([
    db.user.findUnique({
      where: { id: targetId, active: true, role: 'USER' },
      select: { id: true, name: true, favoriteTeam: true },
    }),
    db.team.findMany({ select: { id: true, name: true, flag: true } }),
    db.prediction.findMany({
      where: { userId: targetId },
      include: {
        match: {
          select: {
            id: true, homeTeamId: true, awayTeamId: true,
            homeLabel: true, awayLabel: true,
            homeScore: true, awayScore: true,
            kickoff: true, stage: true, group: true, status: true,
          },
        },
      },
      orderBy: { match: { kickoff: 'asc' } },
    }),
    db.user.findMany({
      where: { active: true, role: 'USER' },
      include: {
        predictions: { where: { points: { not: null } } },
        extraBets:   { where: { resolved: true } },
      },
    }),
  ]);

  if (!targetUser) notFound();

  const teamMap  = new Map(teams.map(t => [t.id, t]));
  const isMe     = session!.user.id === targetId;

  // Compute leaderboard rank
  const scores = allUsers.map(u => ({
    id:    u.id,
    total: u.predictions.reduce((s, p) => s + (p.points ?? 0), 0) +
           u.extraBets.reduce((s, e) => s + (e.points ?? 0), 0),
  })).sort((a, b) => b.total - a.total);
  const rank      = scores.findIndex(s => s.id === targetId) + 1;
  const myScore   = scores.find(s => s.id === targetId)?.total ?? 0;

  const resolved  = allPredictions.filter(p => p.points !== null);
  const pending   = allPredictions.filter(p => p.points === null);

  const exact     = resolved.filter(p => p.basePoints === 3).length;
  const winner    = resolved.filter(p => (p.basePoints ?? 0) >= 1 && p.basePoints !== 3).length;
  const zeroPts   = resolved.filter(p => p.points === 0).length;
  const koPts     = resolved.reduce((s, p) => s + (p.knockoutPoints ?? 0), 0);
  const closePts  = resolved.reduce((s, p) => s + (p.closestBonus ?? 0), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors w-fit">
        ← Clasificación
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {targetUser.name}
            {targetUser.favoriteTeam && <span>{targetUser.favoriteTeam}</span>}
            {isMe && <Badge variant="secondary">Tú</Badge>}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {rank > 0 ? `Nº${rank} · ` : ''}{myScore} pts
          </p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 font-medium">{exact} exactos</span>
        <span className="px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-600 font-medium">{winner} ganadores</span>
        {koPts > 0   && <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 font-medium">+{koPts} KO</span>}
        {closePts > 0 && <span className="px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-500 font-medium">+{closePts} cerca</span>}
        <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{zeroPts} sin puntos</span>
        {pending.length > 0 && <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{pending.length} pendientes</span>}
      </div>

      {/* Predictions list */}
      {resolved.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Aún no hay predicciones resueltas.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden divide-y">
          {resolved.map(pred => {
            const m        = pred.match;
            const homeTeam = teamMap.get(m.homeTeamId ?? '');
            const awayTeam = teamMap.get(m.awayTeamId ?? '');
            const homeName = homeTeam?.name ?? m.homeTeamId ?? m.homeLabel ?? 'TBC';
            const awayName = awayTeam?.name ?? m.awayTeamId ?? m.awayLabel ?? 'TBC';
            const homeFlag = homeTeam?.flag ?? '';
            const awayFlag = awayTeam?.flag ?? '';
            const pts      = pred.points ?? 0;
            const ptColor  = pts >= 3 ? 'text-green-600' : pts >= 1 ? 'text-yellow-600' : 'text-muted-foreground';

            return (
              <Link key={pred.id} href={`/matches/${m.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors">
                {/* Teams + result */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {homeFlag} {homeName} {m.homeScore}–{m.awayScore} {awayName} {awayFlag}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <span>{stageLabel(m.stage)}</span>
                    <span className="opacity-40">·</span>
                    <span>Tu predicción: {pred.homeScore}–{pred.awayScore}</span>
                    {(pred.knockoutPoints ?? 0) > 0 && (
                      <><span className="opacity-40">·</span><span className="text-blue-600">+{pred.knockoutPoints} KO</span></>
                    )}
                    {(pred.closestBonus ?? 0) > 0 && (
                      <><span className="opacity-40">·</span><span className="text-orange-500">+{pred.closestBonus} cerca</span></>
                    )}
                  </div>
                </div>
                {/* Points */}
                <span className={`shrink-0 text-xl font-bold tabular-nums ${ptColor}`}>
                  {pts > 0 ? `+${pts}` : '0'}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
