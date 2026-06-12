'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { KnockoutMethod, MatchStatus } from '@prisma/client';

interface Props {
  matchId: string;
  current: {
    homeScore: number | null;
    awayScore: number | null;
    status: MatchStatus;
    knockoutWinnerId: string | null;
    knockoutMethod: KnockoutMethod | null;
    etHomeScore: number | null;
    etAwayScore: number | null;
  };
  isKnockout: boolean;
  homeTeamId: string | null;
  awayTeamId: string | null;
}

export function ResultForm({ matchId, current, isKnockout, homeTeamId, awayTeamId }: Props) {
  const { toast } = useToast();
  const router    = useRouter();

  const [homeScore, setHomeScore] = useState(current.homeScore?.toString() ?? '');
  const [awayScore, setAwayScore] = useState(current.awayScore?.toString() ?? '');
  const [status, setStatus]       = useState<MatchStatus>(current.status);
  const [koWinner, setKoWinner]   = useState(current.knockoutWinnerId ?? '');
  const [koMethod, setKoMethod]   = useState<KnockoutMethod | ''>(current.knockoutMethod ?? '');
  const [etHome, setEtHome]       = useState(current.etHomeScore?.toString() ?? '');
  const [etAway, setEtAway]       = useState(current.etAwayScore?.toString() ?? '');
  const [loading, setLoading]     = useState(false);

  const isDraw = homeScore !== '' && awayScore !== '' && homeScore === awayScore;
  const showKo = isKnockout && isDraw;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const body: Record<string, unknown> = {
      homeScore: homeScore !== '' ? parseInt(homeScore) : null,
      awayScore: awayScore !== '' ? parseInt(awayScore) : null,
      status,
    };

    if (showKo) {
      body.knockoutWinnerId = koWinner || null;
      body.knockoutMethod   = koMethod || null;
      if (koMethod === 'EXTRA_TIME') {
        body.etHomeScore = etHome !== '' ? parseInt(etHome) : null;
        body.etAwayScore = etAway !== '' ? parseInt(etAway) : null;
      }
    } else {
      body.knockoutWinnerId = null;
      body.knockoutMethod   = null;
      body.etHomeScore      = null;
      body.etAwayScore      = null;
    }

    const res = await fetch(`/api/admin/matches/${matchId}/result`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (res.ok) {
      const data = await res.json();
      toast({
        title: '✅ Resultado guardado',
        description: data.resolved > 0 ? `${data.resolved} predicciones actualizadas. Notificaciones Telegram enviadas.` : 'Resultado guardado.',
      });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast({ title: 'Error', description: data.error ?? 'No se pudo guardar', variant: 'destructive' });
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Resultado del partido</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1">
              <Label>{homeTeamId ?? 'Local'}</Label>
              <Input type="number" min="0" max="30" value={homeScore} onChange={e => setHomeScore(e.target.value)}
                className="text-center text-xl font-bold" placeholder="–" />
            </div>
            <span className="text-2xl font-bold text-muted-foreground mt-5">–</span>
            <div className="flex-1 space-y-1">
              <Label>{awayTeamId ?? 'Visitante'}</Label>
              <Input type="number" min="0" max="30" value={awayScore} onChange={e => setAwayScore(e.target.value)}
                className="text-center text-xl font-bold" placeholder="–" />
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={status} onValueChange={v => setStatus(v as MatchStatus)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCHEDULED">Pendiente</SelectItem>
                  <SelectItem value="LIVE">En juego</SelectItem>
                  <SelectItem value="FINISHED">Finalizado</SelectItem>
                  <SelectItem value="POSTPONED">Aplazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showKo && (
            <div className="border rounded-md p-4 space-y-4 bg-blue-50/50 dark:bg-blue-950/20">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Resultado de eliminatoria</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>¿Quién avanzó?</Label>
                  <Select value={koWinner} onValueChange={setKoWinner}>
                    <SelectTrigger><SelectValue placeholder="Equipo" /></SelectTrigger>
                    <SelectContent>
                      {homeTeamId && <SelectItem value={homeTeamId}>{homeTeamId}</SelectItem>}
                      {awayTeamId && <SelectItem value={awayTeamId}>{awayTeamId}</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>¿Cómo?</Label>
                  <Select value={koMethod} onValueChange={v => setKoMethod(v as KnockoutMethod)}>
                    <SelectTrigger><SelectValue placeholder="Método" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXTRA_TIME">Prórroga</SelectItem>
                      <SelectItem value="PENALTIES">Penaltis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {koMethod === 'EXTRA_TIME' && (
                <div className="space-y-2">
                  <Label>Marcador final tras prórroga (acumulado)</Label>
                  <div className="flex items-center gap-3">
                    <Input type="number" min="0" max="30" value={etHome} onChange={e => setEtHome(e.target.value)}
                      placeholder={homeTeamId ?? 'Local'} className="text-center" />
                    <span className="font-bold">–</span>
                    <Input type="number" min="0" max="30" value={etAway} onChange={e => setEtAway(e.target.value)}
                      placeholder={awayTeamId ?? 'Visitante'} className="text-center" />
                  </div>
                </div>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar resultado'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
