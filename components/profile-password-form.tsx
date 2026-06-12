'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export function ProfilePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast({ title: 'Las contraseñas no coinciden', variant: 'destructive' }); return; }

    setLoading(true);
    const res = await fetch('/api/profile/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setLoading(false);

    if (res.ok) {
      toast({ title: '✅ Contraseña actualizada' });
      setPassword('');
      setConfirm('');
    } else {
      const data = await res.json().catch(() => ({}));
      toast({ title: data.error ?? 'Error al cambiar la contraseña', variant: 'destructive' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="new-pw">Nueva contraseña</Label>
        <Input id="new-pw" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm-pw">Confirmar contraseña</Label>
        <Input id="confirm-pw" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? 'Guardando…' : 'Cambiar contraseña'}
      </Button>
    </form>
  );
}
