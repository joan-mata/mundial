import { db } from '@/lib/db';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { stageLabel, formatKickoff } from '@/lib/utils';

export default async function AdminMatchesPage() {
  const matches = await db.match.findMany({ orderBy: { kickoff: 'asc' } });

  const byStage = matches.reduce<Record<string, typeof matches>>((acc, m) => {
    (acc[m.stage] ??= []).push(m);
    return acc;
  }, {});

  const stageOrder = ['GROUP', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER', 'SEMI', 'THIRD', 'FINAL'];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Partidos</h1>

      {stageOrder.map(stage => {
        const ms = byStage[stage];
        if (!ms?.length) return null;
        return (
          <div key={stage}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{stageLabel(stage)}</h2>
            <div className="grid gap-2">
              {ms.map(m => (
                <Link key={m.id} href={`/admin/matches/${m.id}`}>
                  <Card className="p-3 hover:border-primary/50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <div className="font-medium">{m.homeTeamId ?? '?'} vs {m.awayTeamId ?? '?'}</div>
                        <div className="text-xs text-muted-foreground">{formatKickoff(m.kickoff)} · {m.venueCity}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {m.homeScore !== null && (
                          <span className="font-mono font-bold">{m.homeScore}–{m.awayScore}</span>
                        )}
                        <Badge variant={
                          m.status === 'FINISHED' ? (m.resolved ? 'success' : 'warning') :
                          m.status === 'LIVE' ? 'destructive' :
                          m.status === 'POSTPONED' ? 'outline' : 'secondary'
                        } className="text-xs">
                          {m.status === 'FINISHED' ? (m.resolved ? '✓ OK' : '! Pendiente') : m.status}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      {matches.length === 0 && (
        <p className="text-muted-foreground text-center py-12">No hay partidos. Ejecuta el seed para cargarlos.</p>
      )}
    </div>
  );
}
