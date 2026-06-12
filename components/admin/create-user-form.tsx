'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function CreateUserForm() {
  const [open, setOpen]         = useState(false);
  const [name, setName]         = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password }),
    });

    setLoading(false);
    if (res.ok) {
      toast({ title: '✅ Usuario creado' });
      setName(''); setUsername(''); setPassword('');
      setOpen(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast({ title: 'Error', description: data.error ?? 'No se pudo crear', variant: 'destructive' });
    }
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Crear nuevo usuario</CardTitle>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Joan" required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Usuario</Label>
                <Input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="joan_perez" required />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contraseña inicial</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
            </div>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Creando…' : 'Crear usuario'}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
