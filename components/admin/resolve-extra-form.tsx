'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Props {
  type: string;
  betIds: { id: string; value: string }[];
  awardPts: number;
}

export function ResolveExtraForm({ type, betIds, awardPts }: Props) {
  const [correctValue, setCorrectValue] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!correctValue.trim()) return;
    setLoading(true);

    const res = await fetch(`/api/admin/extras/${type}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correctValue: correctValue.trim(), awardPts }),
    });

    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      toast({ title: `✅ Resuelto — ${data.awarded} usuarios premiados` });
      router.refresh();
    } else {
      toast({ title: 'Error', variant: 'destructive' });
    }
  }

  return (
    <form onSubmit={handleResolve} className="flex gap-2 items-end">
      <div className="flex-1 space-y-1">
        <Label className="text-xs">Valor correcto (para marcar ganadores)</Label>
        <Input
          value={correctValue}
          onChange={e => setCorrectValue(e.target.value)}
          placeholder="Escribe el valor correcto…"
          required
        />
      </div>
      <Button type="submit" size="sm" disabled={loading || betIds.length === 0}>
        {loading ? 'Resolviendo…' : `Resolver (+${awardPts} pts)`}
      </Button>
    </form>
  );
}
