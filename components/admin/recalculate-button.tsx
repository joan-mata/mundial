'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';

export function RecalculateButton() {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleConfirm() {
    setLoading(true);
    const res = await fetch('/api/admin/recalculate', { method: 'POST' });
    setLoading(false);
    setOpen(false);

    if (res.ok) {
      const data = await res.json();
      toast({
        title: '✅ Recálculo completado',
        description: `${data.matchesProcessed} partidos procesados, ${data.predictionsUpdated} predicciones actualizadas`,
      });
    } else {
      toast({ title: 'Error en el recálculo', variant: 'destructive' });
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Recalcular ahora
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Confirmar recálculo?</DialogTitle>
            <DialogDescription>
              Esto sobrescribirá todos los puntos calculados para los partidos con resultado.
              La operación es segura e idempotente — no pierde datos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Calculando…</> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
