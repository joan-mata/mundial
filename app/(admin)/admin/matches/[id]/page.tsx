import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { formatKickoff, stageLabel, methodLabel } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResultForm } from '@/components/admin/result-form';
import { ExtensionPanel } from '@/components/admin/extension-panel';
import { SeedLabelForm } from '@/components/admin/seed-label-form';

export default async function AdminMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await auth();

  const match = await db.match.findUnique({ where: { id } });
  if (!match) notFound();

  const [users, extensions, predictions] = await Promise.all([
    db.user.findMany({ where: { active: true, role: 'USER' }, select: { id: true, name: true } }),
    db.predictionExtension.findMany({
      where: { matchId: id },
      include: { user: { select: { name: true } } },
    }),
    db.prediction.findMany({
      where: { matchId: id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const isKnockout = match.stage !== 'GROUP';

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <p className="text-sm text-muted-foreground">{stageLabel(match.stage)}{match.group ? ` · Grupo ${match.group}` : ''}</p>
        <h1 className="text-2xl font-bold">{match.homeTeamId ?? '?'} vs {match.awayTeamId ?? '?'}</h1>
        <p className="text-muted-foreground">{formatKickoff(match.kickoff)} · {match.venueCity}</p>
        <div className="flex gap-2 mt-2">
          <Badge variant={match.status === 'FINISHED' ? 'success' : match.status === 'LIVE' ? 'destructive' : 'outline'}>
            {match.status}
          </Badge>
          {match.resolved && <Badge variant="secondary">Puntos calculados</Badge>}
        </div>
      </div>

      {/* Resultado */}
      <ResultForm
        matchId={id}
        current={{
          homeScore:       match.homeScore,
          awayScore:       match.awayScore,
          status:          match.status,
          knockoutWinnerId: match.knockoutWinnerId,
          knockoutMethod:  match.knockoutMethod,
          etHomeScore:     match.etHomeScore,
          etAwayScore:     match.etAwayScore,
        }}
        isKnockout={isKnockout}
        homeTeamId={match.homeTeamId}
        awayTeamId={match.awayTeamId}
      />

      {/* Etiqueta de siembra (solo eliminatorias) */}
      {isKnockout && (
        <SeedLabelForm
          matchId={id}
          homeLabel={match.homeLabel}
          awayLabel={match.awayLabel}
        />
      )}

      {/* Prórrogas */}
      <ExtensionPanel
        matchId={id}
        kickoff={match.kickoff.toISOString()}
        users={users}
        extensions={extensions.map(e => ({
          id: e.id,
          userId: e.userId,
          userName: e.user?.name ?? 'Todos',
          newDeadline: e.newDeadline.toISOString(),
          reason: e.reason,
          createdAt: e.createdAt.toISOString(),
        }))}
      />

      {/* Predicciones recibidas */}
      <Card>
        <CardHeader><CardTitle className="text-base">Predicciones recibidas ({predictions.length})</CardTitle></CardHeader>
        <CardContent>
          {predictions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguna predicción aún</p>
          ) : (
            <div className="divide-y text-sm">
              {predictions.map(p => {
                const ext = extensions.find(e => e.userId === p.userId);
                return (
                  <div key={p.id} className="py-2 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-medium">{p.user.name}</span>
                      {ext && <Badge variant="warning" className="ml-2 text-xs">Con prórroga</Badge>}
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold">{p.homeScore}–{p.awayScore}</div>
                      {p.knockoutWinnerId && (
                        <div className="text-xs text-muted-foreground">
                          Avance: {p.knockoutWinnerId} {p.knockoutMethod ? `(${methodLabel(p.knockoutMethod)})` : ''}
                        </div>
                      )}
                      {p.points !== null ? (
                        <div className="text-xs">
                          <span className={p.basePoints === 3 ? 'text-green-600 font-bold' : p.basePoints === 1 ? 'text-yellow-600' : 'text-muted-foreground'}>
                            {p.points} pts
                          </span>
                          {(p.knockoutPoints ?? 0) > 0 && <span className="text-blue-600 ml-1">(+{p.knockoutPoints} KO)</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin resolver</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
