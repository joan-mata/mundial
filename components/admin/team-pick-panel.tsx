'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { TeamCheckboxSelect } from '@/components/ui/team-checkbox-select';

interface Team { id: string; name: string; flag: string; }
interface Entry { id: string; teamIds: string[]; user: { id: string; name: string }; points: number | null; }
interface Contest {
  id: string; name: string; pts: number; teamIds: string[];
  open: boolean; resolved: boolean; winnerId: string | null;
  entries: Entry[];
}

interface Props {
  contests: Contest[];
  allTeams: Team[];
  extraPts: Record<string, number>;
  extraOpen: Record<string, boolean>;
  deadline: string;
}

const BET_LABELS: Record<string, string> = {
  WORLD_CUP_WINNER: 'Campeón del Mundial',
  TOP_SCORER:       'Máximo goleador',
  BEST_GOALKEEPER:  'Mejor portero',
};

export function AdminTeamPickPanel({ contests, allTeams, extraPts: initialExtraPts, extraOpen: initialExtraOpen, deadline: initialDeadline }: Props) {
  const router   = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg,  setMsg]  = useState('');

  // Create form state
  const [newName,    setNewName]    = useState('');
  const [newPts,     setNewPts]     = useState('5');
  const [newTeamIds, setNewTeamIds] = useState<string[]>([]);

  // Resolve state per contest
  const [winners, setWinners] = useState<Record<string, string>>({});

  // Extra bet pts & open flags editing
  const [extraPts,  setExtraPts]  = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initialExtraPts).map(([k, v]) => [k, String(v)]))
  );
  const [extraOpen, setExtraOpen] = useState<Record<string, boolean>>(initialExtraOpen);
  const [deadline,  setDeadline]  = useState(initialDeadline.slice(0, 16)); // datetime-local format
  const [ptsSaved,  setPtsSaved]  = useState(false);

  const teamMap = new Map(allTeams.map(t => [t.id, t]));
  const contestTeamOptions = (teamIds: string[]) => teamIds.map(tid => {
    const t = teamMap.get(tid);
    return { value: tid, label: t ? `${t.flag} ${t.name}` : tid };
  });

  async function apiFetch(url: string, body: object, method = 'POST') {
    setBusy(true); setMsg('');
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setMsg(d.error ?? 'Error');
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function saveExtraSettings() {
    const body: Record<string, string> = { extra_bet_deadline: new Date(deadline).toISOString() };
    for (const [type, val] of Object.entries(extraPts)) {
      body[`extra_pts_${type}`] = val;
    }
    for (const [type, open] of Object.entries(extraOpen)) {
      body[`extra_open_${type}`] = open ? 'true' : 'false';
    }
    const ok = await apiFetch('/api/admin/settings', body, 'PATCH');
    if (ok) setPtsSaved(true);
  }

  async function createContest() {
    if (!newName || !newPts || newTeamIds.length === 0) { setMsg('Completa todos los campos'); return; }
    const ok = await apiFetch('/api/admin/team-picks', { name: newName, pts: Number(newPts), teamIds: newTeamIds });
    if (ok) { setNewName(''); setNewPts('5'); setNewTeamIds([]); }
  }

  async function deleteContest(id: string) {
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/team-picks?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json() as { error?: string }; setMsg(d.error ?? 'Error'); }
      else router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">

      {/* ── Configurable extra bet settings ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuración de apuestas extra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Deadline */}
          <div className="space-y-1">
            <Label className="text-xs">Cierre automático (hora local)</Label>
            <Input
              type="datetime-local"
              value={deadline}
              onChange={e => { setDeadline(e.target.value); setPtsSaved(false); }}
              className="h-8 text-sm max-w-xs"
            />
          </div>

          {/* Per-type: open toggle + pts */}
          <div className="space-y-3">
            {Object.entries(BET_LABELS).map(([type, label]) => (
              <div key={type} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <div className="flex-1">
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={1}
                    value={extraPts[type] ?? ''}
                    onChange={e => { setExtraPts(p => ({ ...p, [type]: e.target.value })); setPtsSaved(false); }}
                    className="h-7 text-sm w-16"
                  />
                  <span className="text-xs text-muted-foreground">pts</span>
                </div>
                <Button
                  size="sm"
                  variant={extraOpen[type] ? 'default' : 'outline'}
                  className={`w-24 text-xs ${extraOpen[type] ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  onClick={() => { setExtraOpen(o => ({ ...o, [type]: !o[type] })); setPtsSaved(false); }}
                  disabled={busy}
                >
                  {extraOpen[type] ? 'Abierta' : 'Cerrada'}
                </Button>
              </div>
            ))}
          </div>

          {msg && <p className="text-sm text-red-500">{msg}</p>}
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={saveExtraSettings} disabled={busy}>Guardar configuración</Button>
            {ptsSaved && <span className="text-sm text-green-600">✓ Guardado</span>}
          </div>
        </CardContent>
      </Card>

      {/* ── Create new TeamPickContest ── */}
      <h2 className="text-xl font-bold">Mejor equipo</h2>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuevo concurso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <Label>Nombre</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Mejor equipo fase de grupos" />
            </div>
            <div className="space-y-1">
              <Label>Puntos</Label>
              <Input type="number" value={newPts} onChange={e => setNewPts(e.target.value)} min={1} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Equipos en el pool</Label>
            <TeamCheckboxSelect
              teams={allTeams}
              selected={newTeamIds}
              onChange={setNewTeamIds}
            />
          </div>

          {msg && <p className="text-sm text-red-500">{msg}</p>}
          <Button onClick={createContest} disabled={busy}>Crear concurso</Button>
        </CardContent>
      </Card>

      {/* ── Existing contests ── */}
      {contests.map(contest => {
        const winner = contest.winnerId ? teamMap.get(contest.winnerId) : null;

        return (
          <Card key={contest.id}>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">{contest.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">+{contest.pts} pts</Badge>
                  {contest.resolved
                    ? <Badge className="bg-green-600">Resuelto</Badge>
                    : contest.open
                      ? <Badge variant="outline" className="text-green-600 border-green-600">Abierto</Badge>
                      : <Badge variant="outline">Cerrado</Badge>
                  }
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Entries */}
              <div className="rounded-md border divide-y text-sm">
                {contest.entries.length === 0 ? (
                  <p className="p-3 text-muted-foreground">Ninguna selección aún</p>
                ) : contest.entries.map(e => {
                  const teamLabels = e.teamIds.map(tid => { const t = teamMap.get(tid); return t ? `${t.flag} ${t.name}` : tid; }).join(', ');
                  return (
                    <div key={e.id} className="flex items-center justify-between p-3">
                      <span className="font-medium">{e.user.name}</span>
                      <div className="flex items-center gap-2">
                        <span>{teamLabels}</span>
                        {e.points !== null && (
                          <span className={`text-xs font-bold ${e.points > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {e.points > 0 ? `+${e.points}pts` : '0pts'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pool – show as read-only checkboxes */}
              <div className="space-y-1">
                <Label className="text-xs">Pool de equipos</Label>
                <TeamCheckboxSelect
                  teams={allTeams}
                  selected={contest.teamIds}
                  onChange={() => {}}
                  disabled
                />
              </div>

              {/* Resolve */}
              {!contest.resolved && (
                <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                  <div className="flex-1 min-w-[160px]">
                    <Combobox
                      options={contestTeamOptions(contest.teamIds)}
                      value={winners[contest.id] ?? ''}
                      onChange={v => setWinners(w => ({ ...w, [contest.id]: v }))}
                      placeholder="Seleccionar ganador…"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={busy || !winners[contest.id]}
                    onClick={() => apiFetch('/api/admin/team-picks', { id: contest.id, action: 'resolve', winnerId: winners[contest.id] }, 'PATCH')}
                  >
                    Resolver
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => apiFetch('/api/admin/team-picks', { id: contest.id, action: 'toggle', open: !contest.open }, 'PATCH')}
                  >
                    {contest.open ? 'Cerrar' : 'Reabrir'}
                  </Button>
                </div>
              )}

              {contest.resolved && winner && (
                <p className="text-sm pt-2 border-t text-muted-foreground">
                  Ganador: <strong>{winner.flag} {winner.name}</strong>
                </p>
              )}

              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => deleteContest(contest.id)}>
                Eliminar concurso
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
