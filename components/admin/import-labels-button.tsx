'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function ImportLabelsButton() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handle() {
    setLoading(true);
    const res = await fetch('/api/admin/import-labels', { method: 'POST' });
    setLoading(false);
    if (res.ok) {
      const d = await res.json() as { updated?: number };
      toast({ title: `✅ Etiquetas importadas`, description: `${d.updated ?? 0} partidos actualizados` });
    } else {
      toast({ title: 'Error', variant: 'destructive' });
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handle} disabled={loading} className="w-full">
      {loading ? 'Importando…' : 'Importar etiquetas (cuadro)'}
    </Button>
  );
}
