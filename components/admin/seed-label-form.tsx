'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface Props {
  matchId: string;
  homeLabel: string | null;
  awayLabel: string | null;
}

export function SeedLabelForm({ matchId, homeLabel: initHome, awayLabel: initAway }: Props) {
  const router = useRouter();
  const [home, setHome] = useState(initHome ?? '');
  const [away, setAway] = useState(initAway ?? '');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  async function save() {
    setSaving(true); setSaved(false);
    await fetch(`/api/admin/matches/${matchId}/seed-label`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ homeLabel: home || null, awayLabel: away || null }),
    });
    setSaving(false); setSaved(true);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Etiqueta de siembra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Formato: <code className="bg-muted px-1 rounded">1A</code> = 1º Grupo A,{' '}
          <code className="bg-muted px-1 rounded">2B</code> = 2º Grupo B,{' '}
          <code className="bg-muted px-1 rounded">3ABCD</code> = 3er mejor de grupos A/B/C/D
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Local (homeLabel)</Label>
            <Input value={home} onChange={e => { setHome(e.target.value); setSaved(false); }} placeholder="ej: 1A" className="font-mono h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Visitante (awayLabel)</Label>
            <Input value={away} onChange={e => { setAway(e.target.value); setSaved(false); }} placeholder="ej: 2B" className="font-mono h-8 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={save} disabled={saving}>Guardar etiquetas</Button>
          {saved && <span className="text-sm text-green-600">✓ Guardado</span>}
        </div>
      </CardContent>
    </Card>
  );
}
