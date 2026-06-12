'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { KnockoutMethod } from '@prisma/client';

interface Props {
  matchId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  isKnockout: boolean;
  deadline: Date;
  existing?: {
    homeScore: number;
    awayScore: number;
    knockoutWinnerId?: string | null;
    knockoutMethod?: KnockoutMethod | null;
    etHomeScore?: number | null;
    etAwayScore?: number | null;
  };
}

export function PredictionForm({ matchId, homeTeamId, awayTeamId, homeTeamName, awayTeamName, isKnockout, deadline, existing }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [homeScore, setHomeScore] = useState(existing?.homeScore?.toString() ?? '');
  const [awayScore, setAwayScore] = useState(existing?.awayScore?.toString() ?? '');
  const [koWinner, setKoWinner]   = useState(existing?.knockoutWinnerId ?? '');
  const [koMethod, setKoMethod]   = useState<KnockoutMethod | ''>(existing?.knockoutMethod ?? '');
  const [etHome, setEtHome]       = useState(existing?.etHomeScore?.toString() ?? '');
  const [etAway, setEtAway]       = useState(existing?.etAwayScore?.toString() ?? '');
  const [loading, setLoading]     = useState(false);
  const [timeLeft, setTimeLeft]   = useState('');

  const isDraw = homeScore !== '' && awayScore !== '' && homeScore === awayScore;
  const showKo = isKnockout && isDraw;

  useEffect(() => {
    const update = () => {
      const diff = deadline.getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Cerrado'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!homeScore || !awayScore) return;

    if (showKo && !koWinner) {
      toast({ title: 'Falta el avance', description: 'En eliminatorias con empate debes indicar quién avanza.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const body: Record<string, unknown> = {
      matchId,
      homeScore: parseInt(homeScore),
      awayScore: parseInt(awayScore),
    };

    if (showKo && koWinner) {
      body.knockoutWinnerId = koWinner;
      body.knockoutMethod   = koMethod || null;
      if (koMethod === 'EXTRA_TIME' && etHome && etAway) {
        body.etHomeScore = parseInt(etHome);
        body.etAwayScore = parseInt(etAway);
      }
    }

    const res = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setLoading(false);
    if (res.ok) {
      toast({ title: '✅ Predicción guardada', variant: 'success' as 'default' });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast({ title: 'Error', description: data.error ?? 'No se pudo guardar', variant: 'destructive' });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>{existing ? 'Editar predicción' : 'Tu predicción'}</span>
          <span className={`text-sm font-normal ${timeLeft === 'Cerrado' ? 'text-destructive' : 'text-muted-foreground'}`}>
            Cierra en: {timeLeft}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="homeScore">{homeTeamName ?? homeTeamId ?? 'Local'}</Label>
              <Input id="homeScore" type="number" min="0" max="20" value={homeScore}
                onChange={e => setHomeScore(e.target.value)} className="text-center text-xl font-bold" required />
            </div>
            <span className="text-2xl font-bold text-muted-foreground mt-5">–</span>
            <div className="flex-1 space-y-1">
              <Label htmlFor="awayScore">{awayTeamName ?? awayTeamId ?? 'Visitante'}</Label>
              <Input id="awayScore" type="number" min="0" max="20" value={awayScore}
                onChange={e => setAwayScore(e.target.value)} className="text-center text-xl font-bold" required />
            </div>
          </div>

          {showKo && (
            <div className="border rounded-md p-4 space-y-4 bg-blue-50/50 dark:bg-blue-950/20">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Eliminatoria — ¿Qué pasa tras el empate?</p>

              <div className="space-y-2">
                <Label>¿Quién avanza?</Label>
                <Select value={koWinner} onValueChange={setKoWinner}>
                  <SelectTrigger><SelectValue placeholder="Selecciona equipo" /></SelectTrigger>
                  <SelectContent>
                    {homeTeamId && <SelectItem value={homeTeamId}>{homeTeamName ?? homeTeamId}</SelectItem>}
                    {awayTeamId && <SelectItem value={awayTeamId}>{awayTeamName ?? awayTeamId}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>¿Cómo se decide? (opcional, +1 pts si aciertas)</Label>
                <Select value={koMethod} onValueChange={v => setKoMethod(v as KnockoutMethod)}>
                  <SelectTrigger><SelectValue placeholder="Método" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXTRA_TIME">Prórroga</SelectItem>
                    <SelectItem value="PENALTIES">Penaltis</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {koMethod === 'EXTRA_TIME' && (
                <div className="space-y-2">
                  <Label>Marcador tras prórroga (acumulado, opcional, +3 pts si aciertas)</Label>
                  <div className="flex items-center gap-3">
                    <Input type="number" min="0" max="20" value={etHome} onChange={e => setEtHome(e.target.value)}
                      placeholder={homeTeamId ?? 'Local'} className="text-center" />
                    <span className="font-bold">–</span>
                    <Input type="number" min="0" max="20" value={etAway} onChange={e => setEtAway(e.target.value)}
                      placeholder={awayTeamId ?? 'Visitante'} className="text-center" />
                  </div>
                </div>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Guardando…' : existing ? 'Actualizar predicción' : 'Enviar predicción'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
