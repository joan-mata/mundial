'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  userId: string;
}

export function TelegramPrompt({ userId }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const never  = localStorage.getItem(`tg_skip_${userId}`) === 'never';
    const later  = sessionStorage.getItem(`tg_skip_${userId}`) === 'later';
    if (!never && !later) setVisible(true);
  }, [userId]);

  if (!visible) return null;

  function dismiss(mode: 'later' | 'never') {
    if (mode === 'never') localStorage.setItem(`tg_skip_${userId}`, 'never');
    else sessionStorage.setItem(`tg_skip_${userId}`, 'later');
    setVisible(false);
  }

  return (
    <div className="mb-4 rounded-xl border bg-card p-4 flex items-start justify-between gap-4 shadow-sm">
      <div className="flex items-start gap-3 min-w-0">
        <span className="text-2xl shrink-0">📱</span>
        <div className="min-w-0">
          <p className="text-sm font-medium">Activa las notificaciones de Telegram</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recibe recordatorios de partidos y resultados directamente en Telegram.
            Pídele al admin que configure tu cuenta en <strong>/admin/users</strong>.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => dismiss('never')}>
          No volver a mostrar
        </Button>
        <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground" onClick={() => dismiss('later')}>
          Más tarde
        </Button>
      </div>
    </div>
  );
}
