'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';

interface Props {
  pendingLabels: string[];
}

export function ExtraReminderModal({ pendingLabels }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (pendingLabels.length > 0) setOpen(true);
  }, [pendingLabels.length]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
        <div className="text-2xl text-center">🎯</div>
        <h2 className="text-lg font-bold text-center">Tienes extras pendientes</h2>
        <p className="text-sm text-muted-foreground text-center">
          Aún no has respondido:
        </p>
        <ul className="text-sm space-y-1">
          {pendingLabels.map((l, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-orange-500">•</span>
              <span>{l}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 pt-2">
          <Button
            className="flex-1"
            onClick={() => { setOpen(false); router.push('/extras'); }}
          >
            Ir a extras
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Ahora no
          </Button>
        </div>
      </div>
    </div>
  );
}
