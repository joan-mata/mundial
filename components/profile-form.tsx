'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Props {
  teams: { id: string; name: string; flag: string; group: string }[];
}

export function ProfileForm({ teams }: Props) {
  const [team, setTeam] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!team) return;
    setLoading(true);

    const res = await fetch('/api/profile/favorite-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: team }),
    });

    setLoading(false);
    if (res.ok) {
      toast({ title: '✅ Equipo favorito guardado' });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast({ title: 'Error', description: data.error ?? 'No se pudo guardar', variant: 'destructive' });
    }
  }

  const byGroup = teams.reduce<Record<string, typeof teams>>((acc, t) => {
    (acc[t.group] ??= []).push(t);
    return acc;
  }, {});

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Select value={team} onValueChange={setTeam}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Elige tu equipo…" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(byGroup).sort(([a], [b]) => a.localeCompare(b)).map(([group, ts]) => (
            <div key={group}>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Grupo {group}</div>
              {ts.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.flag} {t.name}</SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={loading || !team} size="sm">
        {loading ? '…' : 'Elegir'}
      </Button>
    </form>
  );
}
