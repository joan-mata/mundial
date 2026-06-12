'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Props {
  name: string;
  telegramChatId: string | null;
  telegramToken:  string | null;
}

export function ProfileSettingsForm({ name, telegramChatId, telegramToken }: Props) {
  const [nameVal, setNameVal]   = useState(name);
  const [chatId, setChatId]     = useState(telegramChatId ?? '');
  const [token, setToken]       = useState(telegramToken  ?? '');
  const [loading, setLoading]   = useState(false);
  const { toast }  = useToast();
  const router     = useRouter();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nameVal.trim()) return;
    setLoading(true);
    const res = await fetch('/api/profile/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:           nameVal.trim(),
        telegramChatId: chatId.trim() || null,
        telegramToken:  token.trim()  || null,
      }),
    });
    setLoading(false);
    if (res.ok) {
      toast({ title: '✅ Perfil actualizado' });
      router.refresh();
    } else {
      toast({ title: 'Error al guardar', variant: 'destructive' });
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="prof-name">Nombre</Label>
        <Input id="prof-name" value={nameVal} onChange={e => setNameVal(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="prof-chatid">Telegram Chat ID</Label>
        <Input id="prof-chatid" value={chatId} onChange={e => setChatId(e.target.value)} placeholder="123456789" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="prof-token">Telegram Bot Token</Label>
        <Input id="prof-token" type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="1234567890:ABCdef…" />
        <p className="text-xs text-muted-foreground">Bot creado con @BotFather. Necesario para recibir notificaciones.</p>
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );
}
