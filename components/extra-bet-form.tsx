'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Props {
  type: string;
  existing?: string;
}

export function ExtraBetForm({ type, existing }: Props) {
  const [value, setValue] = useState(existing ?? '');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);

    const res = await fetch('/api/extras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, value: value.trim() }),
    });

    setLoading(false);
    if (res.ok) {
      toast({ title: '✅ Apuesta guardada' });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast({ title: 'Error', description: data.error ?? 'No se pudo guardar', variant: 'destructive' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
      <Input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={existing ? `Actual: ${existing}` : 'Tu respuesta…'}
        className="flex-1"
      />
      <Button type="submit" disabled={loading} size="sm">
        {loading ? '…' : existing ? 'Actualizar' : 'Guardar'}
      </Button>
    </form>
  );
}
