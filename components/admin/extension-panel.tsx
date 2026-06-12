'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';

interface Extension {
  id: string;
  userId: string | null;
  userName: string;
  newDeadline: string;
  reason: string | null;
  createdAt: string;
}

interface Props {
  matchId: string;
  kickoff: string;
  users: { id: string; name: string }[];
  extensions: Extension[];
}

export function ExtensionPanel({ matchId, kickoff, users, extensions }: Props) {
  const { toast } = useToast();
  const router    = useRouter();

  // Form state
  const [targetUser, setTargetUser] = useState<string>('__global__');
  const [deadline, setDeadline]     = useState('');
  const [reason, setReason]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [revoking, setRevoking]     = useState<string | null>(null);

  // Default deadline = kickoff + 1h
  const defaultDeadline = new Date(new Date(kickoff).getTime() + 60 * 60 * 1000)
    .toISOString().slice(0, 16);

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!deadline || !reason.trim()) return;
    setLoading(true);

    const res = await fetch(`/api/admin/matches/${matchId}/extension`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId:      targetUser === '__global__' ? null : targetUser,
        newDeadline: new Date(deadline).toISOString(),
        reason:      reason.trim(),
      }),
    });

    setLoading(false);
    if (res.ok) {
      toast({ title: '✅ Prórroga concedida' });
      setReason('');
      router.refresh();
    } else {
      toast({ title: 'Error', variant: 'destructive' });
    }
  }

  async function handleRevoke(userId: string | null) {
    const key = userId ?? '__global__';
    setRevoking(key);

    const res = await fetch(`/api/admin/matches/${matchId}/extension`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    setRevoking(null);
    if (res.ok) {
      toast({ title: 'Prórroga revocada' });
      router.refresh();
    } else {
      toast({ title: 'Error al revocar', variant: 'destructive' });
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Prórrogas de predicción</CardTitle></CardHeader>
      <CardContent className="space-y-4">

        {/* Prórrogas activas */}
        {extensions.length > 0 ? (
          <div className="divide-y rounded-md border">
            {extensions.map(ext => (
              <div key={ext.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ext.userId ? ext.userName : 'Todos los usuarios'}</span>
                    {!ext.userId && <Badge variant="secondary" className="text-xs">Global</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Hasta: {new Date(ext.newDeadline).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}
                  </div>
                  {ext.reason && <div className="text-xs text-muted-foreground italic">{ext.reason}</div>}
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="text-destructive hover:text-destructive h-8 w-8"
                  disabled={revoking === (ext.userId ?? '__global__')}
                  onClick={() => handleRevoke(ext.userId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No hay prórrogas activas</p>
        )}

        {/* Formulario nueva prórroga */}
        <form onSubmit={handleGrant} className="space-y-3 pt-2 border-t">
          <p className="text-sm font-medium">Nueva prórroga</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Para</Label>
              <Select value={targetUser} onValueChange={setTargetUser}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__global__">Todos los usuarios</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nuevo deadline</Label>
              <Input
                type="datetime-local"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                max={new Date(new Date(kickoff).getTime() + 2 * 3600 * 1000).toISOString().slice(0, 16)}
                placeholder={defaultDeadline}
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo (obligatorio)</Label>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ej: No pudo conectarse por trabajo"
              maxLength={200}
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={loading || !reason.trim() || !deadline}>
            {loading ? 'Concediendo…' : 'Conceder prórroga'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
