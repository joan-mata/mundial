'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';

export function SyncButton() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleSync() {
    setLoading(true);
    const res = await fetch('/api/cron/sync-results', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      toast({ title: '✅ Sync completado', description: `${data.resolved ?? 0} partidos resueltos` });
    } else {
      toast({ title: 'Error en sync', variant: 'destructive' });
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleSync} disabled={loading} className="w-full gap-2">
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      Forzar sync con API
    </Button>
  );
}
