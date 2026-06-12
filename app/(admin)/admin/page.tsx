import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { RecalculateButton } from '@/components/admin/recalculate-button';
import { SyncButton } from '@/components/admin/sync-button';
import { ImportLabelsButton } from '@/components/admin/import-labels-button';

export default async function AdminPage() {
  const session = await auth();

  const [totalUsers, totalMatches, todayMatches, pendingMatches] = await Promise.all([
    db.user.count({ where: { active: true, role: 'USER' } }),
    db.match.count(),
    db.match.findMany({
      where: {
        kickoff: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt:  new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
      orderBy: { kickoff: 'asc' },
    }),
    db.match.count({ where: { status: 'FINISHED', resolved: false } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Panel de administración</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recálculo global */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recalcular todos los puntos</CardTitle>
            <CardDescription>
              Vuelve a calcular puntos para todos los partidos con resultado. Operación idempotente y segura.
              Útil si se corrigió un resultado manualmente.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between flex-wrap gap-4">
            {pendingMatches > 0 && (
              <Badge variant="warning">{pendingMatches} partidos finalizados sin resolver</Badge>
            )}
            <RecalculateButton />
          </CardContent>
        </Card>

        {/* Estado del sistema */}
        <Card>
          <CardHeader><CardTitle className="text-base">Estado del sistema</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Usuarios activos</span><strong>{totalUsers}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Partidos totales</span><strong>{totalMatches}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Partidos hoy</span><strong>{todayMatches.length}</strong></div>
            <div className="mt-4 pt-4 border-t">
              <SyncButton />
            </div>
            <div className="mt-2">
              <ImportLabelsButton />
            </div>
          </CardContent>
        </Card>

        {/* Partidos de hoy */}
        <Card>
          <CardHeader><CardTitle className="text-base">Partidos de hoy</CardTitle></CardHeader>
          <CardContent>
            {todayMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay partidos hoy</p>
            ) : (
              <div className="space-y-2">
                {todayMatches.map(m => (
                  <Link key={m.id} href={`/admin/matches/${m.id}`} className="flex items-center justify-between py-1 hover:text-primary transition-colors">
                    <span className="text-sm">{m.homeTeamId ?? '?'} vs {m.awayTeamId ?? '?'}</span>
                    <div className="flex items-center gap-2">
                      {m.homeScore !== null
                        ? <span className="font-mono font-bold">{m.homeScore}–{m.awayScore}</span>
                        : <span className="text-muted-foreground text-xs">Sin resultado</span>
                      }
                      <Badge variant={m.status === 'FINISHED' ? (m.resolved ? 'success' : 'warning') : m.status === 'LIVE' ? 'destructive' : 'outline'} className="text-xs">
                        {m.status === 'FINISHED' ? (m.resolved ? '✓' : 'Pendiente') : m.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Links rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: '/admin/users',   label: 'Usuarios',   icon: '👥' },
          { href: '/admin/matches', label: 'Partidos',   icon: '⚽' },
          { href: '/admin/extras',  label: 'Apuestas Extra', icon: '🏆' },
          { href: '/admin/audit',   label: 'Audit Log',  icon: '📋' },
        ].map(link => (
          <Link key={link.href} href={link.href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="pt-4 text-center">
                <div className="text-2xl mb-1">{link.icon}</div>
                <div className="text-sm font-medium">{link.label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
