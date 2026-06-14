'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { verifyCurrentPassword } from '@/app/actions/verify-password';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const IDLE_MS = 15 * 60 * 1000;

export function IdleGuard() {
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const timerRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lockedRef = useRef(false);

  const resetTimer = () => {
    if (lockedRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lockedRef.current = true;
      setLocked(true);
    }, IDLE_MS);
  };

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'] as const;
    const handler = () => resetTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetTimer();
    return () => {
      clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, handler));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const ok = await verifyCurrentPassword(password);
      if (ok) {
        lockedRef.current = false;
        setLocked(false);
        setPassword('');
        setError('');
        resetTimer();
      } else {
        setError('Contraseña incorrecta');
      }
    });
  };

  if (!locked) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm p-6 rounded-xl border bg-card shadow-xl space-y-4">
        <div>
          <h2 className="text-xl font-bold">Sesión pausada</h2>
          <p className="text-sm text-muted-foreground mt-1">
            15 min sin actividad. Introduce tu contraseña para continuar.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isPending || !password} className="w-full">
            {isPending ? 'Verificando…' : 'Continuar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
