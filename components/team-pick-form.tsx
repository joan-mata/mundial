'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Combobox } from './ui/combobox';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface Contest {
  id: string;
  name: string;
  pts: number;
  teamIds: string[];
  open: boolean;
  resolved: boolean;
  winnerId: string | null;
}

interface TeamOption {
  value: string;
  label: string;
}

interface Props {
  contest: Contest;
  teamOptions: TeamOption[];
  initialPick?: { teamIds: string[]; points: number | null } | null;
  userId: string;
}

export function TeamPickForm({ contest, teamOptions, initialPick, userId: _userId }: Props) {
  const router = useRouter();
  const [picks, setPicks]   = useState<[string, string]>([
    initialPick?.teamIds?.[0] ?? '',
    initialPick?.teamIds?.[1] ?? '',
  ]);
  const [saved, setSaved]   = useState(!!initialPick);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function labelOf(v: string) { return teamOptions.find(o => o.value === v)?.label ?? v; }

  async function handleSave() {
    const teamIds = picks.filter(Boolean);
    if (teamIds.length === 0) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/team-picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contestId: contest.id, teamIds }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? 'Error al guardar');
      } else {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  if (contest.resolved) {
    const myPts = initialPick?.points ?? null;
    const labels = (initialPick?.teamIds ?? []).filter(Boolean).map(labelOf);
    return (
      <div className="flex items-center justify-between">
        <span className="font-medium">{labels.join(', ') || '—'}</span>
        {myPts !== null && (
          <span className={`font-bold text-sm ${myPts > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
            {myPts > 0 ? `+${myPts} pts` : '0 pts'}
          </span>
        )}
      </div>
    );
  }

  if (!contest.open) {
    const labels = picks.filter(Boolean).map(labelOf);
    return (
      <div className="flex items-center justify-between">
        <span className={labels.length > 0 ? 'font-medium' : 'text-muted-foreground italic text-sm'}>
          {labels.length > 0 ? labels.join(', ') : 'Sin selección'}
        </span>
        <Badge variant="outline">Cerrado</Badge>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {saved && picks.some(Boolean) && (
        <p className="text-xs text-muted-foreground">
          Selección actual: <strong>{picks.filter(Boolean).map(labelOf).join(', ')}</strong>. Puedes cambiarla mientras esté abierto.
        </p>
      )}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <Combobox
              options={teamOptions}
              value={picks[0]}
              onChange={v => { setPicks([v, picks[1]]); setSaved(false); }}
              placeholder="Equipo 1…"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Combobox
              options={teamOptions}
              value={picks[1]}
              onChange={v => { setPicks([picks[0], v]); setSaved(false); }}
              placeholder="Equipo 2 (opcional)…"
            />
          </div>
        </div>
      </div>
      <Button
        size="sm"
        disabled={!picks[0] || saving}
        onClick={handleSave}
      >
        {saving ? '…' : 'Guardar'}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
